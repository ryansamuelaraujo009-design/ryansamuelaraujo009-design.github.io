// Cliente RCON mínimo (protocolo Minecraft) — sem dependências.
// Usado para listar/kick/ban/op jogadores e comandos que precisam de resposta.
import net from 'node:net';

const SERVERDATA_RESPONSE_VALUE = 0;
const SERVERDATA_EXECCOMMAND = 2;
const SERVERDATA_AUTH = 3;

function buildPacket(id, type, body) {
  const bodyBuf = Buffer.from(body, 'utf8');
  const size = 4 + 4 + bodyBuf.length + 2;
  const buf = Buffer.alloc(4 + size);
  buf.writeInt32LE(size, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  // dois bytes nulos terminadores
  buf.writeUInt8(0, 12 + bodyBuf.length);
  buf.writeUInt8(0, 13 + bodyBuf.length);
  return buf;
}

export function rconExec({ host = '127.0.0.1', port, password, command, timeout = 5000 }) {
  return new Promise((resolve, reject) => {
    const AUTH_ID = 1;
    const CMD_ID = 2;
    let socket;
    let buf = Buffer.alloc(0);
    let phase = 'auth'; // auth | command | done
    const responses = [];
    let idleTimer = null;
    let settled = false;

    const cleanup = () => {
      clearTimeout(globalTimer);
      if (idleTimer) clearTimeout(idleTimer);
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
    };

    const fail = (msg) => {
      if (settled) return;
      cleanup();
      reject(new Error(msg));
    };

    const succeed = () => {
      if (settled) return;
      cleanup();
      resolve(responses.join(''));
    };

    const scheduleResolve = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(succeed, 300);
    };

    const globalTimer = setTimeout(() => {
      if (responses.length && phase === 'command') return succeed();
      fail('RCON: tempo esgotado (servidor travado ou porta errada).');
    }, timeout);

    const onPacket = (id, type, body) => {
      if (phase === 'auth') {
        if (id === -1) return fail('RCON: senha recusada pelo servidor.');
        if (id !== AUTH_ID) return;
        phase = 'command';
        socket.write(buildPacket(CMD_ID, SERVERDATA_EXECCOMMAND, command));
        return;
      }
      if (phase === 'command') {
        if (id === -1) return fail('RCON: comando recusado.');
        if (id !== CMD_ID || type !== SERVERDATA_RESPONSE_VALUE) return;
        responses.push(body);
        scheduleResolve();
      }
    };

    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (buf.length < 4) return;
        const size = buf.readInt32LE(0);
        if (size < 10 || size > 4 * 1024 * 1024) return fail('RCON: resposta inválida.');
        if (buf.length < 4 + size) return;
        const id = buf.readInt32LE(4);
        const type = buf.readInt32LE(8);
        const body = buf.subarray(12, 4 + size - 2).toString('utf8');
        buf = buf.subarray(4 + size);
        onPacket(id, type, body);
        if (settled) return;
      }
    };

    socket = net.connect({ host, port });
    socket.on('connect', () => {
      socket.write(buildPacket(AUTH_ID, SERVERDATA_AUTH, password));
    });
    socket.on('data', onData);
    socket.on('error', (err) => fail(`RCON: ${err.message}`));
    socket.on('close', () => {
      if (!settled && responses.length && phase === 'command') succeed();
      else if (!settled) fail('RCON: conexão fechada antes da resposta.');
    });
  });
}
