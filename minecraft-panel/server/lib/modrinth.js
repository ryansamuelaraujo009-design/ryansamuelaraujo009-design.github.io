// Busca e instalação de plugins, mods e modpacks (Modrinth).
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { fetchJson, HttpError, cached, safePath, fileExists } from './util.js';
import { downloadToFile } from './download.js';
import { extractArchive } from './extract.js';
import { jobLog, jobProgress } from './store.js';
import { installServerJar } from './software.js';

const API = 'https://api.modrinth.com/v2';
export const AUTHME_PROJECT = '9js4IEHC'; // AuthMeReloaded (organização AuthMe)

const KINDS = {
  plugin: { projectType: 'plugin', folder: 'plugins', loaders: ['paper', 'purpur', 'spigot', 'bukkit', 'folia'] },
  mod: { projectType: 'mod', folder: 'mods', loaders: null },
  modpack: { projectType: 'modpack', folder: null, loaders: null },
};

function sanitizeFilename(name) {
  return (
    String(name)
      .replace(/[\\/:*?"<>|\0]/g, '_')
      .replace(/^\.+/, '_')
      .slice(0, 140) || 'arquivo.jar'
  );
}

// ---------- Busca ----------

export async function search(kind, query, mc, limit = 24) {
  const k = KINDS[kind];
  if (!k) throw new HttpError(400, 'Tipo de busca inválido (plugin, mod ou modpack).');
  const facets = [[`project_type:${k.projectType}`]];
  if (mc) facets.push([`versions:${mc}`]);
  if (kind === 'mod') facets.push(['server_side:required', 'server_side:optional']);

  const params = new URLSearchParams();
  params.set('facets', JSON.stringify(facets));
  params.set('limit', String(Math.min(50, limit)));
  if (query && query.trim()) params.set('query', query.trim());
  else params.set('index', 'downloads');

  const url = `${API}/search?${params.toString()}`;
  const data = await cached(url, 60000, () => fetchJson(url));
  return (data.hits || []).map((h) => ({
    id: h.project_id,
    slug: h.slug,
    title: h.title,
    description: h.description,
    icon: h.icon_url,
    downloads: h.downloads,
    author: h.author,
    dateModified: h.date_modified,
    categories: h.display_categories || h.categories || [],
    gameVersions: h.versions || [],
  }));
}

// ---------- Versões de um projeto ----------

async function fetchVersions(url) {
  try {
    const list = await fetchJson(url, { ttl: 60000 });
    return Array.isArray(list) ? list : [];
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return [];
    throw err;
  }
}

function normalizeVersion(v) {
  return {
    id: v.id,
    name: v.name,
    versionNumber: v.version_number,
    loaders: v.loaders || [],
    gameVersions: v.game_versions || [],
    date: v.date_published,
    downloads: v.downloads || 0,
    files: (v.files || []).map((f) => ({ url: f.url, filename: f.filename, primary: !!f.primary, size: f.size })),
    changelog: String(v.changelog || '').slice(0, 1500),
  };
}

export async function projectVersions(projectId, kind, mc) {
  const k = KINDS[kind];
  if (!k) throw new HttpError(400, 'Tipo inválido.');
  let params = new URLSearchParams();
  if (mc) params.set('game_versions', JSON.stringify([mc]));
  const loaders = kind === 'plugin' ? k.loaders : null;
  if (loaders?.length) params.set('loaders', JSON.stringify(loaders));
  const qs = params.toString();

  let list = await fetchVersions(`${API}/project/${encodeURIComponent(projectId)}/version${qs ? `?${qs}` : ''}`);
  if (!list.length && qs) {
    // fallback: sem filtros (o autor pode não ter marcado loaders/versões)
    list = await fetchVersions(`${API}/project/${encodeURIComponent(projectId)}/version`);
  }
  return list.map(normalizeVersion);
}

async function rawVersion(projectId, kind, mc, versionId) {
  if (versionId) {
    try {
      return await fetchJson(`${API}/version/${encodeURIComponent(versionId)}`, { ttl: 60000 });
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) throw new HttpError(404, 'Versão não encontrada no Modrinth.');
      throw err;
    }
  }
  const normalized = await projectVersions(projectId, kind, mc);
  const exact = normalized.find((v) => !mc || v.gameVersions.includes(mc));
  const chosen = exact || normalized[0];
  if (!chosen) throw new HttpError(404, 'Nenhuma versão disponível para este projeto.');
  if (mc && !chosen.gameVersions.includes(mc)) {
    throw new HttpError(409, `A melhor versão é para ${chosen.gameVersions.join(', ')} — não bate com ${mc}. Escolha a versão manualmente.`);
  }
  return { ...chosen, project_id: projectId, files: chosen.files, hashes: null };
}

// ---------- Instalação de plugin/mod ----------

export async function installPackage(inst, dir, { kind, projectId, versionId }, { job = null } = {}) {
  const k = KINDS[kind];
  if (!k || kind === 'modpack') throw new HttpError(400, 'Tipo inválido para instalação (use plugin ou mod).');
  if (!projectId) throw new HttpError(400, 'Projeto não informado.');

  const raw = await rawVersion(projectId, kind, inst.version, versionId);
  const files = raw.files || [];
  const file = files.find((f) => f.primary) || files.find((f) => /\.jar$/i.test(f.filename || '')) || files[0];
  if (!file?.url) throw new HttpError(500, 'Essa versão não tem arquivo para baixar.');

  const folder = path.join(dir, k.folder);
  await fsp.mkdir(folder, { recursive: true });
  const filename = sanitizeFilename(file.filename || `${raw.version_number || 'arquivo'}.jar`);
  const dest = path.join(folder, filename);

  if (job) {
    jobLog(job, `Baixando ${raw.name || filename} (${filename})…`);
    jobProgress(job, null, `Baixando ${filename}…`);
  }
  await downloadToFile(file.url, dest, { job, label: filename, sha1: file.hashes?.sha1 || null });
  if (job) jobLog(job, `${filename} instalado em ${k.folder}/.`);
  return { filename, folder: k.folder, name: raw.name || filename, version: raw.version_number || '' };
}

export async function installAuthMe(inst, dir, opts = {}) {
  return installPackage(inst, dir, { kind: 'plugin', projectId: AUTHME_PROJECT }, opts);
}

// ---------- Instalação de modpack (.mrpack) ----------

export async function installModpack(inst, dir, { projectId, versionId }, { job = null } = {}) {
  if (!['fabric', 'arclight'].includes(inst.software)) {
    throw new HttpError(400, 'Modpacks só rodam em servidores Fabric ou Arclight. Crie o servidor com um desses softwares.');
  }
  if (!versionId) throw new HttpError(400, 'Versão do modpack não informada.');

  const raw = await fetchJson(`${API}/version/${encodeURIComponent(versionId)}`);
  const file = (raw.files || []).find((f) => f.primary) || (raw.files || [])[0];
  if (!file?.url) throw new HttpError(500, 'Modpack sem arquivo.');
  if (!/\.mrpack$/i.test(file.filename || file.url)) {
    throw new HttpError(400, 'Só aceito modpacks .mrpack (exportados do Modrinth). Zips do CurseForge ainda não.');
  }

  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'mcpanel-pack-'));
  try {
    const mrpack = path.join(tmp, 'pack.mrpack');
    if (job) {
      jobLog(job, `Baixando modpack ${raw.name}…`);
      jobProgress(job, null, 'Baixando modpack…');
    }
    await downloadToFile(file.url, mrpack, { job, label: raw.name, sha1: file.hashes?.sha1 || null });

    const extractDir = path.join(tmp, 'x');
    await extractArchive(mrpack, extractDir);

    let index;
    try {
      index = JSON.parse(await fsp.readFile(path.join(extractDir, 'modrinth.index.json'), 'utf8'));
    } catch {
      throw new HttpError(400, 'modrinth.index.json ausente — modpack inválido.');
    }

    const deps = index.dependencies || {};
    if (deps.minecraft && deps.minecraft !== inst.version) {
      throw new HttpError(400, `Esse modpack é para Minecraft ${deps.minecraft}; seu servidor está em ${inst.version}.`);
    }

    let needed = null;
    if (deps['fabric-loader']) needed = 'fabric';
    else if (deps.neoforge) needed = 'neoforge';
    else if (deps.forge) needed = 'forge';
    else throw new HttpError(400, 'Modpack não declara loader (Forge/Fabric/NeoForge).');

    if (inst.software === 'fabric' && needed !== 'fabric') {
      throw new HttpError(
        400,
        `Esse modpack exige ${needed === 'neoforge' ? 'NeoForge' : 'Forge'}. Recrie o servidor como "Arclight" (mods + plugins).`
      );
    }
    if (inst.software === 'arclight' && inst.loader !== needed) {
      if (job) jobLog(job, `Modpack precisa de ${needed} — trocando o build do Arclight…`);
      inst.loader = needed;
      await installServerJar(inst, dir, { job });
    }

    const all = Array.isArray(index.files) ? index.files : [];
    const toDownload = all.filter((f) => !(f.env && f.env.server === 'unsupported'));
    const skipped = all.length - toDownload.length;
    const totalBytes = toDownload.reduce((s, f) => s + (Number(f.fileSize) || 0), 0) || 1;
    let doneBytes = 0;
    let count = 0;
    let failed = 0;

    for (const f of toDownload) {
      const dest = safePath(dir, String(f.path || ''));
      const url = Array.isArray(f.downloads) ? f.downloads[0] : null;
      if (!url || !f.path) {
        if (job) jobLog(job, `Sem fonte de download para ${f.path || '?'} — pulando.`);
        continue;
      }
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      try {
        await downloadToFile(url, dest, { label: String(f.path) });
      } catch (err) {
        failed++;
        if (job) jobLog(job, `Aviso: falhou em ${f.path} (${err.message})`);
      }
      doneBytes += Number(f.fileSize) || 0;
      count++;
      if (job) jobProgress(job, doneBytes / totalBytes, `Instalando arquivos ${count}/${toDownload.length}`);
    }

    let overrides = 0;
    for (const ov of ['server-overrides', 'overrides']) {
      const src = path.join(extractDir, ov);
      if (await fileExists(src)) {
        await fsp.cp(src, dir, { recursive: true, force: true });
        overrides++;
      }
    }

    inst.modpack = { name: raw.name, versionId: raw.id, projectId: raw.project_id || projectId || null, installedAt: Date.now() };
    const report = { files: count, overrides, skipped, failed, name: raw.name };
    if (job) {
      jobLog(
        job,
        `Modpack instalado: ${count} arquivo(s), ${overrides} pasta(s) de overrides` +
          (skipped ? `, ${skipped} só-de-cliente ignorados` : '') +
          (failed ? `, ${failed} falha(s)` : '') +
          '.'
      );
      if (inst.software === 'arclight' && !inst.version.startsWith('1.')) {
        /* nada — só registro */
      }
      jobLog(job, 'Dica: os JOGADORES precisam ter o mesmo modpack instalado no cliente.');
    }
    return report;
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
