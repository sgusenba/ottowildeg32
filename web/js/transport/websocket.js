// Transport über die ESP32-Bridge (WebSocket). Platzhalter bis Meilenstein 3.
// Frame-Format siehe docs/SPEC.md: [type:1][uuid-index:1][payload...]

const TYPE_NOTIFY = 0x01;
const TYPE_WRITE = 0x02;
const TYPE_STATUS = 0x10;

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
      this.ws = new WebSocket(`${this.url}${this.token ? `${sep}token=${encodeURIComponent(this.token)}` : ''}`);
      this.ws.binaryType = 'arraybuffer';
      this.ws.onopen = () => {
        this._emit('status', 'Bridge verbunden');
        resolve();
      };
      this.ws.onerror = () => reject(new Error('WebSocket-Fehler'));
      this.ws.onclose = () => this._emit('status', 'Bridge getrennt');
      this.ws.onmessage = (ev) => {
        const b = new Uint8Array(ev.data);
        if (b.length < 2) return;
        if (b[0] === TYPE_NOTIFY) this._emit('packet', { uuid: b[1], bytes: b.slice(2) });
        else if (b[0] === TYPE_STATUS) this._emit('status', new TextDecoder().decode(b.slice(2)));
      };
    });
  }

  async write(uuidIndex, bytes) {
    const frame = new Uint8Array(2 + bytes.length);
    frame[0] = TYPE_WRITE;
    frame[1] = uuidIndex;
    frame.set(bytes, 2);
    this.ws.send(frame);
  }

  async disconnect() {
    this.ws?.close();
  }
}
