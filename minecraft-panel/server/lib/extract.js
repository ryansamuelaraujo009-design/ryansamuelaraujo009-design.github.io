// Extração/compressão usando o `tar` do sistema (bsdtar no Windows, que lê .zip e .tar.gz).
import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';

export function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d;
      if (opts.onStdout) opts.onStdout(String(d));
    });
    child.stderr.on('data', (d) => {
      stderr += d;
      if (opts.onStderr) opts.onStderr(String(d));
    });
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: stderr + '\n' + err.message }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

// Extrai .zip ou .tar.gz para destDir (cria se não existir).
export async function extractArchive(archive, destDir, { onLine = null } = {}) {
  await fsp.mkdir(destDir, { recursive: true });
  const res = await run('tar', ['-xf', archive, '-C', destDir], {
    onStdout: onLine,
    onStderr: onLine,
  });
  if (res.code !== 0) {
    throw new Error(`Falha ao extrair ${path.basename(archive)}: ${res.stderr.trim().split('\n').pop() || `código ${res.code}`}`);
  }
}

// Compacta o conteúdo de dir em outFile (.tar.gz), excluindo subcaminhos em `exclude`.
export async function compressDir(dir, outFile, exclude = []) {
  await fsp.mkdir(path.dirname(outFile), { recursive: true });
  const args = ['-czf', outFile, '-C', dir];
  for (const ex of exclude) {
    args.push(`--exclude=./${ex}`, `--exclude=./${ex}/*`);
  }
  args.push('.');
  const res = await run('tar', args);
  if (res.code !== 0) {
    throw new Error(`Falha ao criar backup: ${res.stderr.trim().split('\n').pop() || `código ${res.code}`}`);
  }
}
