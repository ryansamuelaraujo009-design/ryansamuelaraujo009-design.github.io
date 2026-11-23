// Configuração global do painel.
// Tudo que é pesado (jars, mundos, JREs) fica FORA do OneDrive, em ~/MCServers.
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const PANEL_VERSION = '1.0.0';

export const HOST = process.env.MCPANEL_HOST || '127.0.0.1';
export const PORT = Number(process.env.MCPANEL_PORT || 3789);

export const DATA_DIR = process.env.MCPANEL_DATA
  ? path.resolve(process.env.MCPANEL_DATA)
  : path.join(os.homedir(), 'MCServers');

export const SERVERS_DIR = path.join(DATA_DIR, 'servers');
export const RUNTIME_DIR = path.join(DATA_DIR, 'runtime'); // JREs baixados pelo painel
export const CACHE_DIR = path.join(DATA_DIR, 'cache'); // instaladores, índices de API
export const STATE_FILE = path.join(DATA_DIR, 'state.json');

// Raiz do site (pasta minecraft-panel/)
export const WEB_DIR = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// Limites de segurança
export const MAX_BODY = 512 * 1024 * 1024; // 512 MB (upload de mods/packs)
export const MAX_TEXT_FILE = 4 * 1024 * 1024; // editor de texto até 4 MB
export const CONSOLE_BUFFER = 4000; // linhas mantidas na memória por servidor

// RAM padrão dos servidores (a máquina do usuário tem pouca RAM)
export const DEFAULT_RAM = 1024;
export const MIN_RAM = 512;
export const MAX_RAM = 6144;
