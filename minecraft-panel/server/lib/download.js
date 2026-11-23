// Downloads com progresso (para jobs) + verificação de hash.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { fetchBuffer, HttpError } from './util.js';

const UA = 'McPanel/1.0 (painel local de servidores Minecraft; node)';

// Baixa `url` para `dest` (via arquivo .part, renomeia no fim).
// opts: { job, label, sha256, sha1, onProgress(received,total) }
export async function downloadToFile(url, dest, opts = {}) {
  const { job = null, label = '', sha256 = null, sha1 = null, onProgress = null } = opts;
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;

  const report = (received, total) => {
    if (onProgress) onProgress(received, total);
    if (job && total > 0) {
      const pct = received / total;
      jobProgressSafe(job, pct, `${label} — ${pcted(received)} de ${pcted(total)}`);
    }
  };

  const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
  if (!res.ok) {
    throw new HttpError(res.status === 404 ? 404 : 502, `Download falhou (HTTP ${res.status}): ${label || url}`);
  }
  const total = Number(res.headers.get('content-length')) || 0;

  const hash = sha256 ? createHash('sha256') : sha1 ? createHash('sha1') : null;
  let received = 0;
  let lastReport = 0;

  const out = fs.createWriteStream(part);
  const body = Readable.fromWeb(res.body);

  body.on('data', (chunk) => {
    received += chunk.length;
    if (hash) hash.update(chunk);
    const now = Date.now();
    if (now - lastReport > 400 || received === total) {
      lastReport = now;
      report(received, total);
    }
  });

  try {
    await pipeline(body, out);
  } catch (err) {
    await fsp.rm(part, { force: true });
    throw new HttpError(502, `Download interrompido: ${err.message}`);
  }

  if (hash) {
    const digest = hash.digest('hex');
    const expected = (sha256 || sha1).toLowerCase();
    if (digest !== expected) {
      await fsp.rm(part, { force: true });
      throw new HttpError(502, `Checksum inválido em ${label || url} (esperado ${expected.slice(0, 12)}…, obtido ${digest.slice(0, 12)}…).`);
    }
  }

  await fsp.rename(part, dest).catch(async (err) => {
    // Windows não sobrescreve via rename — remove o destino antes
    if (err.code === 'EEXIST' || err.code === 'EPERM') {
      await fsp.rm(dest, { force: true });
      await fsp.rename(part, dest);
    } else {
      throw err;
    }
  });
  report(received, total || received);
  return { bytes: received, dest };
}

// Para URLs sem Content-Length, um fallback simples em buffer.
export async function downloadBufferToFile(url, dest, opts = {}) {
  const buf = await fetchBuffer(url, {
    onProgress: opts.onProgress,
  });
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.writeFile(dest, buf);
  if (opts.job) jobProgressSafe(opts.job, 1, opts.label || 'concluído');
  return { bytes: buf.length, dest };
}

function jobProgressSafe(job, progress, message) {
  job.progress = Math.max(0, Math.min(1, progress));
  if (message) job.message = message;
}

function pcted(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
