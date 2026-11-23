// Utilidades: HTTP, caminhos seguros, hash, cache e fetch com User-Agent.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export class HttpError extends Error {
  constructor(status, message, extra = null) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// ---------- HTTP ----------

export function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function sendError(res, status, message, extra) {
  sendJson(res, status, { error: message, ...(extra ? { extra } : {}) });
}

export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, 'Arquivo grande demais para o limite do painel.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req, limit = 1024 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new HttpError(400, 'JSON inválido.');
  }
}

// ---------- Caminhos ----------

// Resolve um caminho vindo do usuário DENTRO de `base`. Lança HttpError se escapar.
export function safePath(base, userPath = '') {
  if (userPath == null) userPath = '';
  const clean = String(userPath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (clean.includes('\0')) throw new HttpError(400, 'Caminho inválido.');
  const resolved = path.resolve(base, clean);
  const root = path.resolve(base);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new HttpError(400, 'Caminho fora do diretório do servidor.');
  }
  return resolved;
}

export function slugify(name) {
  const slug = String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'server';
}

export async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ---------- Hash / formatação ----------

export async function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (d) => hash.update(d))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

export function fmtBytes(n) {
  if (n == null || Number.isNaN(n)) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = Number(n);
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fmtDuration(ms) {
  if (ms == null || ms < 0) return '-';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// ---------- Cache em memória (listas de versão, buscas) ----------

const cache = new Map();

export async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.data;
  const data = await fn();
  cache.set(key, { exp: Date.now() + ttlMs, data });
  return data;
}

export async function readJsonCacheFile(file, ttlMs) {
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs < ttlMs) return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    /* não existe ou inválido: refaz */
  }
  return null;
}

export async function writeJsonCacheFile(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data));
}

// ---------- Fetch ----------

const UA = 'McPanel/1.0 (painel local de servidores Minecraft; node-fetch)';

export async function fetchJson(url, { ttl = null, headers = {} } = {}) {
  const doFetch = async () => {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/json', ...headers },
    });
    if (!res.ok) throw new HttpError(res.status === 404 ? 404 : 502, `Falha ao consultar ${new URL(url).host} (HTTP ${res.status}).`);
    return res.json();
  };
  if (ttl) return cached(url, ttl, doFetch);
  return doFetch();
}

export async function fetchBuffer(url, { onProgress = null, headers = {} } = {}) {
  const res = await fetch(url, { headers: { 'user-agent': UA, ...headers }, redirect: 'follow' });
  if (!res.ok) throw new HttpError(res.status === 404 ? 404 : 502, `Download falhou (HTTP ${res.status}): ${url}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body) return Buffer.from(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
    received += value.length;
    if (onProgress) onProgress(received, total);
  }
  return Buffer.concat(chunks, received);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
