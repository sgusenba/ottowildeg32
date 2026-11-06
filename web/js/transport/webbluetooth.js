// Transport über Web Bluetooth (Chrome/Edge, localhost oder https).
// Events: 'packet' {uuid, bytes}, 'status' string, 'error' Error,
//         'services' [{uuid, characteristics:[{uuid, props}]}], 'disconnected'

import { G32 } from '../g32.js';

export class WebBluetoothTransport extends EventTarget {
  // acceptAll=false: nur Geräte mit G32-Namen; acceptAll=true: alle BLE-Geräte (für den Explorer)
  constructor({ acceptAll = false, serviceUuids = [G32.SERVICE] } = {}) {
    super();
    this.acceptAll = acceptAll;
    this.serviceUuids = serviceUuids;
    this.device = null;
    this.server = null;
    this.chars = new Map(); // uuid -> BluetoothRemoteGATTCharacteristic
    this._subscribed = new Set();
    this._pollTimers = new Map();
  }

  static supported() {
    return 'bluetooth' in navigator;
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  async connect() {
    if (!WebBluetoothTransport.supported()) {
      throw new Error('Web Bluetooth nicht verfügbar (Chrome/Edge nutzen, localhost oder https).');
    }
    const options = this.acceptAll
      ? { acceptAllDevices: true }
      : { filters: [{ namePrefix: G32.NAME_PREFIX }, { services: [G32.SERVICE] }] };
    options.optionalServices = ['generic_access', 'device_information', 'battery_service', ...this.serviceUuids];

    this._emit('status', 'Gerät wählen ...');
    this.device = await navigator.bluetooth.requestDevice(options);
    this.device.addEventListener('gattserverdisconnected', () => {
      this._stopPolling();
      this._emit('status', 'Getrennt');
      this._emit('disconnected');
    });

    this._emit('status', `Verbinde mit ${this.device.name || this.device.id} ...`);
    this.server = await this.device.gatt.connect();

    const found = [];
    const services = await this.server.getPrimaryServices();
    for (const svc of services) {
      const entry = { uuid: svc.uuid, characteristics: [] };
      let chars = [];
      try {
        chars = await svc.getCharacteristics();
      } catch (e) {
        this._emit('error', new Error(`Characteristics von ${svc.uuid}: ${e.message}`));
      }
      for (const c of chars) {
        const props = Object.entries(c.properties).filter(([, v]) => v).map(([k]) => k);
        entry.characteristics.push({ uuid: c.uuid, props });
        this.chars.set(c.uuid, c);
      }
      found.push(entry);
    }
    this._emit('status', 'Verbunden');
    this._emit('services', found);
    return found;
  }

  _toBytes(dv) {
    return new Uint8Array(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength));
  }

  async _subscribe(uuid) {
    const c = this.chars.get(uuid);
    if (!c || this._subscribed.has(uuid)) return;
    c.addEventListener('characteristicvaluechanged', (ev) => {
      this._emit('packet', { uuid, bytes: this._toBytes(ev.target.value) });
    });
    await c.startNotifications();
    this._subscribed.add(uuid);
    this._emit('status', `Notifications aktiv: ${uuid}`);
  }

  // Alle Characteristics mit notify/indicate abonnieren (read-only, schreibt nichts).
  async subscribeAll() {
    for (const [uuid, c] of this.chars) {
      if (!(c.properties.notify || c.properties.indicate)) continue;
      try {
        await this._subscribe(uuid);
      } catch (e) {
        this._emit('error', new Error(`Subscribe ${uuid}: ${e.message}`));
      }
    }
  }

  // Daten-Characteristic des G32: per Notification, falls möglich, sonst per Polling.
  // (ESPHome-Projekte lesen sie per Read alle 10 s; ob sie auch notified, zeigt der Explorer.)
  async startData(uuid = G32.DATA_CHAR, { pollMs = 2000 } = {}) {
    const c = this.chars.get(uuid);
    if (!c) throw new Error(`Daten-Characteristic ${uuid} nicht gefunden – Gerät/Service prüfen.`);
    if (c.properties.notify || c.properties.indicate) {
      await this._subscribe(uuid);
      if (c.properties.read) this._emit('packet', { uuid, bytes: await this.readOnce(uuid) });
      return 'notify';
    }
    if (!c.properties.read) throw new Error('Daten-Characteristic weder lesbar noch notify-fähig.');
    const tick = async () => {
      try {
        this._emit('packet', { uuid, bytes: await this.readOnce(uuid) });
      } catch (e) {
        this._emit('error', new Error(`Lesen fehlgeschlagen: ${e.message}`));
      }
    };
    await tick();
    this._pollTimers.set(uuid, setInterval(tick, pollMs));
    this._emit('status', `Polling alle ${pollMs} ms`);
    return 'poll';
  }

  _stopPolling() {
    for (const t of this._pollTimers.values()) clearInterval(t);
    this._pollTimers.clear();
    this._subscribed.clear();
  }

  async readOnce(uuid) {
    const c = this.chars.get(uuid);
    if (!c || !c.properties.read) throw new Error(`${uuid} nicht lesbar`);
    return this._toBytes(await c.readValue());
  }

  // Schreiben wird erst ab Meilenstein 2 genutzt (Schreibprotokoll noch unbekannt).
  async write(uuid, bytes) {
    const c = this.chars.get(uuid);
    if (!c) throw new Error(`Characteristic ${uuid} unbekannt`);
    if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(bytes);
    else await c.writeValueWithResponse(bytes);
  }

  async disconnect() {
    this._stopPolling();
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
  }
}
