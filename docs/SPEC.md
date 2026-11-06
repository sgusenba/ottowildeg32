# Spezifikation

## Ziele
1. Messwerte des G32 Connected per BLE auslesen (Brenner-/Fühlertemperaturen, Gasstand, Akku).
2. Zieltemperaturen setzen.
3. Optional: Gasflasche (GasBuddy) neu anlernen, falls per BLE möglich.

Nicht-Ziele: Zünden, Brenner direkt ein-/ausschalten, Cloud-Anbindung.

## Architektur

```
Grill <--BLE--> ESP32 <--WiFi/WebSocket--> Browser (Web-App)
Grill <--BLE (Web Bluetooth)--> Browser (Laptop-Test)
```

Der ESP32 ist bewusst "dumm": Er reicht Rohbytes in beide Richtungen durch.
Dekodieren der Messwerte und Bauen der Befehle passiert **nur im Browser** (`web/js/decoder.js`).
So gibt es einen einzigen Decoder, der ohne ESP32 testbar ist.

### Transport-Schnittstelle (JS)

```js
class Transport extends EventTarget {
  async connect()          // Verbindung aufbauen
  async disconnect()
  async write(bytes)       // Uint8Array an den Grill (Command-Characteristic)
  // Events: 'packet' (detail: {uuid, bytes}), 'status' (detail: string), 'error'
}
```

Implementierungen: `transport/webbluetooth.js` (Laptop), `transport/websocket.js` (ESP32).

### ESP32-Bridge
- NimBLE-Arduino als BLE-Central, Reconnect bei Abbruch.
- Webserver liefert `web/` aus LittleFS, WebSocket `/ws`.
- WebSocket-Protokoll: binär; Frame = `[type:1][uuid-index:1][payload...]`
  (type 0x01 = Notification vom Grill, 0x02 = Write zum Grill, 0x10 = Status-Text).
- Zugriffsschutz: einfacher Token beim WebSocket-Connect.

## Meilensteine
| # | Inhalt | Ergebnis |
|---|--------|----------|
| 0 | BLE-Explorer am Laptop, nRF Connect, HCI-Snoop-Log der Original-App | UUIDs, Paketformat -> `PROTOCOL.md` |
| 1 | Decoder + Dashboard (nur lesen) via Web Bluetooth | Live-Werte am Laptop |
| 2 | Temperaturen setzen (mit Validierung) | Sollwerte funktionieren |
| 3 | ESP32-Bridge + WebSocket-Transport | Handy im WLAN statt Laptop-BLE |
| 4 | GasBuddy anlernen (falls BLE-fähig) | Tara/Kapazität setzen |

## Sicherheitsregeln
- Keine Zünd-/Brennerbefehle implementieren.
- Sollwerte: Bereich und Schrittweite prüfen (Grenzen aus Protokoll-Analyse).
- Explorer ist read-only (kein Schreiben auf unbekannte Characteristics).
- Rohdaten-Mitschnitte vor Veröffentlichung von Seriennummer/Pop-Key bereinigen.

## Offene Fragen
- Verschlüsselung/Bonding beim Pairing?
- Format der Temperatur-Notifications (Byte-Layout, Einheit, Anzahl Brenner/Fühler).
- Kommando zum Setzen der Zieltemperatur (Characteristic, Opcode, Parameter).
- Läuft das GasBuddy-Anlernen über BLE oder nur über die Cloud-API (`gasbuddyInfo`)?
