// Estado persistente (instâncias) + fila de jobs em memória.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { STATE_FILE } from './config.js';
import { HttpError } from './util.js';

// ---------- Instâncias ----------

let state = { instances: {} };
let saveTimer = null;

export async function loadState() {
  try {
    const raw = JSON.parse((await fs.readFile(STATE_FILE, 'utf8')).replace(/^\uFEFF/, ''));
    state = { instances: raw.instances || {} };
  } catch {
    state = { instances: {} };
  }
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
      await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
      console.error('[store] falha ao salvar state.json:', err.message);
    }
  }, 250);
}

export function listInstances() {
  return Object.values(state.instances).sort((a, b) => b.createdAt - a.createdAt);
}

export function getInstance(id) {
  const inst = state.instances[id];
  if (!inst) throw new HttpError(404, 'Servidor não encontrado.');
  return inst;
}

export function putInstance(inst) {
  state.instances[inst.id] = inst;
  persist();
}

export function removeInstance(id) {
  delete state.instances[id];
  persist();
}

export function newId() {
  return randomBytes(4).toString('hex');
}

// ---------- Jobs (progresso de operações longas) ----------

const jobs = new Map();
let jobSeq = 1;
const JOB_TTL = 15 * 60 * 1000;

export function createJob(type, label) {
  const job = {
    id: `j${jobSeq++}`,
    type,
    label,
    status: 'running', // running | done | error
    progress: null, // 0..1 ou null (indeterminado)
    message: '',
    log: [],
    createdAt: Date.now(),
    doneAt: null,
    result: null,
    error: null,
    onDone: null,
  };
  jobs.set(job.id, job);
  return job;
}

export function jobLog(job, line) {
  const text = typeof line === 'string' ? line : String(line);
  job.log.push(`[${new Date().toLocaleTimeString('pt-BR')}] ${text}`);
  if (job.log.length > 400) job.log.splice(0, job.log.length - 400);
}

export function jobProgress(job, progress, message) {
  if (typeof progress === 'number') job.progress = Math.max(0, Math.min(1, progress));
  if (message) job.message = message;
}

export function finishJob(job, { result = null, error = null } = {}) {
  if (job.status !== 'running') return;
  job.status = error ? 'error' : 'done';
  job.result = result;
  job.error = error ? String(error.message || error) : null;
  job.doneAt = Date.now();
  if (job.error) jobLog(job, `ERRO: ${job.error}`);
  const cb = job.onDone;
  job.onDone = null;
  if (cb) cb(job);
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function listJobs() {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (j.status !== 'running' && now - j.doneAt > JOB_TTL) jobs.delete(id);
  }
  return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
}

// Executa uma tarefa assíncrona como job, tratando erros automaticamente.
export async function runJob(job, fn) {
  try {
    const result = await fn(job);
    finishJob(job, { result });
    return result;
  } catch (err) {
    finishJob(job, { error: err });
    throw err;
  }
}
