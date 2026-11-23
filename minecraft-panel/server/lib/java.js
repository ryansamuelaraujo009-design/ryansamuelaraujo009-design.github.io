// Java: detecção do sistema + provisionamento automático de JRE (Adoptium, sem admin).
import path from 'node:path';
import fsp from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { CACHE_DIR, RUNTIME_DIR } from './config.js';
import { fetchJson, HttpError, fmtBytes } from './util.js';
import { downloadToFile } from './download.js';
import { extractArchive } from './extract.js';
import { jobLog, jobProgress } from './store.js';

const ADOPTIUM_ASSETS = (major) =>
  `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?os=windows&architecture=x64&image_type=jre&heap_size=normal`;

function parseVersion(text) {
  const m = text.match(/version "([^"]+)"/);
  if (!m) return null;
  const parts = m[1].split('.');
  const major = parts[0] === '1' ? Number(parts[1]) : Number(parts[0]);
  return Number.isFinite(major) ? { major, version: m[1] } : null;
}

export function probeJava(javaPath) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(javaPath, ['-version'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      resolve(null);
      return;
    }
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      if (code !== 0) return resolve(null);
      const parsed = parseVersion(out);
      resolve(parsed ? { path: javaPath, major: parsed.major, version: parsed.version } : null);
    });
  });
}

async function findJavaExe(root) {
  try {
    const entries = await fsp.readdir(root, { recursive: true, withFileTypes: true });
    const hits = entries
      .filter((e) => e.isFile() && e.name === 'java.exe' && path.basename(e.parentPath || e.path || '') === 'bin')
      .map((e) => path.join(e.parentPath || e.path, e.name))
      .sort((a, b) => a.length - b.length);
    return hits[0] || null;
  } catch {
    return null;
  }
}

const probeCache = new Map(); // path → {exp, info}
async function cachedProbe(p, ttl = 5 * 60 * 1000) {
  const hit = probeCache.get(p);
  if (hit && hit.exp > Date.now()) return hit.info;
  const info = await probeJava(p);
  probeCache.set(p, { exp: Date.now() + ttl, info });
  return info;
}

export async function detectSystemJava() {
  const candidates = [];
  if (process.env.JAVA_HOME) candidates.push(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'));
  candidates.push('java');
  for (const c of candidates) {
    const info = await cachedProbe(c);
    if (info) return info;
  }
  return null;
}

export async function runtimeJava(major) {
  const exe = await findJavaExe(path.join(RUNTIME_DIR, `java${major}`));
  if (!exe) return null;
  return cachedProbe(exe);
}

// Versão mínima de Java exigida por uma versão do Minecraft.
export function javaMajorFor(mcVersion) {
  const major = parseInt(String(mcVersion).split('.')[0], 10);
  return major >= 26 ? 25 : 21;
}

export function isLegacyVersion(mcVersion) {
  const m = String(mcVersion).match(/^(\d+)\.(\d+)/);
  if (!m) return false;
  return Number(m[1]) === 1 && Number(m[2]) < 17;
}

export async function ensureJava(major, job = null) {
  const existing = await runtimeJava(major);
  if (existing) return existing;

  const assets = await fetchJson(ADOPTIUM_ASSETS(major));
  const pkg = assets?.[0]?.binary?.package;
  if (!pkg?.link) throw new HttpError(502, `Não encontrei um JRE ${major} (Windows x64) no Adoptium.`);

  const zipName = path.basename(new URL(pkg.link).pathname);
  const zip = path.join(CACHE_DIR, zipName);
  if (job) {
    jobLog(job, `Baixando Java ${major} (${fmtBytes(pkg.size)}) — primeira vez só…`);
    jobProgress(job, null, `Baixando Java ${major}…`);
  }
  await downloadToFile(pkg.link, zip, { job, label: `Java ${major}`, sha256: pkg.checksum });

  const dest = path.join(RUNTIME_DIR, `java${major}`);
  await fsp.rm(dest, { recursive: true, force: true });
  await fsp.mkdir(dest, { recursive: true });
  if (job) jobProgress(job, null, `Extraindo Java ${major}…`);
  await extractArchive(zip, dest);
  await fsp.rm(zip, { force: true }).catch(() => {});

  const exe = await findJavaExe(dest);
  if (!exe) throw new HttpError(500, `Extraí o JRE ${major}, mas não encontrei java.exe em ${dest}.`);
  const info = await probeJava(exe);
  if (!info) throw new HttpError(500, `O java.exe baixado (${major}) não executa nesta máquina.`);
  probeCache.set(exe, { exp: Date.now() + 5 * 60 * 1000, info });
  if (job) jobLog(job, `Java ${major} pronto: ${info.version}`);
  return info;
}

// Escolhe (e baixa se preciso) o Java adequado para a versão do Minecraft.
export async function resolveJava(mcVersion, job = null) {
  const need = javaMajorFor(mcVersion);
  const rt = await runtimeJava(need);
  if (rt) return rt;
  const sys = await detectSystemJava();
  if (sys && sys.major >= need) return sys;
  if (sys && job) jobLog(job, `Java do sistema é ${sys.major}; o servidor precisa de ${need}.`);
  return ensureJava(need, job);
}

export async function javaStatus() {
  const [rt21, rt25, system] = await Promise.all([runtimeJava(21), runtimeJava(25), detectSystemJava()]);
  return { runtimes: { 21: rt21, 25: rt25 }, system };
}
