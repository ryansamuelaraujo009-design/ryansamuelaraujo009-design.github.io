// Softwares de servidor: Paper, Purpur, Vanilla, Fabric e Arclight (Forge/NeoForge/Fabric + plugins).
import path from 'node:path';
import fsp from 'node:fs/promises';
import { CACHE_DIR } from './config.js';
import { fetchJson, HttpError, cached, readJsonCacheFile, writeJsonCacheFile, fmtBytes, fileExists } from './util.js';
import { downloadToFile } from './download.js';
import { run } from './extract.js';
import { resolveJava } from './java.js';
import { jobLog, jobProgress } from './store.js';

export const SOFTWARE = {
  paper: {
    name: 'Paper',
    emoji: '⚡',
    family: 'plugin',
    desc: 'Plugins (Paper/Bukkit). O mais usado — rápido e com a API mais completa.',
    supports: { plugins: true, mods: false, modpacks: false },
  },
  purpur: {
    name: 'Purpur',
    emoji: '🥒',
    family: 'plugin',
    desc: 'Fork do Paper com extra de opções de customização (jogadores, mobs, worlds).',
    supports: { plugins: true, mods: false, modpacks: false },
  },
  vanilla: {
    name: 'Vanilla',
    emoji: '🍦',
    family: 'vanilla',
    desc: 'Servidor oficial da Mojang. Sem plugins nem mods — puro jogo.',
    supports: { plugins: false, mods: false, modpacks: false },
  },
  fabric: {
    name: 'Fabric',
    emoji: '🧵',
    family: 'mod',
    desc: 'Mods (Fabric). Leve e sempre atualizado primeiro.',
    supports: { plugins: false, mods: true, modpacks: true },
  },
  arclight: {
    name: 'Arclight',
    emoji: '🔥',
    family: 'hybrid',
    desc: 'Mods (Forge, NeoForge ou Fabric) + plugins Paper juntos no mesmo servidor.',
    supports: { plugins: true, mods: true, modpacks: true },
  },
};

const RELEASE_RE = /^\d+(\.\d+)+$/;

function cmpDesc(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return y - x;
  }
  return 0;
}

// ---------- Índice do Arclight (GitHub Releases) ----------

async function arclightIndex() {
  const file = path.join(CACHE_DIR, 'arclight-index.json');
  const cachedIdx = await readJsonCacheFile(file, 60 * 60 * 1000);
  if (cachedIdx?.byVersion) return cachedIdx;

  const byVersion = {};
  for (let page = 1; page <= 6; page++) {
    let releases;
    try {
      releases = await fetchJson(`https://api.github.com/repos/IzzelAliz/Arclight/releases?per_page=30&page=${page}`);
    } catch (err) {
      if (page === 1) throw err;
      break;
    }
    if (!Array.isArray(releases) || !releases.length) break;
    for (const rel of releases) {
      for (const asset of rel.assets || []) {
        const m = asset.name.match(/^arclight-(forge|neoforge|fabric)-(\d+(?:\.\d+)+)-/);
        if (!m) continue;
        const [, loader, mc] = m;
        byVersion[mc] ||= {};
        // releases vêm do mais recente para o mais antigo: primeira ocorrência vence
        if (!byVersion[mc][loader]) {
          byVersion[mc][loader] = { name: asset.name, url: asset.browser_download_url, size: asset.size };
        }
      }
    }
    if (releases.length < 30) break;
  }

  const idx = { byVersion, versions: Object.keys(byVersion).sort(cmpDesc) };
  await writeJsonCacheFile(file, idx);
  return idx;
}

// ---------- Listas de versões ----------

export async function listVersions(software) {
  switch (software) {
    case 'paper': {
      const data = await cached('sw-paper-versions', 300000, () => fetchJson('https://fill.papermc.io/v3/projects/paper'));
      const out = [];
      for (const arr of Object.values(data.versions || {})) {
        for (const v of arr) if (RELEASE_RE.test(v) && !out.includes(v)) out.push(v);
      }
      return out;
    }
    case 'purpur': {
      const data = await cached('sw-purpur-versions', 300000, () => fetchJson('https://api.purpurmc.org/v2/purpur'));
      return [...(data.versions || [])].filter((v) => RELEASE_RE.test(v)).reverse();
    }
    case 'vanilla': {
      const man = await cached('sw-va-manifest', 3600000, () => fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'));
      return (man.versions || []).filter((v) => v.type === 'release').map((v) => v.id);
    }
    case 'fabric': {
      const games = await cached('sw-fa-game', 3600000, () => fetchJson('https://meta.fabricmc.net/v2/versions/game'));
      return games.filter((g) => g.stable && RELEASE_RE.test(g.version)).map((g) => g.version);
    }
    case 'arclight': {
      const idx = await arclightIndex();
      return idx.versions;
    }
    default:
      throw new HttpError(400, `Software desconhecido: ${software}`);
  }
}

export async function listFabricLoaders() {
  const loaders = await cached('sw-fa-loader', 3600000, () => fetchJson('https://meta.fabricmc.net/v2/versions/loader'));
  return loaders.filter((l) => l.stable && RELEASE_RE.test(l.version)).map((l) => l.version);
}

// ---------- Instalação do jar ----------

async function ensureFabricInstaller(job) {
  const meta = await cached('sw-fa-installer-meta', 86400000, () => fetchJson('https://meta.fabricmc.net/v2/versions/installer'));
  const stable = (meta || []).find((i) => i.stable) || meta?.[0];
  if (!stable?.version) throw new HttpError(502, 'Não consegui listar os instaladores do Fabric.');
  const file = path.join(CACHE_DIR, `fabric-installer-${stable.version}.jar`);
  if (!(await fileExists(file))) {
    if (job) jobLog(job, `Baixando instalador do Fabric ${stable.version}…`);
    await downloadToFile(
      `https://maven.fabricmc.net/net/fabricmc/fabric-installer/${stable.version}/fabric-installer-${stable.version}.jar`,
      file,
      { job, label: 'fabric-installer.jar' }
    );
  }
  return file;
}

// Garante o jar do servidor em `dir` e atualiza inst.serverJar.
export async function installServerJar(inst, dir, { job = null } = {}) {
  const log = (m) => job && jobLog(job, m);
  const prevJar = inst.serverJar;
  let newJar = null;

  switch (inst.software) {
    case 'paper': {
      log(`Consultando builds do Paper ${inst.version}…`);
      const builds = await cached(`sw-paper-builds-${inst.version}`, 300000, () =>
        fetchJson(`https://fill.papermc.io/v3/projects/paper/versions/${encodeURIComponent(inst.version)}/builds`)
      );
      if (!Array.isArray(builds) || !builds.length) throw new HttpError(404, `Paper não tem builds para ${inst.version}.`);
      const build = builds.find((b) => b.channel === 'STABLE') || builds[0];
      const dl = build?.downloads?.['server:default'];
      if (!dl?.url) throw new HttpError(404, `Build do Paper ${inst.version} sem arquivo de download.`);
      newJar = dl.name;
      const dest = path.join(dir, newJar);
      if (!(await fileExists(dest))) {
        log(`Baixando ${newJar} (${fmtBytes(dl.size)})…`);
        await downloadToFile(dl.url, dest, { job, label: newJar, sha256: dl.checksums?.sha256 });
      } else {
        log(`${newJar} já existe — mantendo.`);
      }
      break;
    }

    case 'purpur': {
      newJar = `purpur-${inst.version}.jar`;
      const dest = path.join(dir, newJar);
      if (!(await fileExists(dest))) {
        log(`Baixando Purpur ${inst.version}…`);
        await downloadToFile(`https://api.purpurmc.org/v2/purpur/${encodeURIComponent(inst.version)}/latest/download`, dest, {
          job,
          label: newJar,
        });
      } else {
        log(`${newJar} já existe — mantendo.`);
      }
      break;
    }

    case 'vanilla': {
      const man = await cached('sw-va-manifest', 3600000, () => fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'));
      const entry = (man.versions || []).find((v) => v.id === inst.version);
      if (!entry) throw new HttpError(404, `A versão ${inst.version} não existe no Minecraft.`);
      const vinfo = await fetchJson(entry.url, { ttl: 3600000 });
      const dl = vinfo?.downloads?.server;
      if (!dl?.url) throw new HttpError(404, `Sem servidor oficial para ${inst.version}.`);
      newJar = `minecraft_server_${inst.version}.jar`;
      const dest = path.join(dir, newJar);
      if (!(await fileExists(dest))) {
        log(`Baixando Vanilla ${inst.version}…`);
        await downloadToFile(dl.url, dest, { job, label: newJar, sha1: dl.sha1 });
      } else {
        log(`${newJar} já existe — mantendo.`);
      }
      break;
    }

    case 'fabric': {
      const installer = await ensureFabricInstaller(job);
      if (!inst.loaderVersion) {
        const loaders = await listFabricLoaders();
        inst.loaderVersion = loaders[0];
      }
      const java = await resolveJava(inst.version, job);
      log(`Instalando Fabric (Minecraft ${inst.version}, loader ${inst.loaderVersion})…`);
      // limpa instalação anterior (evita erro de classes ao trocar de loader)
      await fsp.rm(path.join(dir, 'fabric-server-launch.jar'), { force: true });
      await fsp.rm(path.join(dir, 'server.jar'), { force: true });
      await fsp.rm(path.join(dir, '.fabric'), { recursive: true, force: true });
      const res = await run(
        java.path,
        ['-jar', installer, 'server', '-dir', dir, '-mcversion', inst.version, '-loader', inst.loaderVersion, '-downloadMinecraft'],
        {
          cwd: dir,
          onStdout: (l) => l.trim() && log(l.trim()),
          onStderr: (l) => l.trim() && log(l.trim()),
        }
      );
      newJar = 'fabric-server-launch.jar';
      if (res.code !== 0 || !(await fileExists(path.join(dir, newJar)))) {
        throw new HttpError(500, `Instalador do Fabric falhou (código ${res.code}). Veja o log acima.`);
      }
      if (!(await fileExists(path.join(dir, 'server.jar')))) {
        log('Aviso: server.jar vanilla não veio junto; o launcher deve baixá-lo no primeiro start.');
      }
      break;
    }

    case 'arclight': {
      log('Procurando builds do Arclight…');
      const idx = await arclightIndex();
      const loaders = idx.byVersion[inst.version] || {};
      const available = Object.keys(loaders);
      if (!available.length) {
        throw new HttpError(
          404,
          `Arclight não tem build para ${inst.version}. Versões disponíveis: ${idx.versions.slice(0, 10).join(', ')}…`
        );
      }
      let chosen = inst.loader && loaders[inst.loader] ? inst.loader : null;
      if (!chosen) {
        chosen = ['forge', 'neoforge', 'fabric'].find((l) => loaders[l]) || available[0];
        if (inst.loader && inst.loader !== chosen) {
          log(`Build ${inst.loader} indisponível para ${inst.version}; usando ${chosen}.`);
        }
      }
      const asset = loaders[chosen];
      inst.loader = chosen;
      newJar = asset.name;
      const dest = path.join(dir, newJar);
      if (!(await fileExists(dest))) {
        log(`Baixando Arclight ${chosen} ${inst.version} (${fmtBytes(asset.size)})…`);
        await downloadToFile(asset.url, dest, { job, label: newJar });
      } else {
        log(`${newJar} já existe — mantendo.`);
      }
      break;
    }

    default:
      throw new HttpError(400, `Software desconhecido: ${inst.software}`);
  }

  if (prevJar && prevJar !== newJar) {
    await fsp.rm(path.join(dir, prevJar), { force: true }).catch(() => {});
  }
  inst.serverJar = newJar;
  return newJar;
}
