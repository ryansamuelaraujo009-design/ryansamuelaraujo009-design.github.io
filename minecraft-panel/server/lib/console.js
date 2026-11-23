// Console dos servidores: buffer circular em memória + streaming SSE para o navegador.
import { CONSOLE_BUFFER } from './config.js';

const consoles = new Map();

const ANSI = /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

export function stripAnsi(text) {
  return String(text).replace(ANSI, '').replace(/\r/g, '').trimEnd();
}

function ensure(id) {
  let c = consoles.get(id);
  if (!c) {
    c = { lines: [], seq: 0, subs: new Set() };
    consoles.set(id, c);
  }
  return c;
}

export function pushLine(id, text, src = 'out') {
  const clean = stripAnsi(text);
  if (!clean) return;
  const c = ensure(id);
  const line = { seq: ++c.seq, t: Date.now(), text: clean, src };
  c.lines.push(line);
  if (c.lines.length > CONSOLE_BUFFER) c.lines.splice(0, c.lines.length - CONSOLE_BUFFER);
  for (const res of c.subs) {
    try {
      res.write(`id: ${line.seq}\ndata: ${JSON.stringify(line)}\n\n`);
    } catch {
      /* cliente caiu; limpeza acontece no close */
    }
  }
}

export function getLines(id, since = 0, limit = 500) {
  const c = consoles.get(id);
  if (!c) return [];
  const filtered = since > 0 ? c.lines.filter((l) => l.seq > since) : c.lines;
  const slice = filtered.slice(-limit);
  return slice;
}

export function currentSeq(id) {
  return consoles.get(id)?.seq || 0;
}

function sse(res, line) {
  res.write(`id: ${line.seq}\ndata: ${JSON.stringify(line)}\n\n`);
}

export function subscribe(id, res, lastEventId = 0) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': conectado\n\n');

  const c = ensure(id);
  const since = Number(lastEventId) || 0;
  for (const line of getLines(id, since, 400)) sse(res, line);

  c.subs.add(res);
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* ignore */
    }
  }, 15000);

  const cleanup = () => {
    clearInterval(heartbeat);
    c.subs.delete(res);
    try {
      res.end();
    } catch {
      /* ignore */
    }
  };
  res.on('close', cleanup);
  res.on('error', cleanup);
}
