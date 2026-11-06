import { WebBluetoothTransport } from './transport/webbluetooth.js';
import { toHex, decodePacket } from './decoder.js';
import { G32 } from './g32.js';

const $ = (id) => document.getElementById(id);
const logEl = $('log');
let transport = null;
const lines = [];

function log(line) {
  const t = new Date().toISOString().slice(11, 23);
  const entry = `${t}  ${line}`;
  lines.push(entry);
  logEl.textContent += entry + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

function parseUuids(text) {
  return text.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

$('uuids').value = G32.SERVICE;

$('connect').addEventListener('click', async () => {
  try {
    transport = new WebBluetoothTransport({
      acceptAll: $('all').checked,
      serviceUuids: parseUuids($('uuids').value),
    });
    transport.addEventListener('status', (e) => {
      $('status').textContent = e.detail;
      log(`[status] ${e.detail}`);
    });
    transport.addEventListener('error', (e) => log(`[fehler] ${e.detail.message}`));
    transport.addEventListener('disconnected', () => {
      $('connect').disabled = false;
      $('disconnect').disabled = true;
    });
    transport.addEventListener('packet', (e) => {
      const { uuid, bytes } = e.detail;
      log(`${uuid}  (${bytes.length} B)  ${toHex(bytes)}`);
      if (uuid === G32.DATA_CHAR) {
        const d = decodePacket(bytes);
        if (d) {
          $('decoded').textContent = JSON.stringify(
            { ...d, unknown: { ...d.unknown, header: toHex(d.unknown.header), b26_29: toHex(d.unknown.b26_29) } },
            null, 2,
          );
        }
      }
    });
    transport.addEventListener('services', (e) => {
      $('services').textContent = e.detail
        .map((s) => `${s.uuid}\n` + s.characteristics.map((c) => `  ${c.uuid}  [${c.props.join(', ')}]`).join('\n'))
        .join('\n\n') || 'Keine Services sichtbar – Service-UUID oben eintragen.';
    });

    await transport.connect();
    await transport.subscribeAll();
    if (transport.chars.has(G32.DATA_CHAR)) {
      const mode = await transport.startData(G32.DATA_CHAR, { pollMs: 2000 });
      log(`[info] Daten-Characteristic: ${mode}`);
    }
    $('connect').disabled = true;
    $('disconnect').disabled = false;
    $('download').disabled = false;
  } catch (err) {
    log(`[fehler] ${err.message}`);
    $('status').textContent = 'Fehler';
  }
});

$('disconnect').addEventListener('click', async () => {
  await transport?.disconnect();
  $('connect').disabled = false;
  $('disconnect').disabled = true;
});

$('download').addEventListener('click', () => {
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `g32-ble-log-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
});

if (!WebBluetoothTransport.supported()) {
  $('status').textContent = 'Web Bluetooth nicht verfügbar – Chrome/Edge auf localhost nutzen';
  $('connect').disabled = true;
}
