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
| # | Inhalt | Status |
|---|--------|--------|
| 0 | BLE-Explorer am Laptop | erledigt (`web/explorer.html`) |
| 1 | Decoder + Dashboard (nur lesen) via Web Bluetooth | gebaut, Test am Grill steht aus |
| 1b | Lokale Alarmgrenzen (Ton), Gas-Warnung | gebaut |
| 2 | Zieltemperatur am Grill setzen | blockiert: Schreibprotokoll unbekannt, HCI-Snoop-Log nötig |
| 3 | ESP32-Bridge + WebSocket-Transport | offen |
| 4 | GasBuddy anlernen (falls BLE-fähig) | offen, hängt an Meilenstein 2 |

Hinweis zu Meilenstein 3: Fertige ESPHome-Projekte lesen die Daten-Characteristic bereits stabil per BLE.
Der ESP32 braucht also nur Connect, Read/Notify und das Durchreichen. Das NimBLE-Gerüst bleibt klein.
Bei Read-only-Characteristic (kein Notify) pollt die Bridge im 1–2-Sekunden-Takt.

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
