# Otto Wilde G32 Connected – Web-App + ESP32-Bridge

Lokale Steuerung des Otto Wilde G32 Connected per Bluetooth (BLE), ohne Cloud:
Werte auslesen, Zieltemperaturen setzen und Gasflasche (GasBuddy) anlernen, beides in der App.

- **Web-App:** Plain JavaScript (ES-Module), keine Frameworks, kein Build-Schritt.
- **ESP32:** BLE-Bridge. Verbindet sich mit dem Grill und reicht Rohbytes per WebSocket an den Browser durch.
- **Test am Laptop:** Dieselbe Web-App spricht direkt per Web Bluetooth (Chrome/Edge) mit dem Grill.
- **Dynatrace (optional):** Ein Forwarder schickt die Werte der Bridge als Metriken an Dynatrace, eine Dynatrace-App
  zeigt sie live und im Verlauf. Siehe [forwarder/README.md](forwarder/README.md) und [dynatrace-app/README.md](dynatrace-app/README.md).

> Status: Lesen ist aus Fremdprojekten bekannt und im Dashboard umgesetzt, aber noch nicht am Grill getestet.
> Zieltemperaturen und Gasflasche werden **in der App** gesetzt bzw. angelernt (lokal im Browser), nicht am Grill.
> Siehe [docs/SPEC.md](docs/SPEC.md) und [docs/PROTOCOL.md](docs/PROTOCOL.md).

## Schnellstart (Laptop)

```bash
cd web
python3 serve.py          # Dev-Server ohne Caching (nicht python -m http.server, Chrome cached JS-Module)
# Chrome/Edge öffnen:
#   http://localhost:8000/index.html     Dashboard: 3 Seiten per Wischen (Zonen | Fühler mit Zielen | Config), Gas immer sichtbar
#   http://localhost:8000/explorer.html  BLE-Explorer (Services, Rohdaten, unbekannte Bytes)
node test/decoder.test.mjs && node test/logic.test.mjs   # Tests (Node 18+)
node ../forwarder/test/lines.test.mjs                     # Forwarder-Tests
```

Web Bluetooth funktioniert nur auf `localhost` oder über https, und nur in Chrome/Edge (nicht Firefox/Safari).
Für Handy (auch iOS) ohne Laptop: ESP32-Bridge, siehe [esp32/README.md](esp32/README.md).

Vorher:
1. Otto-Wilde-App am Handy **komplett schließen** (der Grill erlaubt vermutlich nur eine BLE-Verbindung).
2. Am Grill die Bluetooth-Taste 2 Sekunden drücken (Pairing-Modus).

## Struktur

```
docs/SPEC.md        Architektur, Meilensteine, Sicherheitsregeln
docs/PROTOCOL.md    Was über das BLE-Protokoll bekannt ist (wird laufend ergänzt)
web/                Web-App (Plain JS)
  index.html        Dashboard: Seiten Zonen / Fühler (mit Zielen) / Config (Verbindung, Gas, Flaschenprofile), Gas im Kopf immer sichtbar
  explorer.html     Services/Characteristics, Rohdaten-Log, dekodierte Werte
  js/g32.js         UUIDs und Konstanten
  js/decoder.js     Rohbytes -> Werte
  js/targets.js     Zielwerte: Grenzen, Status heizt/erreicht/zu heiß
  js/gas.js         Flaschenprofile, Zwei-Punkt-Kalibrierung
  js/store.js       Speicherung im Browser (localStorage)
  js/transport/     webbluetooth.js (Laptop), websocket.js (ESP32, Platzhalter)
  test/             Unit-Tests (Decoder, Ziele, Gas)
esp32/              ESP32-Bridge (PlatformIO): BLE -> WLAN, liefert das Dashboard aus, siehe esp32/README.md
tools/mock-bridge.mjs  Simulierte Bridge zum Testen ohne Hardware
forwarder/          Bridge -> Dynatrace Metrics API (Node 22+, ohne Abhängigkeiten)
dynatrace-app/      Dynatrace-App (React/Strato): Live-Werte und Verlauf aus den Forwarder-Metriken
```

## Sicherheit

- Die App sendet **nichts** an den Grill, nur Lesen. Ziele und Gasprofile sind reine App-Funktionen.
- Ziele werden auf Bereich und Schrittweite geprüft.
- Ein Ton ersetzt keine Aufsicht: Einen heißen Grill nie unbeaufsichtigt lassen.
- Inoffizielles Projekt, nicht von Otto Wilde. Nutzung auf eigene Gefahr.

## Danksagung
Protokoll-Fakten (UUIDs, Datenlayout) stammen aus den Projekten von
[JBecker32](https://github.com/JBecker32/G32-Display-480x320-BT) und
[fschwarz86](https://github.com/fschwarz86/g32) sowie dem GSV-Forum. Es wurde kein Code übernommen.
