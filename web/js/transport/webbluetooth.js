// Transport über Web Bluetooth (Chrome/Edge, localhost oder https).
// Events: 'packet' {uuid, bytes}, 'status' string, 'error' Error, 'services' [{uuid, characteristics:[{uuid, props}]}]

export class WebBluetoothTransport extends EventTarget {
  constructor({ namePrefix = '', serviceUuids = [], acceptAll = true } = {}) {
    super();
    this.namePrefix = namePrefix;
    this.serviceUuids = serviceUuids;
    this.acceptAll = acceptAll;
    this.device = null;
    this.server = null;
    this.chars = new Map(); // uuid -> BluetoothRemoteGATTCharacteristic
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
      : { filters: [{ namePrefix: this.namePrefix }] };
    options.optionalServices = [
      'generic_access',
      'generic_attribute',
      'device_information',
      'battery_service',
      ...this.serviceUuids,
    ];

    this._emit('status', 'Gerät wählen ...');
    this.device = await navigator.bluetooth.requestDevice(options);
    this.device.addEventListener('gattserverdisconnected', () => this._emit('status', 'Getrennt'));

    this._emit('status', `Verbinde mit ${this.device.name || this.device.id} ...`);
    this.server = await this.device.gatt.connect();
    this._emit('status', 'Verbunden');

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
        const props = Object.entries(c.properties)
          .filter(([, v]) => v)
          .map(([k]) => k);
        entry.characteristics.push({ uuid: c.uuid, props });
        this.chars.set(c.uuid, c);
      }
      found.push(entry);
    }
    this._emit('services', found);
    return found;
  }

  // Alle Characteristics mit notify/indicate abonnieren (read-only, schreibt nichts).
  async subscribeAll() {
    for (const [uuid, c] of this.chars) {
      if (!(c.properties.notify || c.properties.indicate)) continue;
      try {
        c.addEventListener('characteristicvaluechanged', (ev) => {
          const dv = ev.target.value;
          this._emit('packet', {
            uuid,
            bytes: new Uint8Array(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength)),
          });
        });
        await c.startNotifications();
        this._emit('status', `Notifications aktiv: ${uuid}`);
      } catch (e) {
        this._emit('error', new Error(`Subscribe ${uuid}: ${e.message}`));
      }
    }
  }

  async readOnce(uuid) {
    const c = this.chars.get(uuid);
    if (!c || !c.properties.read) throw new Error(`${uuid} nicht lesbar`);
    const dv = await c.readValue();
    return new Uint8Array(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength));
  }

  // Schreiben ist absichtlich nur mit expliziter Characteristic-UUID möglich
  // und wird vom Explorer nicht verwendet. Wird ab Meilenstein 2 genutzt.
  async write(uuid, bytes) {
    const c = this.chars.get(uuid);
    if (!c) throw new Error(`Characteristic ${uuid} unbekannt`);
    if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(bytes);
    else await c.writeValueWithResponse(bytes);
  }

  async disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
  }
}
