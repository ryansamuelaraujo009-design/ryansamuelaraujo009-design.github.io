// Ciclo de vida dos servidores: criação, start/stop, console, players, arquivos e pacotes.
import path from 'node:path';
import fsp from 'node:fs/promises';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { randomBytes } from 'node:crypto';
import { SERVERS_DIR, MIN_RAM, MAX_RAM, DEFAULT_RAM } from './config.js';
import { HttpError, safePath, fileExists, sleep } from './util.js';
import { listInstances, getInstance, putInstance, removeInstance, newId, createJob, runJob, finishJob, getJob, jobLog, jobProgress } from './store.js';
import { installServerJar, SOFTWARE } from './software.js';
import { resolveJava, isLegacyVersion } from './java.js';
import { pushLine, getLines } from './console.js';
import { rconExec } from './rcon.js';
import { installAuthMe } from './modrinth.js';

const running = new Map(); // id → { proc, startedAt }
const aliveCache = new Map(); // pid → { exp, alive }

const GAMEMODES = ['survival', 'creative', 'adventure', 'spectator'];
const DIFFICULTIES = ['peaceful', 'easy', 'normal', 'hard'];
const PLUGIN_SOFT = ['paper', 'purpur', 'arclight'];
const MOD_SOFT = ['fabric', 'arclight'];

export function dirOf(inst) {
  return path.join(SERVERS_DIR, inst.id);
}

function clampInt(v, min, max, dflt) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

function pidAlive(pid) {
  if (!pid) return false;
  const hit = aliveCache.get(pid);
  if (hit && hit.exp > Date.now()) return hit.alive;
  let alive = true;
  try {
    process.kill(pid, 0);
  } catch (err) {
    alive = err.code === 'EPERM';
  }
  aliveCache.set(pid, { exp: Date.now() + 4000, alive });
  return alive;
}

function activeJob(jid) {
  const j = jid && getJob(jid);
  return j && j.status === 'running' ? j : null;
}

function erroredJob(jid) {
  const j = jid && getJob(jid);
  return j && j.status === 'error' ? j : null;
}

export function statusOf(inst) {
  const p = inst.pending || {};
  if (activeJob(p.delete)) return 'deleting';
  if (activeJob(p.install) || activeJob(p.reinstall) || activeJob(p.modpack)) return 'installing';
  if (activeJob(p.start)) return 'starting';
  if (activeJob(p.stop)) return 'stopping';
  if (running.has(inst.id)) return 'running';
  if (inst.pid && pidAlive(inst.pid)) return 'orphan';
  if (erroredJob(p.install) || erroredJob(p.reinstall) || erroredJob(p.modpack)) return 'error';
  return 'stopped';
}

export function serialize(inst) {
  const rt = running.get(inst.id);
  const sw = SOFTWARE[inst.software] || { name: inst.software, supports: {} };
  const installErr = erroredJob(inst.pending?.install) || erroredJob(inst.pending?.reinstall) || erroredJob(inst.pending?.modpack);
  const startErr = erroredJob(inst.pending?.start);
  return {
    id: inst.id,
    name: inst.name,
    software: inst.software,
    softwareName: sw.name,
    version: inst.version,
    loader: inst.loader || null,
    loaderVersion: inst.loaderVersion || null,
    ram: inst.ram,
    port: inst.port,
    maxPlayers: inst.maxPlayers,
    gamemode: inst.gamemode,
    difficulty: inst.difficulty,
    onlineMode: inst.onlineMode,
    motd: inst.motd,
    whitelist: inst.whitelist,
    createdAt: inst.createdAt,
    serverJar: inst.serverJar || null,
    modpack: inst.modpack || null,
    pid: rt?.proc.pid || (inst.pid && pidAlive(inst.pid) ? inst.pid : null),
    status: statusOf(inst),
    startedAt: rt ? rt.startedAt : null,
    uptimeMs: rt ? Date.now() - rt.startedAt : null,
    dir: dirOf(inst),
    supports: sw.supports || {},
    legacyWarning: isLegacyVersion(inst.version),
    error: installErr ? installErr.error : startErr ? startErr.error : null,
  };
}

// ---------- server.properties ----------

export async function readProps(dir) {
  try {
    const text = await fsp.readFile(path.join(dir, 'server.properties'), 'utf8');
    const props = {};
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('!')) continue;
      const i = t.indexOf('=');
      if (i < 0) continue;
      props[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
    return props;
  } catch {
    return {};
  }
}

export async function writeProps(dir, props) {
  const lines = Object.entries(props).map(([k, v]) => `${k}=${v}`);
  await fsp.writeFile(path.join(dir, 'server.properties'), lines.join('\n') + '\n');
}

function buildProps(inst) {
  return {
    'motd': inst.motd,
    'server-port': String(inst.port),
    'online-mode': String(inst.onlineMode),
    'gamemode': inst.gamemode,
    'difficulty': inst.difficulty,
    'max-players': String(inst.maxPlayers),
    'white-list': String(inst.whitelist),
    'enable-rcon': 'true',
    'rcon.port': String(inst.rcon.port),
    'rcon.password': inst.rcon.password,
    'broadcast-rcon-to-ops': 'false',
    'level-name': 'world',
    'server-ip': '',
    'view-distance': String(inst.viewDistance || 6),
    'simulation-distance': '4',
    'spawn-protection': '16',
    'allow-flight': 'false',
    'enable-command-block': 'false',
    'pvp': 'true',
    'spawn-npcs': 'true',
    'spawn-animals': 'true',
    'spawn-monsters': 'true',
    'generate-structures': 'true',
    'motd': inst.motd,
  };
}

function pickRconPort(others) {
  const used = new Set();
  for (const i of others) {
    used.add(i.port);
    if (i.rcon?.port) used.add(i.rcon.port);
  }
  for (;;) {
    const p = 20000 + Math.floor(Math.random() * 30000);
    if (!used.has(p) && p !== 25565) return p;
  }
}

// ---------- Criação ----------

export async function create(input) {
  const name = String(input.name || '').trim();
  if (!name || name.length > 40) throw new HttpError(400, 'Informe um nome de 1 a 40 caracteres.');
  const software = String(input.software || '');
  if (!SOFTWARE[software]) throw new HttpError(400, 'Software inválido.');
  const version = String(input.version || '').trim();
  if (!version) throw new HttpError(400, 'Escolha a versão do Minecraft.');
  if (!input.eula) throw new HttpError(400, 'É preciso aceitar o EULA da Mojang para criar o servidor.');

  const ram = clampInt(input.ram, MIN_RAM, MAX_RAM, DEFAULT_RAM);
  const port = clampInt(input.port, 1, 65535, 25565);
  const maxPlayers = clampInt(input.maxPlayers, 1, 500, 10);
  const gamemode = GAMEMODES.includes(input.gamemode) ? input.gamemode : 'survival';
  const difficulty = DIFFICULTIES.includes(input.difficulty) ? input.difficulty : 'normal';
  const onlineMode = input.onlineMode !== false;
  const whitelist = !!input.whitelist;
  const motd = String(input.motd || name).slice(0, 80);
  const viewDistance = clampInt(input.viewDistance, 2, 32, 6);

  const others = listInstances();
  if (others.some((i) => i.port === port)) throw new HttpError(400, `A porta ${port} já está em uso por outro servidor.`);
  if (others.some((i) => i.name.toLowerCase() === name.toLowerCase())) throw new HttpError(400, 'Já existe um servidor com esse nome.');

  const inst = {
    id: newId(),
    name,
    software,
    version,
    ram,
    port,
    maxPlayers,
    gamemode,
    difficulty,
    onlineMode,
    whitelist,
    motd,
    viewDistance,
    loader: software === 'arclight' ? (['forge', 'neoforge', 'fabric'].includes(input.loader) ? input.loader : 'forge') : software === 'fabric' ? 'fabric' : null,
    loaderVersion: software === 'fabric' ? String(input.loaderVersion || '').trim() || null : null,
    rcon: { port: pickRconPort(others), password: randomBytes(12).toString('hex') },
    eula: true,
    serverJar: null,
    modpack: null,
    pid: null,
    autoStart: !!input.autoStart,
    createdAt: Date.now(),
    pending: { install: null, start: null, stop: null, reinstall: null, modpack: null, delete: null },
  };

  const dir = dirOf(inst);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, 'eula.txt'), 'eula=true\n');
  await writeProps(dir, buildProps(inst));
  await fsp.mkdir(path.join(dir, 'plugins'), { recursive: true });
  await fsp.mkdir(path.join(dir, 'mods'), { recursive: true });

  const job = createJob('install', `Instalar ${name}`);
  inst.pending.install = job.id;
  putInstance(inst);
  job.onDone = () => {
    inst.pending.install = null;
    putInstance(inst);
    if (job.status === 'done' && inst.autoStart) {
      try {
        start(inst.id);
      } catch {
        /* já rodando ou inválido — estado já está visível no painel */
      }
    }
  };

  runJob(job, async (j) => {
    jobLog(j, `Criando servidor "${name}" — ${SOFTWARE[software].name} ${version}…`);
    if (isLegacyVersion(version)) {
      jobLog(j, `Aviso: ${version} é antiga (pré-1.17) e pode não rodar com Java moderno.`);
    }
    await installServerJar(inst, dir, { job: j });
    putInstance(inst);

    if (!onlineMode && PLUGIN_SOFT.includes(software) && input.installAuthMe !== false) {
      try {
        jobLog(j, 'Modo aberto (original + pirata) — instalando AuthMe para proteger o login dos jogadores…');
        await installAuthMe(inst, dir, { job: j });
      } catch (err) {
        jobLog(j, `Aviso: AuthMe não pôde ser instalado agora (${err.message}). Instale depois na aba Plugins.`);
      }
    }
    if (!onlineMode && !PLUGIN_SOFT.includes(software)) {
      jobLog(j, 'Aviso: modo aberto sem plugins — não há AuthMe para Fabric/Vanilla. Considere um proxy de autenticação.');
    }
    jobLog(j, 'Instalação concluída. Clique em Iniciar.');
    return { id: inst.id };
  }).catch(() => {});

  return { inst, job };
}

// ---------- Start / Stop ----------

function jvmFlags(ramMB) {
  const direct = Math.max(256, Math.min(1024, Math.round(ramMB / 2)));
  return [
    `-Xms${ramMB}M`,
    `-Xmx${ramMB}M`,
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+AlwaysPreTouch',
    '-XX:NewRatio=2',
    '-XX:MinHeapDeltaBytes=1048576',
    '-XX:G1NewSizePercent=30',
    '-XX:G1MaxNewSizePercent=40',
    '-XX:G1HeapRegionSize=8M',
    '-XX:G1ReservePercent=20',
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    '-XX:InitiatingHeapOccupancyPercent=15',
    '-XX:G1MixedGCLiveThresholdPercent=90',
    '-XX:+UseStringDeduplication',
    `-XX:MaxDirectMemorySize=${direct}M`,
    '-Dusing.aikars.flags=https://mcflags.emc.gs',
    '-Daikars.new.flags=true',
  ];
}

function attachOutput(inst, proc) {
  for (const [stream, src] of [
    [proc.stdout, 'out'],
    [proc.stderr, 'err'],
  ]) {
    const rl = readline.createInterface({ input: stream, terminal: false });
    rl.on('line', (line) => pushLine(inst.id, line, src));
  }
}

function waitForDone(id, timeoutMs, exited) {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (exited()) {
        clearInterval(timer);
        return resolve(false);
      }
      const lines = getLines(id, 0, 5000);
      if (lines.some((l) => /\bDone \(/.test(l.text))) {
        clearInterval(timer);
        return resolve(true);
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        return resolve(false);
      }
    }, 500);
  });
}

async function startInternal(inst, job) {
  if (running.has(inst.id)) throw new HttpError(409, 'Servidor já está rodando.');
  const dir = dirOf(inst);
  if (!inst.serverJar || !(await fileExists(path.join(dir, inst.serverJar)))) {
    throw new HttpError(409, 'O arquivo do servidor não existe. Use "Reinstalar".');
  }
  await fsp.writeFile(path.join(dir, 'eula.txt'), 'eula=true\n');

  const java = await resolveJava(inst.version, job);
  jobLog(job, `Java: ${java.path} (${java.version})`);

  const args = [...jvmFlags(inst.ram), '-jar', inst.serverJar, 'nogui'];
  jobLog(job, `Executando: java ${args.join(' ')}`);
  if (inst.port === 25565) {
    jobLog(job, `Dica: deixe o Firewall do Windows liberar a porta ${inst.port} (java.exe) para outros entrarem.`);
  }

  // detached (Windows): o processo do servidor cria seu próprio grupo e
  // SOBREVIVE ao fechar o painel (aí ele aparece como "processo órfão").
  const proc = spawn(java.path, args, {
    cwd: dir,
    windowsHide: true,
    detached: process.platform === 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  running.set(inst.id, { proc, startedAt: Date.now() });
  inst.pid = proc.pid;
  putInstance(inst);
  attachOutput(inst, proc);

  proc.on('error', (err) => {
    pushLine(inst.id, `[Painel] Falha ao executar o Java: ${err.message}`, 'err');
    running.delete(inst.id);
    aliveCache.delete(proc.pid);
    inst.pid = null;
    putInstance(inst);
  });
  proc.on('close', (code, signal) => {
    pushLine(inst.id, `[Painel] Servidor finalizado (código ${code}${signal ? `, sinal ${signal}` : ''}).`, 'sys');
    running.delete(inst.id);
    aliveCache.delete(proc.pid);
    if (inst.pid === proc.pid) inst.pid = null;
    putInstance(inst);
  });

  const done = await waitForDone(inst.id, 240000, () => !running.has(inst.id));
  if (!running.has(inst.id)) {
    const tail = getLines(inst.id, 0, 5000)
      .slice(-12)
      .map((l) => l.text)
      .join('\n');
    throw new HttpError(500, `O servidor encerrou antes de terminar de iniciar:\n${tail}`);
  }
  if (done) jobLog(job, 'Servidor iniciado com sucesso!');
  else jobLog(job, 'Aviso: "Done" não apareceu em 4 minutos — pode estar gerando o mundo. Acompanhe o console.');
}

function beginJob(type, label, inst, key, fn) {
  const job = createJob(type, label);
  inst.pending[key] = job.id;
  putInstance(inst);
  runJob(job, fn).catch(() => {});
  return job;
}

export function start(id) {
  const inst = getInstance(id);
  const st = statusOf(inst);
  if (st === 'running') throw new HttpError(409, 'Servidor já está rodando.');
  if (st === 'orphan') {
    throw new HttpError(409, 'Existe um processo antigo deste servidor (o painel foi reiniciado). Use "Encerrar processo" antes de iniciar.');
  }
  if (st === 'installing') throw new HttpError(409, 'A instalação ainda está em andamento.');
  if (st === 'deleting') throw new HttpError(409, 'O servidor está sendo excluído.');
  if (activeJob(inst.pending?.start)) throw new HttpError(409, 'Já há uma tentativa de início em andamento.');
  return beginJob('start', `Iniciar ${inst.name}`, inst, 'start', (j) => startInternal(inst, j));
}

async function stopInternal(inst) {
  const rt = running.get(inst.id);
  if (!rt) return false;
  pushLine(inst.id, '[Painel] Enviando "stop" (salvando o mundo)…', 'sys');
  try {
    rt.proc.stdin.write('stop\n');
  } catch {
    /* stdin já fechado — vai para o kill */
  }
  const t0 = Date.now();
  while (running.has(inst.id) && Date.now() - t0 < 45000) await sleep(300);
  if (running.has(inst.id)) {
    pushLine(inst.id, '[Painel] Não parou sozinho — forçando encerramento.', 'sys');
    try {
      rt.proc.kill();
    } catch {
      /* já morreu */
    }
    const t1 = Date.now();
    while (running.has(inst.id) && Date.now() - t1 < 8000) await sleep(300);
    if (running.has(inst.id)) throw new HttpError(500, 'Não consegui encerrar o processo. Finalize o java no Gerenciador de Tarefas.');
  }
  return true;
}

export function stop(id) {
  const inst = getInstance(id);
  if (!running.has(inst.id)) {
    if (inst.pid && pidAlive(inst.pid)) {
      // processo órfão: encerra gracioso (RCON stop) e limpa o pid
      return killOrphan(id);
    }
    const job = createJob('stop', `Parar ${inst.name}`);
    finishJob(job, { result: { already: true } });
    return job;
  }
  return beginJob('stop', `Parar ${inst.name}`, inst, 'stop', async (j) => {
    const stopped = await stopInternal(inst);
    jobLog(j, stopped ? 'Servidor parado com segurança.' : 'Já estava parado.');
    return { stopped };
  });
}

export function restart(id) {
  const inst = getInstance(id);
  if (statusOf(inst) === 'installing') throw new HttpError(409, 'A instalação está em andamento.');
  return beginJob('restart', `Reiniciar ${inst.name}`, inst, 'start', async (j) => {
    if (running.has(inst.id)) {
      jobLog(j, 'Parando o servidor…');
      await stopInternal(inst);
    }
    jobLog(j, 'Iniciando de novo…');
    await startInternal(inst, j);
  });
}

export function reinstall(id) {
  const inst = getInstance(id);
  if (running.has(inst.id)) throw new HttpError(409, 'Pare o servidor antes de reinstalar.');
  if (statusOf(inst) === 'deleting') throw new HttpError(409, 'O servidor está sendo excluído.');
  return beginJob('reinstall', `Reinstalar ${inst.name}`, inst, 'reinstall', async (j) => {
    const dir = dirOf(inst);
    jobLog(j, `Reinstalando ${SOFTWARE[inst.software].name} ${inst.version}…`);
    await installServerJar(inst, dir, { job: j });
    putInstance(inst);
    jobLog(j, 'Reinstalado.');
  });
}

export function killOrphan(id) {
  const inst = getInstance(id);
  if (!inst.pid) throw new HttpError(404, 'Nenhum processo registrado.');
  const alive = pidAlive(inst.pid);
  return beginJob('stop', `Encerrar processo antigo de ${inst.name}`, inst, 'stop', async (j) => {
    const pid = inst.pid;
    if (!alive) {
      jobLog(j, 'Processo já não existe.');
      inst.pid = null;
      putInstance(inst);
      return { killed: false };
    }
    // 1) tenta parada graciosa via RCON (salva o mundo)
    jobLog(j, `Tentando parada limpa via RCON (pid ${pid})…`);
    try {
      await rconExec({ port: inst.rcon.port, password: inst.rcon.password, command: 'stop', timeout: 5000 });
      const t0 = Date.now();
      while (Date.now() - t0 < 45000) {
        if (!pidAlive(pid)) break;
        await sleep(400);
      }
      if (!pidAlive(pid)) {
        jobLog(j, 'Servidor encerrou com segurança (mundo salvo).');
        inst.pid = null;
        putInstance(inst);
        return { killed: true, graceful: true };
      }
      jobLog(j, 'RCON aceitou, mas não saiu em 45s — forçando.');
    } catch (err) {
      jobLog(j, `RCON indisponível (${err.message}) — forçando encerramento.`);
    }
    // 2) kill
    try {
      process.kill(pid);
    } catch (err) {
      if (err.code !== 'ESRCH') throw new HttpError(500, `Falha ao encerrar: ${err.message}`);
    }
    const t1 = Date.now();
    while (Date.now() - t1 < 10000) {
      if (!pidAlive(pid)) break;
      await sleep(300);
    }
    if (pidAlive(pid)) throw new HttpError(500, 'Processo não saiu. Finalize o java no Gerenciador de Tarefas.');
    aliveCache.delete(pid);
    pushLine(inst.id, `[Painel] Processo antigo ${pid} encerrado.`, 'sys');
    inst.pid = null;
    putInstance(inst);
    jobLog(j, 'Processo encerrado.');
    return { killed: true, graceful: false };
  });
}

export function remove(id) {
  const inst = getInstance(id);
  return beginJob('delete', `Excluir ${inst.name}`, inst, 'delete', async (j) => {
    if (running.has(inst.id)) {
      jobLog(j, 'Parando o servidor antes de excluir…');
      await stopInternal(inst);
    }
    if (inst.pid && pidAlive(inst.pid)) {
      jobLog(j, 'Encerrando processo antigo…');
      try {
        process.kill(inst.pid);
      } catch {
        /* ignore */
      }
      await sleep(500);
    }
    const dir = dirOf(inst);
    jobLog(j, `Apagando ${dir}…`);
    await fsp.rm(dir, { recursive: true, force: true, maxRetries: 3 });
    removeInstance(id);
    jobLog(j, 'Servidor excluído.');
    return { deleted: true };
  });
}

// ---------- Atualizações ----------

function validatePort(port, inst) {
  const p = clampInt(port, 1, 65535, inst.port);
  if (p !== inst.port && listInstances().some((i) => i.id !== inst.id && i.port === p)) {
    throw new HttpError(400, `A porta ${p} já está em uso por outro servidor.`);
  }
  return p;
}

export async function update(id, input) {
  const inst = getInstance(id);
  if (running.has(inst.id) && (input.port != null || input.onlineMode != null)) {
    /* permitido: vale após reiniciar */
  }
  let restartNeeded = false;
  const dir = dirOf(inst);

  if (input.name != null) {
    const name = String(input.name).trim();
    if (!name || name.length > 40) throw new HttpError(400, 'Nome inválido.');
    if (listInstances().some((i) => i.id !== inst.id && i.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(400, 'Já existe um servidor com esse nome.');
    }
    inst.name = name;
  }
  if (input.ram != null) inst.ram = clampInt(input.ram, MIN_RAM, MAX_RAM, inst.ram);
  if (input.port != null) {
    inst.port = validatePort(input.port, inst);
    restartNeeded = true;
  }
  if (input.maxPlayers != null) inst.maxPlayers = clampInt(input.maxPlayers, 1, 500, inst.maxPlayers);
  if (input.gamemode != null && GAMEMODES.includes(input.gamemode)) inst.gamemode = input.gamemode;
  if (input.difficulty != null && DIFFICULTIES.includes(input.difficulty)) inst.difficulty = input.difficulty;
  if (input.onlineMode != null) {
    inst.onlineMode = !!input.onlineMode;
    restartNeeded = true;
  }
  if (input.whitelist != null) inst.whitelist = !!input.whitelist;
  if (input.viewDistance != null) inst.viewDistance = clampInt(input.viewDistance, 2, 32, inst.viewDistance || 6);
  if (input.motd != null) inst.motd = String(input.motd).slice(0, 80);

  const props = await readProps(dir);
  props['motd'] = inst.motd;
  props['server-port'] = String(inst.port);
  props['online-mode'] = String(inst.onlineMode);
  props['gamemode'] = inst.gamemode;
  props['difficulty'] = inst.difficulty;
  props['max-players'] = String(inst.maxPlayers);
  props['white-list'] = String(inst.whitelist);
  props['view-distance'] = String(inst.viewDistance || 6);
  await writeProps(dir, props);
  putInstance(inst);
  return { inst, restartNeeded };
}

export async function changeVersion(id, { version, loaderVersion }) {
  const inst = getInstance(id);
  if (running.has(inst.id)) throw new HttpError(409, 'Pare o servidor antes de trocar a versão.');
  const v = String(version || '').trim();
  if (!v) throw new HttpError(400, 'Versão não informada.');
  if (inst.software === 'fabric' && loaderVersion) inst.loaderVersion = String(loaderVersion).trim();
  inst.version = v;
  putInstance(inst);
  const job = reinstall(id);
  return { inst, job };
}

export function canTalk(inst) {
  const st = statusOf(inst);
  return st === 'running' || st === 'orphan';
}

// ---------- Console / comandos ----------

export function sendCommand(id, cmd) {
  const inst = getInstance(id);
  const rt = running.get(inst.id);
  const clean = String(cmd || '').trim().slice(0, 500);
  if (!clean) throw new HttpError(400, 'Comando vazio.');
  if (rt) {
    try {
      rt.proc.stdin.write(clean + '\n');
    } catch (err) {
      throw new HttpError(500, `Falha ao enviar comando: ${err.message}`);
    }
    pushLine(inst.id, `> ${clean}`, 'cmd');
    return { ok: true };
  }
  // processo órfão: sem pipes, manda via RCON (se houver)
  if (inst.pid && pidAlive(inst.pid)) {
    return rconExec({
      port: inst.rcon.port,
      password: inst.rcon.password,
      command: clean.replace(/^\//, ''),
      timeout: 5000,
    }).then((out) => {
      pushLine(inst.id, `[Painel] (RCON) > ${clean}`, 'cmd');
      if (out) pushLine(inst.id, out, 'sys');
      return { ok: true, output: out };
    }).catch((err) => {
      throw new HttpError(503, `Servidor órfão sem RCON: ${err.message}`);
    });
  }
  throw new HttpError(409, 'O servidor não está rodando.');
}

// ---------- Players ----------

async function readJsonIn(dir, file) {
  try {
    return JSON.parse(await fsp.readFile(path.join(dir, file), 'utf8'));
  } catch {
    return null;
  }
}

export async function getPlayers(id) {
  const inst = getInstance(id);
  const dir = dirOf(inst);
  const talk = canTalk(inst);
  const data = {
    running: talk,
    online: [],
    max: inst.maxPlayers,
    whitelist: (await readJsonIn(dir, 'whitelist.json')) || [],
    ops: (await readJsonIn(dir, 'ops.json')) || [],
    bans: (await readJsonIn(dir, 'banned-players.json')) || [],
    rconOk: false,
    rconError: null,
    onlineMode: inst.onlineMode,
    orphan: statusOf(inst) === 'orphan',
  };
  if (talk) {
    try {
      const out = await rconExec({ port: inst.rcon.port, password: inst.rcon.password, command: 'list', timeout: 4000 });
      data.rconOk = true;
      data.raw = out;
      const maxMatch = out.match(/max of (\d+)/i);
      if (maxMatch) data.max = Number(maxMatch[1]);
      const idx = out.lastIndexOf(':');
      const after = idx >= 0 ? out.slice(idx + 1).trim() : '';
      data.online = after ? after.split(',').map((s) => s.trim()).filter(Boolean) : [];
    } catch (err) {
      data.rconError = err.message;
    }
  }
  return data;
}

const PLAYER_ACTIONS = {
  kick: (n) => `kick ${n}`,
  ban: (n) => `ban ${n}`,
  pardon: (n) => `pardon ${n}`,
  op: (n) => `op ${n}`,
  deop: (n) => `deop ${n}`,
  whitelist_add: (n) => `whitelist add ${n}`,
  whitelist_remove: (n) => `whitelist remove ${n}`,
};

export async function playerAction(id, action, target) {
  const inst = getInstance(id);
  const name = String(target || '').trim();
  if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) throw new HttpError(400, 'Nome de jogador inválido.');
  const build = PLAYER_ACTIONS[action];
  if (!build) throw new HttpError(400, 'Ação inválida.');
  if (!canTalk(inst)) throw new HttpError(409, 'O servidor precisa estar rodando para gerenciar jogadores.');
  const cmd = build(name);
  try {
    const out = await rconExec({ port: inst.rcon.port, password: inst.rcon.password, command: cmd, timeout: 4000 });
    pushLine(inst.id, `[Painel] ${action}: ${out || cmd}`, 'sys');
    return { ok: true, output: out };
  } catch (err) {
    if (running.has(inst.id)) {
      sendCommand(inst.id, cmd);
      return { ok: true, output: `Comando enviado pelo console (RCON indisponível: ${err.message}).` };
    }
    throw new HttpError(503, `Não consegui falar com o servidor: ${err.message}`);
  }
}

// ---------- Arquivos ----------

export async function listDir(id, rel) {
  const inst = getInstance(id);
  const dir = dirOf(inst);
  const target = safePath(dir, rel);
  let entries;
  try {
    entries = await fsp.readdir(target, { withFileTypes: true });
  } catch {
    throw new HttpError(404, 'Pasta não encontrada.');
  }
  const items = [];
  for (const e of entries) {
    let size = 0;
    let mtime = 0;
    if (e.isFile()) {
      try {
        const st = await fsp.stat(path.join(target, e.name));
        size = st.size;
        mtime = st.mtimeMs;
      } catch {
        /* arquivo sumiu no meio da leitura */
      }
    }
    items.push({ name: e.name, type: e.isDirectory() ? 'dir' : 'file', size, mtime });
  }
  items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'pt-BR') : a.type === 'dir' ? -1 : 1));
  const norm = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const parent = norm.includes('/') ? norm.slice(0, norm.lastIndexOf('/')) : '';
  return { path: norm, parent, entries: items };
}

export async function readFileApi(id, rel) {
  const inst = getInstance(id);
  const dir = dirOf(inst);
  if (!String(rel || '').trim()) throw new HttpError(400, 'Informe o arquivo.');
  const target = safePath(dir, rel);
  let st;
  try {
    st = await fsp.stat(target);
  } catch {
    throw new HttpError(404, 'Arquivo não encontrado.');
  }
  if (st.isDirectory()) throw new HttpError(400, 'Isso é uma pasta, não um arquivo.');
  if (st.size > 32 * 1024 * 1024) throw new HttpError(413, 'Arquivo grande demais para visualizar (máx 32 MB).');
  const buf = await fsp.readFile(target);
  const asText = st.size <= 4 * 1024 * 1024 && !buf.includes(0);
  return {
    path: String(rel),
    size: st.size,
    mtime: st.mtimeMs,
    encoding: asText ? 'text' : 'base64',
    content: asText ? buf.toString('utf8') : buf.toString('base64'),
  };
}

export async function writeFileApi(id, rel, buf) {
  const inst = getInstance(id);
  const dir = dirOf(inst);
  if (!String(rel || '').trim()) throw new HttpError(400, 'Informe o arquivo.');
  const target = safePath(dir, rel);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, buf);
  return { ok: true, path: String(rel), size: buf.length };
}

export async function deleteFileApi(id, rel) {
  const inst = getInstance(id);
  const dir = dirOf(inst);
  const norm = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm) throw new HttpError(400, 'Não dá pra excluir a raiz do servidor por aqui.');
  const target = safePath(dir, norm);
  if (path.resolve(target) === path.resolve(dir)) throw new HttpError(400, 'Caminho inválido.');
  try {
    await fsp.rm(target, { recursive: true, force: true });
  } catch (err) {
    throw new HttpError(500, `Falha ao excluir: ${err.message}`);
  }
  return { ok: true };
}

// ---------- Pacotes (plugins / mods) ----------

export async function listPackages(id, kind) {
  const inst = getInstance(id);
  if (kind !== 'plugin' && kind !== 'mod') throw new HttpError(400, 'Tipo inválido (plugin ou mod).');
  const folder = kind === 'plugin' ? 'plugins' : 'mods';
  const dir = path.join(dirOf(inst), folder);
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    /* pasta não existe ainda */
  }
  const out = [];
  for (const e of entries) {
    if (!e.isFile() || !/\.(jar|zip)$/i.test(e.name)) continue;
    const disabled = /\.disabled$/i.test(e.name);
    let size = 0;
    let mtime = 0;
    try {
      const st = await fsp.stat(path.join(dir, e.name));
      size = st.size;
      mtime = st.mtimeMs;
    } catch {
      /* ignore */
    }
    out.push({ name: e.name, size, mtime, disabled });
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

export async function deletePackage(id, kind, filename) {
  const inst = getInstance(id);
  if (kind !== 'plugin' && kind !== 'mod') throw new HttpError(400, 'Tipo inválido.');
  const folder = kind === 'plugin' ? 'plugins' : 'mods';
  const safeName = String(filename || '').replace(/[\\/:*?"<>|]/g, '');
  if (!safeName || !/\.(jar|zip|disabled)$/i.test(safeName)) throw new HttpError(400, 'Arquivo inválido.');
  const target = path.join(dirOf(inst), folder, safeName);
  try {
    await fsp.rm(target, { force: true });
  } catch (err) {
    throw new HttpError(500, `Falha ao excluir: ${err.message}`);
  }
  return { ok: true };
}
