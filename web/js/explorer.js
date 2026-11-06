import { WebBluetoothTransport } from './transport/webbluetooth.js';
import { toHex } from './decoder.js';

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

$('connect').addEventListener('click', async () => {
  try {
    transport = new WebBluetoothTransport({ serviceUuids: parseUuids($('uuids').value) });
    transport.addEventListener('status', (e) => {
      $('status').textContent = e.detail;
      log(`[status] ${e.detail}`);
    });
    transport.addEventListener('error', (e) => log(`[fehler] ${e.detail.message}`));
    transport.addEventListener('packet', (e) => {
      const { uuid, bytes } = e.detail;
      log(`${uuid}  (${bytes.length} B)  ${toHex(bytes)}`);
    });
    transport.addEventListener('services', (e) => {
      $('services').textContent = e.detail
        .map((s) => `${s.uuid}\n` + s.characteristics.map((c) => `  ${c.uuid}  [${c.props.join(', ')}]`).join('\n'))
        .join('\n\n') || 'Keine Services sichtbar – Service-UUID oben eintragen.';
    });

    await transport.connect();
    await transport.subscribeAll();
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
