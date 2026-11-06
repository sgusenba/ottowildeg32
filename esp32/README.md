# ESP32-Bridge

Verbindet sich per BLE mit dem G32 Connected und liefert das Dashboard samt Live-Daten im WLAN aus.
Damit läuft die Web-App auf jedem Handy (auch iOS), ohne Laptop-Bluetooth.

```
Grill --BLE--> ESP32 --WLAN--> Browser    http://g32.local   (Seite)   +   ws://g32.local:81  (Daten)
```

**Status:** Der Code ist noch nicht auf echter Hardware gelaufen. Die verwendeten Bibliotheks-Aufrufe sind gegen
NimBLE-Arduino 1.4.3 und WebSockets 2.6.1 geprüft, ein Build war in der Entwicklungsumgebung nicht möglich.
Die Browser-Seite ist mit `tools/mock-bridge.mjs` getestet.

Die Bridge ist **read-only**: Sie abonniert nur die Daten-Characteristic `dc0f41e2` und schreibt nie an den Grill.
Eingehende WebSocket-Nachrichten werden ignoriert.

## Einrichten

1. [PlatformIO](https://platformio.org/install) installieren (VS Code Extension oder `pip install platformio`).
2. `src/config.h.example` nach `src/config.h` kopieren, WLAN-Name und Passwort eintragen.
3. ESP32 per USB anschließen, dann im Ordner `esp32/`:
   ```bash
   pio run -t upload       # Firmware
   pio run -t uploadfs     # Web-App (kopiert vorher ../web nach data/)
   pio device monitor      # Serial-Ausgabe, zeigt IP und Status
   ```
4. Am Handy `http://g32.local` öffnen. Wenn `.local` nicht aufgelöst wird (manche Android-Geräte),
   die IP aus dem Serial-Monitor verwenden.

Anderes Board als `esp32dev`? In `platformio.ini` den Eintrag `board` ändern. Für ESP32-S3 gibt es `-e esp32-s3`.

## Betrieb

- Der Grill erlaubt vermutlich nur **eine** BLE-Verbindung: Original-App und Laptop-Bluetooth vorher schließen.
- ESP32 in Reichweite des Grills platzieren (BLE ca. 10 m, ohne Metallwand dazwischen).
- Das Dashboard verbindet sich selbst und wiederverbindet nach Aussetzern automatisch.
- Statusmeldungen der Bridge erscheinen oben im Dashboard: „Suche Grill …“, „Verbinde mit Grill …“, „Grill verbunden“,
  „Keine Daten, trenne“ (nach 15 s ohne Paket verbindet die Bridge neu).

## Optionaler Zugriffsschutz

`WS_TOKEN` in `config.h` setzen (nur Buchstaben/Ziffern) und die Seite mit `http://g32.local/?token=<WS_TOKEN>` öffnen.
Das ist nur ein einfacher Schutz im Heimnetz, kein Ersatz für ein sicheres WLAN. Der Dienst liefert ausschließlich Lesewerte.

## Fehlersuche

| Symptom | Ursache / Lösung |
|---------|------------------|
| Seite meldet „index.html fehlt“ | `pio run -t uploadfs` vergessen |
| Dauerhaft „Suche Grill …“ | Grill aus/außer Reichweite, Original-App noch verbunden, Grill nicht im Pairing-Modus (Bluetooth-Taste 2 s) |
| „Daten-Characteristic nicht nutzbar“ | Firmware des Grills abweichend: Explorer am Laptop gegenprüfen (`web/explorer.html`) |
| Dashboard zeigt „Bridge nicht erreichbar“ | Falsche IP/Hostname, anderes WLAN, Port 81 blockiert |
| Seite über https geöffnet | Nicht möglich: Der Browser blockiert `ws://` auf https-Seiten. Immer `http://` verwenden |

## Ohne Hardware testen

```bash
node tools/mock-bridge.mjs
# http://localhost:8080/index.html?bridge=&wsport=8081
```
Simuliert Bridge und Grill (steigende Temperaturen, Fühler 1 steckt, Gasflasche).
