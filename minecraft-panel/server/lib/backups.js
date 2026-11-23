// Backups: cria, lista, restaura e exclui .tar.gz por servidor.
import path from 'node:path';
import fsp from 'node:fs/promises';
import { HttpError, safePath } from './util.js';
import { extractArchive, compressDir } from './extract.js';
import { getInstance } from './store.js';
import { dirOf, statusOf } from './instance.js';
import { jobLog, jobProgress } from './store.js';

const NAME_RE = /^backup-[\d-]+_[\d-]+\.tar\.gz$/;

function backupsDir(inst) {
  return path.join(dirOf(inst), 'backups');
}

function validName(name) {
  const n = String(name || '');
  if (!NAME_RE.test(n)) throw new HttpError(400, 'Nome de backup inválido.');
  return n;
}

export async function listBackups(id) {
  const inst = getInstance(id);
  let entries = [];
  try {
    entries = await fsp.readdir(backupsDir(inst), { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.tar.gz')) continue;
    try {
      const st = await fsp.stat(path.join(backupsDir(inst), e.name));
      out.push({ name: e.name, size: st.size, mtime: st.mtimeMs });
    } catch {
      /* ignore */
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

export function createBackupJob(inst) {
  const dir = dirOf(inst);
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const name = `backup-${stamp}.tar.gz`;
  const job = createJobLike(`Backup de ${inst.name}`);
  runJobLike(job, async (j) => {
    if (statusOf(inst) === 'running') {
      throw new HttpError(409, 'Pare o servidor antes de criar um backup (mundo precisa estar salvo).');
    }
    jobLog(j, `Compactando ${path.basename(dir)}…`);
    jobProgress(j, null, 'Compactando arquivos…');
    await compressDir(dir, path.join(backupsDir(inst), name), ['backups']);
    const st = await fsp.stat(path.join(backupsDir(inst), name));
    jobLog(j, `Backup criado: ${name} (${(st.size / 1024 / 1024).toFixed(1)} MB)`);
    return { name, size: st.size };
  });
  return job;
}

export async function restoreBackup(id, name) {
  const inst = getInstance(id);
  const n = validName(name);
  if (statusOf(inst) === 'running') throw new HttpError(409, 'Pare o servidor antes de restaurar.');
  const file = path.join(backupsDir(inst), n);
  try {
    await fsp.access(file);
  } catch {
    throw new HttpError(404, 'Backup não encontrado.');
  }
  const dir = dirOf(inst);
  // preserva o jar atual: extrai por cima (mundos e configs são substituídos)
  await extractArchive(file, dir);
  return { ok: true };
}

export async function deleteBackup(id, name) {
  const inst = getInstance(id);
  const n = validName(name);
  const file = safePath(backupsDir(inst), n);
  try {
    await fsp.rm(file, { force: true });
  } catch (err) {
    throw new HttpError(500, `Falha ao excluir: ${err.message}`);
  }
  return { ok: true };
}

export async function backupFile(id, name) {
  const inst = getInstance(id);
  const n = validName(name);
  const file = path.join(backupsDir(inst), n);
  try {
    const st = await fsp.stat(file);
    return { file, size: st.size, name: n };
  } catch {
    throw new HttpError(404, 'Backup não encontrado.');
  }
}

// Pontes para criar jobs aqui sem circular import (store já é leve).
import { createJob, runJob } from './store.js';
function createJobLike(label) {
  return createJob('backup', label);
}
function runJobLike(job, fn) {
  return runJob(job, fn).catch(() => {});
}
