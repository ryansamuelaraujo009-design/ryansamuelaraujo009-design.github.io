// McPanel — ponto de entrada: servidor HTTP local (API JSON + site estático).
// Sem dependências externas: node:http puro.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  HOST,
  PORT,
  WEB_DIR,
  DATA_DIR,
  SERVERS_DIR,
  RUNTIME_DIR,
  CACHE_DIR,
  STATE_FILE,
  PANEL_VERSION,
  MAX_BODY,
  MAX_TEXT_FILE,
} from './lib/config.js';
import { HttpError, sendJson, sendError, readJson, readBody, safePath } from './lib/util.js';
import { loadState, listInstances, getInstance, putInstance, getJob, listJobs, createJob, runJob, jobLog } from './lib/store.js';
import * as instApi from './lib/instance.js';
import * as swApi from './lib/software.js';
import * as mrApi from './lib/modrinth.js';
import * as backupApi from './lib/backups.js';
import * as javaApi from './lib/java.js';
import { subscribe, getLines, currentSeq } from './lib/console.js';

const SOFTWARE = swApi.SOFTWARE;
const STARTED_AT = Date.now();

// ---------------------------------------------------------------------------
// Arquivos estáticos (o site fica em minecraft-panel/)
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function statOrNull(p) {
  try {
    return await fsp.stat(p);
  } catch {
    return null;
  }
}

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.includes('\0')) throw new HttpError(400, 'Caminho inválido.');
  if (rel === '/') rel = '/index.html';
  let target = safePath(WEB_DIR, rel);
  let st = await statOrNull(target);
  if (st?.isDirectory()) {
    target = path.join(target, 'index.html');
    st = await statOrNull(target);
  }
  if (!st || !st.isFile()) {
    // SPA: rotas do hash nunca chegam aqui, mas qualquer outra volta o index
    const fallback = path.join(WEB_DIR, 'index.html');
    const fst = await statOrNull(fallback);
    if (fst) {
      target = fallback;
      st = fst;
    } else {
      throw new HttpError(404, 'Arquivo não encontrado.');
    }
  }
  const ext = path.extname(target).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const etag = `W/"${st.size}-${Math.floor(st.mtimeMs)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag });
    res.end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': st.size,
    ETag: etag,
    'Cache-Control': /\.(html|css|js|mjs|json)$/.test(ext) ? 'no-cache' : 'public, max-age=3600',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(target).pipe(res);
}

// ---------------------------------------------------------------------------
// Helpers de rota
// ---------------------------------------------------------------------------

function plainJob(j) {
  if (!j) return null;
  const { onDone, ...rest } = j;
  return rest;
}

function instanceOr404(seg) {
  return getInstance(seg[1]);
}

async function jsonBody(req, limit) {
  return readJson(req, limit);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function handleApi(req, res, url) {
  const method = req.method || 'GET';
  const raw = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '');
  const seg = raw.split('/').filter(Boolean); // ex: ['instances','ab12','console']

  // ---------- status ----------
  if (seg[0] === 'status' && !seg[1]) {
    if (method !== 'GET') throw new HttpError(405, 'Método não permitido.');
    const java = await javaApi.javaStatus();
    const instances = listInstances();
    const counts = {};
    for (const i of instances) {
      const st = instApi.statusOf(i);
      counts[st] = (counts[st] || 0) + 1;
    }
    return sendJson(res, 200, {
      ok: true,
      panel: PANEL_VERSION,
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      dataDir: DATA_DIR,
      serversDir: SERVERS_DIR,
      stateFile: STATE_FILE,
      uptimeMs: Date.now() - STARTED_AT,
      instances: instances.length,
      counts,
      running: counts.running || 0,
      jobs: listJobs().filter((j) => j.status === 'running').length,
      java,
      software: Object.keys(SOFTWARE),
    });
  }

  // ---------- software ----------
  if (seg[0] === 'software' && !seg[1]) {
    if (method !== 'GET') throw new HttpError(405, 'Método não permitido.');
    const ids = Object.keys(SOFTWARE);
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const versions = await swApi.listVersions(id);
        return { id, ...SOFTWARE[id], versions, error: null };
      })
    );
    const out = results.map((r, idx) =>
      r.status === 'fulfilled'
        ? r.value
        : { id: ids[idx], ...SOFTWARE[ids[idx]], versions: [], error: String(r.reason?.message || r.reason) }
    );
    let fabricLoaders = [];
    try {
      fabricLoaders = await swApi.listFabricLoaders();
    } catch {
      /* offline: lista vazia */
    }
    return sendJson(res, 200, { software: out, fabricLoaders });
  }

  // ---------- jobs ----------
  if (seg[0] === 'jobs') {
    if (method !== 'GET') throw new HttpError(405, 'Método não permitido.');
    if (!seg[1]) return sendJson(res, 200, { jobs: listJobs().map(plainJob) });
    const job = getJob(seg[1]);
    if (!job) throw new HttpError(404, 'Job não encontrado (ou expirou).');
    return sendJson(res, 200, { job: plainJob(job) });
  }

  // ---------- runtime (Java) ----------
  if (seg[0] === 'runtime' && seg[1] === 'setup') {
    if (method !== 'POST') throw new HttpError(405, 'Método não permitido.');
    const body = await jsonBody(req);
    const majors = Array.isArray(body.majors) && body.majors.length ? body.majors : [21, 25];
    const job = createJob('runtime', 'Preparar Java');
    runJob(job, async (j) => {
      const done = [];
      for (const m of majors) {
        const major = Number(m);
        if (![21, 25].includes(major)) continue;
        const info = await javaApi.ensureJava(major, j);
        done.push({ major, version: info.version, path: info.path });
      }
      jobLog(j, 'Java pronto para uso.');
      return { runtimes: done };
    }).catch(() => {});
    return sendJson(res, 202, { jobId: job.id });
  }

  // ---------- busca / projetos (top-level) ----------
  if (seg[0] === 'search') {
    if (method !== 'GET') throw new HttpError(405, 'Método não permitido.');
    const kind = url.searchParams.get('kind') || 'plugin';
    const q = url.searchParams.get('q') || '';
    const mc = url.searchParams.get('mc') || '';
    const limit = Number(url.searchParams.get('limit')) || 24;
    const hits = await mrApi.search(kind, q, mc, limit);
    return sendJson(res, 200, { hits });
  }

  if (seg[0] === 'projects' && seg[1] && seg[2] === 'versions') {
    if (method !== 'GET') throw new HttpError(405, 'Método não permitido.');
    const kind = url.searchParams.get('kind') || 'plugin';
    const mc = url.searchParams.get('mc') || '';
    const versions = await mrApi.projectVersions(seg[1], kind, mc);
    return sendJson(res, 200, { versions });
  }

  // ---------- instâncias ----------
  if (seg[0] === 'instances') {
    if (!seg[1]) {
      if (method === 'GET') {
        return sendJson(res, 200, {
          instances: listInstances().map(instApi.serialize),
          jobs: listJobs().slice(0, 20).map(plainJob),
        });
      }
      if (method === 'POST') {
        const body = await jsonBody(req);
        const { inst, job } = await instApi.create(body);
        return sendJson(res, 202, { instance: instApi.serialize(inst), jobId: job.id });
      }
      throw new HttpError(405, 'Método não permitido.');
    }

    const id = seg[1];
    const action = seg[2];

    // ações de job (retornam {jobId}) — as demais rotas POST seguem abaixo
    const JOB_ACTIONS = ['start', 'stop', 'restart', 'reinstall', 'kill', 'delete', 'version'];
    if (method === 'POST' && action && JOB_ACTIONS.includes(action)) {
      switch (action) {
        case 'start':
          return sendJson(res, 202, { jobId: instApi.start(id).id });
        case 'stop':
          return sendJson(res, 202, { jobId: instApi.stop(id).id });
        case 'restart':
          return sendJson(res, 202, { jobId: instApi.restart(id).id });
        case 'reinstall':
          return sendJson(res, 202, { jobId: instApi.reinstall(id).id });
        case 'kill':
          return sendJson(res, 202, { jobId: instApi.killOrphan(id).id });
        case 'delete': {
          const job = instApi.remove(id);
          return sendJson(res, 202, { jobId: job.id });
        }
        case 'version': {
          const b = await jsonBody(req);
          const { job } = instApi.changeVersion(id, b);
          return sendJson(res, 202, { jobId: job.id });
        }
        default:
          throw new HttpError(404, `Ação desconhecida: ${action}`);
      }
    }

    if (method === 'GET' && !action) {
      return sendJson(res, 200, { instance: instApi.serialize(instanceOr404(seg)) });
    }
    if (method === 'PATCH' || (method === 'PUT' && !action)) {
      const body = await jsonBody(req);
      const { inst, restartNeeded } = await instApi.update(id, body);
      return sendJson(res, 200, { instance: instApi.serialize(inst), restartNeeded });
    }
    if (method === 'DELETE' && !action) {
      const job = instApi.remove(id);
      return sendJson(res, 202, { jobId: job.id });
    }

    // ---------- console ----------
    if (action === 'console' && seg[3] === 'stream' && (method === 'GET' || method === 'HEAD')) {
      const lastId = Number(req.headers['last-event-id'] || url.searchParams.get('lastEventId') || 0);
      getInstance(id); // 404 se não existir
      subscribe(id, res, lastId);
      return; // SSE fica aberto
    }
    if (action === 'console' && method === 'GET') {
      const since = Number(url.searchParams.get('since')) || 0;
      return sendJson(res, 200, { seq: currentSeq(id), lines: getLines(id, since, 500) });
    }
    if (action === 'console' && method === 'DELETE') {
      // limpa visualmente o buffer local (não afeta o servidor MC)
      const c = getLines(id, 0, 1);
      void c;
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'command' && method === 'POST') {
      const body = await jsonBody(req);
      return sendJson(res, 200, await instApi.sendCommand(id, body.command));
    }

    // ---------- players ----------
    if (action === 'players' && method === 'GET') {
      return sendJson(res, 200, await instApi.getPlayers(id));
    }
    if (action === 'players' && (method === 'POST' || method === 'PATCH')) {
      const body = await jsonBody(req);
      return sendJson(res, 200, await instApi.playerAction(id, body.action, body.target));
    }

    // ---------- properties ----------
    if (action === 'properties' && method === 'GET') {
      const inst = getInstance(id);
      return sendJson(res, 200, { props: await instApi.readProps(instApi.dirOf(inst)) });
    }
    if (action === 'properties' && (method === 'PUT' || method === 'PATCH')) {
      const inst = getInstance(id);
      const body = await jsonBody(req);
      const props = await instApi.readProps(instApi.dirOf(inst));
      for (const [k, v] of Object.entries(body.props || {})) {
        if (!/^[A-Za-z0-9._-]{1,64}$/.test(k)) continue;
        props[k] = String(v).slice(0, 2000);
      }
      await instApi.writeProps(instApi.dirOf(inst), props);
      return sendJson(res, 200, { props });
    }

    // ---------- arquivos ----------
    if (action === 'list' && method === 'GET') {
      return sendJson(res, 200, await instApi.listDir(id, url.searchParams.get('path') || ''));
    }
    if (action === 'file' && method === 'GET') {
      return sendJson(res, 200, await instApi.readFileApi(id, url.searchParams.get('path') || ''));
    }
    if (action === 'file' && (method === 'PUT' || method === 'POST')) {
      const buf = await readBody(req, MAX_TEXT_FILE);
      const out = await instApi.writeFileApi(id, url.searchParams.get('path') || '', buf);
      return sendJson(res, 200, out);
    }
    if (action === 'file' && method === 'DELETE') {
      return sendJson(res, 200, await instApi.deleteFileApi(id, url.searchParams.get('path') || ''));
    }

    // upload de jar (mods/plugins feitos localmente)
    if (action === 'upload' && method === 'POST') {
      const kind = url.searchParams.get('kind') === 'mod' ? 'mod' : 'plugin';
      const filename = String(url.searchParams.get('filename') || '').replace(/[\\/:*?"<>|]/g, '_');
      if (!filename) throw new HttpError(400, 'filename não informado.');
      const buf = await readBody(req, MAX_BODY);
      if (!buf.length) throw new HttpError(400, 'Arquivo vazio.');
      const folder = kind === 'mod' ? 'mods' : 'plugins';
      const inst = getInstance(id);
      const dir = path.join(instApi.dirOf(inst), folder);
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(path.join(dir, filename), buf);
      return sendJson(res, 200, { ok: true, folder, filename, size: buf.length });
    }

    // ---------- pacotes instalados ----------
    if (action === 'packages' && method === 'GET') {
      const kind = url.searchParams.get('kind') === 'mod' ? 'mod' : 'plugin';
      return sendJson(res, 200, { packages: await instApi.listPackages(id, kind) });
    }
    if (action === 'packages' && method === 'DELETE') {
      const kind = url.searchParams.get('kind') === 'mod' ? 'mod' : 'plugin';
      return sendJson(res, 200, await instApi.deletePackage(id, kind, url.searchParams.get('name')));
    }

    // ---------- instalar plugin/mod ----------
    if (action === 'install' && method === 'POST') {
      const inst = getInstance(id);
      const body = await jsonBody(req);
      const kind = body.kind === 'mod' ? 'mod' : 'plugin';
      const job = createJob('install-package', `Instalar ${body.projectId || kind}`);
      const dir = instApi.dirOf(inst);
      runJob(job, async (j) => {
        const out = await mrApi.installPackage(inst, dir, { kind, projectId: body.projectId, versionId: body.versionId }, { job: j });
        jobLog(j, `${out.name} ${out.version} → ${out.folder}/`);
        return out;
      }).catch(() => {});
      return sendJson(res, 202, { jobId: job.id });
    }

    // ---------- instalar modpack ----------
    if (action === 'modpack' && method === 'POST') {
      const inst = getInstance(id);
      const body = await jsonBody(req);
      const dir = instApi.dirOf(inst);
      const job = createJob('modpack', `Instalar modpack ${body.versionId || ''}`.trim());
      inst.pending.modpack = job.id;
      putInstance(inst);
      job.onDone = () => {
        inst.pending.modpack = null;
        putInstance(inst);
      };
      runJob(job, async (j) => {
        const report = await mrApi.installModpack(inst, dir, { projectId: body.projectId, versionId: body.versionId }, { job: j });
        putInstance(inst);
        return report;
      }).catch(() => {});
      return sendJson(res, 202, { jobId: job.id });
    }

    // ---------- backups ----------
    if (action === 'backups') {
      const sub = seg[3];
      if (method === 'GET' && !sub) return sendJson(res, 200, { backups: await backupApi.listBackups(id) });
      if (method === 'POST' && !sub) {
        const inst = getInstance(id);
        const job = backupApi.createBackupJob(inst);
        return sendJson(res, 202, { jobId: job.id });
      }
      if (method === 'POST' && sub === 'restore') {
        const body = await jsonBody(req);
        return sendJson(res, 200, await backupApi.restoreBackup(id, body.name));
      }
      if (method === 'GET' && sub === 'download') {
        const info = await backupApi.backupFile(id, url.searchParams.get('name'));
        res.writeHead(200, {
          'Content-Type': 'application/gzip',
          'Content-Length': info.size,
          'Content-Disposition': `attachment; filename="${info.name}"`,
        });
        if (req.method === 'HEAD') return res.end();
        return fs.createReadStream(info.file).pipe(res);
      }
      if (method === 'DELETE' && !sub) {
        return sendJson(res, 200, await backupApi.deleteBackup(id, url.searchParams.get('name')));
      }
      throw new HttpError(404, 'Rota de backup não encontrada.');
    }

    throw new HttpError(404, `Rota não encontrada: /api${raw}`);
  }

  throw new HttpError(404, `Rota não encontrada: /api${raw}`);
}

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------

async function onRequest(req, res) {
  let url;
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  } catch {
    return sendError(res, 400, 'URL inválida.');
  }

  // CORS mínimo (o painel é local; permite abrir o HTML de outro diretório)
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Last-Event-ID');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Método não permitido.');
    await serveStatic(req, res, url);
  } catch (err) {
    if (res.headersSent || res.writableEnded) {
      try {
        res.end();
      } catch {
        /* já morreu */
      }
      return;
    }
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error(`[erro] ${req.method} ${url.pathname}:`, err);
    sendError(res, status, err instanceof HttpError ? err.message : `Erro interno: ${err.message}`, err?.extra || undefined);
  }
}

async function boot() {
  for (const dir of [DATA_DIR, SERVERS_DIR, RUNTIME_DIR, CACHE_DIR]) {
    await fsp.mkdir(dir, { recursive: true });
  }
  await loadState();

  // Jobs morrem com o processo: limpa pendências e marca órfãos.
  let orphans = 0;
  for (const inst of listInstances()) {
    inst.pending = { install: null, start: null, stop: null, reinstall: null, modpack: null, delete: null };
    if (inst.pid) {
      let alive = true;
      try {
        process.kill(inst.pid, 0);
      } catch (err) {
        alive = err.code === 'EPERM'; // existe, mas de outro usuário
      }
      if (alive) orphans++;
      else inst.pid = null;
    }
    putInstance(inst);
  }

  const server = http.createServer((req, res) => {
    onRequest(req, res).catch((err) => {
      console.error('[fatal]', err);
      try {
        sendError(res, 500, 'Erro interno do painel.');
      } catch {
        /* ignore */
      }
    });
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 70000;

  await new Promise((resolve, reject) => {
    server.once('error', (err) => reject(err));
    server.listen(PORT, HOST, resolve);
  });

  const url = `http://${HOST}:${PORT}`;
  console.log('');
  console.log('  ⛏  McPanel v' + PANEL_VERSION);
  console.log(`  ▸ Painel:   ${url}`);
  console.log(`  ▸ Dados:    ${DATA_DIR}`);
  console.log(`  ▸ Node:     ${process.version}  |  Java: (baixado sob demanda)`);
  if (orphans) console.log(`  ⚠ ${orphans} servidor(es) ainda rodando de uma sessão anterior — use "Encerrar processo".`);
  console.log('  ▸ Ctrl+C para parar o painel.');
  console.log('');

  const shutdown = () => {
    console.log('\n[Painel] Encerrando (servidores Minecraft continuam rodando se não forem parados)…');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

boot().catch((err) => {
  console.error('Falha ao iniciar o painel:', err);
  process.exit(1);
});
