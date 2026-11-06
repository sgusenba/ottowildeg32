# Otto Wilde G32 Connected – Web-App + ESP32-Bridge

Lokale Steuerung des Otto Wilde G32 Connected per Bluetooth (BLE), ohne Cloud:
Werte auslesen, Zieltemperaturen setzen, später Gasflasche (GasBuddy) anlernen.

- **Web-App:** Plain JavaScript (ES-Module), keine Frameworks, kein Build-Schritt.
- **ESP32:** BLE-Bridge. Verbindet sich mit dem Grill und reicht Rohbytes per WebSocket an den Browser durch.
- **Test am Laptop:** Dieselbe Web-App spricht direkt per Web Bluetooth (Chrome/Edge) mit dem Grill.

> Status: Lesen ist aus Fremdprojekten bekannt und im Dashboard umgesetzt, aber noch nicht am Grill getestet.
> **Zieltemperatur am Grill setzen** ist offen: Das Schreibprotokoll ist nirgends dokumentiert und muss per
> HCI-Snoop-Log ermittelt werden. Siehe [docs/SPEC.md](docs/SPEC.md) und [docs/PROTOCOL.md](docs/PROTOCOL.md).

## Schnellstart (Laptop)

```bash
cd web
python3 -m http.server 8000
# Chrome/Edge öffnen:
#   http://localhost:8000/index.html     Dashboard (Zonen, Fühler, Gas, Alarmgrenzen)
#   http://localhost:8000/explorer.html  BLE-Explorer (Services, Rohdaten, unbekannte Bytes)
node test/decoder.test.mjs              # Decoder-Test (Node 18+)
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
  index.html        Dashboard: Zonen, Fühler, Gas, Haube/Licht, lokale Alarmgrenzen mit Ton
  explorer.html     Services/Characteristics, Rohdaten-Log, dekodierte Werte
  js/g32.js         UUIDs und Konstanten
  js/decoder.js     Rohbytes -> Werte
  js/transport/     webbluetooth.js (Laptop), websocket.js (ESP32, Platzhalter)
  test/             Decoder-Test
esp32/              Firmware der Bridge (folgt)
```

## Sicherheit

- Die App schreibt nur Temperatur-Sollwerte (und später GasBuddy-Werte), **nie** Zünd- oder Brennerbefehle.
- Sollwerte werden vor dem Senden auf Bereich und Schrittweite geprüft.
- Ein Grill mit gesetzter Zieltemperatur darf nicht unbeaufsichtigt laufen.
- Inoffizielles Projekt, nicht von Otto Wilde. Nutzung auf eigene Gefahr.

## Danksagung
Protokoll-Fakten (UUIDs, Datenlayout) stammen aus den Projekten von
[JBecker32](https://github.com/JBecker32/G32-Display-480x320-BT) und
[fschwarz86](https://github.com/fschwarz86/g32) sowie dem GSV-Forum. Es wurde kein Code übernommen.
