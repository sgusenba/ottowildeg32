// Simulierte ESP32-Bridge zum Testen ohne Hardware (Node 18+, keine Abhängigkeiten).
//   node tools/mock-bridge.mjs [httpPort=8080] [wsPort=8081]
//   Dashboard: http://localhost:8080/index.html?bridge=&wsport=8081
// Liefert web/ aus und sendet alle 2,4 s ein synthetisches G32-Paket (gleiches Frame-Format wie die Firmware).

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const HTTP_PORT = Number(process.argv[2] || 8080);
const WS_PORT = Number(process.argv[3] || 8081);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

// ---------- HTTP: web/ ausliefern ----------
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(WEB, p));
  if (!file.startsWith(WEB + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('404');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(HTTP_PORT, '127.0.0.1', () => console.log(`HTTP  http://localhost:${HTTP_PORT}/index.html?bridge=&wsport=${WS_PORT}`));

// ---------- WebSocket (minimal, nur Server -> Client, unmaskierte Binary-Frames < 126 Byte) ----------
const clients = new Set();
let last = null;

const wsFrame = (payload) => Buffer.concat([Buffer.from([0x82, payload.length]), payload]);
const statusFrame = (text) => Buffer.concat([Buffer.from([0x10, 0x00]), Buffer.from(text)]);

http.createServer().on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  clients.add(socket);
  socket.write(wsFrame(statusFrame('Simulation (kein Grill)')));
  if (last) socket.write(wsFrame(last));
  socket.on('data', (d) => { if ((d[0] & 0x0f) === 0x8) socket.end(); }); // Close-Frame
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
}).listen(WS_PORT, '127.0.0.1', () => console.log(`WS    ws://localhost:${WS_PORT}/`));

// ---------- synthetische Pakete (Layout: docs/PROTOCOL.md) ----------
function putTemp(buf, i, celsius) {
  if (celsius == null) {
    buf[i] = 150; // 1500 = nicht vorhanden
    buf[i + 1] = 0;
  } else {
    const hi = Math.floor(celsius / 10);
    buf[i] = hi;
    buf[i + 1] = Math.round((celsius - hi * 10) * 10);
  }
}

let tick = 0;
function buildPacket() {
  const b = Buffer.alloc(33);
  b.set([0xa3, 0x3a, 0, 0, 0, 0], 0); // Kennung + Geräte-ID (hier 0)
  const zone = Math.min(200, 20 + tick * 5);
  putTemp(b, 6, zone);
  putTemp(b, 8, Math.max(5, zone - 10));
  putTemp(b, 10, Math.max(5, zone - 25));
  putTemp(b, 12, null);
  putTemp(b, 14, Math.min(70, 15 + tick * 2)); // Fühler 1 steckt
  putTemp(b, 16, null);
  putTemp(b, 18, null);
  putTemp(b, 20, null);
  b[22] = 0x14; b[23] = 0x50; // Gas-Rohwert 5200
  b[24] = 0; b[25] = 0;       // Haube zu, Licht aus
  b.set([0x0d, 0x01, 0x04, 0x05, 0xff, 47], 26);
  b[32] = 0xc3;
  return b;
}

function pushPacket() {
  last = Buffer.concat([Buffer.from([0x01, 0x00]), buildPacket()]);
  tick += 1;
  for (const c of clients) c.write(wsFrame(last));
}
pushPacket();
setInterval(pushPacket, 2400);
