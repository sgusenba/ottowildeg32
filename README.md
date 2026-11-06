# Otto Wilde G32 Connected – Web-App + ESP32-Bridge

Lokale Steuerung des Otto Wilde G32 Connected per Bluetooth (BLE), ohne Cloud:
Werte auslesen, Zieltemperaturen setzen, später Gasflasche (GasBuddy) anlernen.

- **Web-App:** Plain JavaScript (ES-Module), keine Frameworks, kein Build-Schritt.
- **ESP32:** BLE-Bridge. Verbindet sich mit dem Grill und reicht Rohbytes per WebSocket an den Browser durch.
- **Test am Laptop:** Dieselbe Web-App spricht direkt per Web Bluetooth (Chrome/Edge) mit dem Grill.

> Status: Protokoll noch unbekannt. Phase 0 ist der BLE-Explorer in `web/explorer.html`.
> Siehe [docs/SPEC.md](docs/SPEC.md) und [docs/PROTOCOL.md](docs/PROTOCOL.md).

## Schnellstart (Laptop)

```bash
cd web
python3 -m http.server 8000
# Chrome/Edge öffnen: http://localhost:8000/explorer.html
```

Web Bluetooth funktioniert nur auf `localhost` oder über https, und nur in Chrome/Edge (nicht Firefox/Safari).

Vorher:
1. Otto-Wilde-App am Handy **komplett schließen** (der Grill erlaubt vermutlich nur eine BLE-Verbindung).
2. Am Grill die Bluetooth-Taste 2 Sekunden drücken (Pairing-Modus).

## Struktur

```
docs/SPEC.md        Architektur, Meilensteine, Sicherheitsregeln
docs/PROTOCOL.md    Was über das BLE-Protokoll bekannt ist (wird laufend ergänzt)
web/                Web-App (Plain JS)
  explorer.html     Phase 0: Services/Characteristics/Notifications sichtbar machen
  index.html        Dashboard (folgt, sobald das Protokoll steht)
  js/transport/     webbluetooth.js (Laptop), websocket.js (ESP32)
  js/decoder.js     Rohbytes -> Werte (Stub)
esp32/              Firmware der Bridge (folgt)
```

## Sicherheit

- Die App schreibt nur Temperatur-Sollwerte (und später GasBuddy-Werte), **nie** Zünd- oder Brennerbefehle.
- Sollwerte werden vor dem Senden auf Bereich und Schrittweite geprüft.
- Ein Grill mit gesetzter Zieltemperatur darf nicht unbeaufsichtigt laufen.
- Inoffizielles Projekt, nicht von Otto Wilde. Nutzung auf eigene Gefahr.
