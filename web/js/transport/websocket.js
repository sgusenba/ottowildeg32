// Transport über die ESP32-Bridge (WebSocket, nur Lesen).
// Frames vom ESP32 (binär): [type:1][index:1][payload...]
//   type 0x01 = Notification der Daten-Characteristic (index 0), 0x10 = Status-Text
// Events: 'packet' {uuid, bytes}, 'status' string, 'disconnected'

import { G32 } from '../g32.js';

const TYPE_NOTIFY = 0x01;
const TYPE_STATUS = 0x10;
const UUIDS = [G32.DATA_CHAR]; // Index im Frame -> Characteristic-UUID

export class WebSocketTransport extends EventTarget {
  constructor({ url, token = '' }) {
    super();
    this.url = url;
    this.token = token;
    this.ws = null;
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  connect() {
    return new Promise((resolve, reject) => {
      const sep = this.url.includes('?') ? '&' : '?';
      const url = this.token ? `${this.url}${sep}token=${encodeURIComponent(this.token)}` : this.url;
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        reject(e);
        return;
      }
      this.ws = ws;
      ws.binaryType = 'arraybuffer';
      let opened = false;
      ws.onopen = () => {
        opened = true;
        this._emit('status', 'Bridge verbunden');
        resolve();
      };
      ws.onerror = () => {
        if (!opened) reject(new Error('Bridge nicht erreichbar'));
      };
      ws.onclose = () => {
        this._emit('status', 'Bridge getrennt');
        this._emit('disconnected');
      };
      ws.onmessage = (ev) => {
        const b = new Uint8Array(ev.data);
        if (b.length < 2) return;
        if (b[0] === TYPE_NOTIFY) this._emit('packet', { uuid: UUIDS[b[1]], bytes: b.slice(2) });
        else if (b[0] === TYPE_STATUS) this._emit('status', new TextDecoder().decode(b.slice(2)));
      };
    });
  }

  async disconnect() {
    this.ws?.close();
  }
}
