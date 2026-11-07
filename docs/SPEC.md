# Spezifikation

## Ziele
1. Messwerte des G32 Connected per BLE auslesen (Zonen, Fühler, Gas, Haube, Licht).
2. Zieltemperaturen **in der App** setzen und überwachen (nicht am Grill): "heizt", "Ziel erreicht", "zu heiß".
3. Gasflasche **in der App** anlernen (Zwei-Punkt-Kalibrierung auf dem GasBuddy-Rohwert, mehrere Profile).

Nicht-Ziele: Zünden, Brenner direkt ein-/ausschalten, Befehle an den Grill, Cloud-Anbindung.
Ziele und Gasprofile liegen im Browser (localStorage) und werden nicht an den Grill übertragen.

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
  // Events: 'packet' (detail: {uuid, bytes}), 'status' (detail: string), 'error', 'disconnected'
  // Nur Lesen: kein write() im Transport
}
```

Implementierungen: `transport/webbluetooth.js` (Laptop), `transport/websocket.js` (ESP32).

### ESP32-Bridge (`esp32/`)
- NimBLE-Arduino als BLE-Central in eigenem FreeRTOS-Task: Scannen (Name `OWG-G32C…` oder Service-UUID),
  verbinden, `dc0f41e2` abonnieren, Reconnect, Watchdog (15 s ohne Paket -> trennen und neu verbinden).
- `WebServer` (Port 80) liefert `index.html`, `style.css` und `js/` aus LittleFS. `WebSocketsServer` auf Port 81.
- Die Bridge ist **read-only**: kein Schreibpfad zum Grill, eingehende WebSocket-Daten werden ignoriert.
- WebSocket-Frames (binär, ESP32 -> Browser): `[type:1][index:1][payload...]`
  - `0x01` Notification der Daten-Characteristic (index 0 = `dc0f41e2`), Payload = Rohpaket (32/33 Byte)
  - `0x10` Status-Text (UTF-8)
- Neu verbundene Browser bekommen sofort Status und das letzte Paket.
- Optional: Token als Query-Parameter beim WebSocket-Connect (`?token=...`).
- mDNS: `http://<HOSTNAME>.local`. Browser-Seite: Bridge-Modus automatisch, wenn die Seite nicht von `localhost` kommt
  (oder per `?bridge=<host>`), siehe `web/js/app.js`.

## Meilensteine
| # | Inhalt | Status |
|---|--------|--------|
| 0 | BLE-Explorer am Laptop | erledigt (`web/explorer.html`) |
| 1 | Decoder + Dashboard (nur lesen) via Web Bluetooth | gebaut, Test am Grill steht aus |
| 2 | Zieltemperaturen für Fühler in der App (+/-, Status, Ton); Zonen nur Anzeige | gebaut (`targets.js`) |
| 3 | Gasflasche anlernen in der App (Profile, Kalibrierung) | gebaut (`gas.js`) |
| 4 | ESP32-Bridge + WebSocket-Transport | gebaut; Browser-Seite mit Mock getestet, Firmware noch nicht auf Hardware |
| 5 | Optional: Ziele/Profile zusätzlich auf dem ESP32 ablegen, damit sie geräteübergreifend gelten | offen |

## Sicherheitsregeln
- Keine Zünd-/Brennerbefehle implementieren.
- Zielwerte: Bereich und Schrittweite prüfen (`targets.js`, Grenzen vorläufig, nach Test am Grill anpassen).
- Es wird nichts an den Grill geschrieben. Explorer und Dashboard sind read-only.
- Rohdaten-Mitschnitte vor Veröffentlichung von Seriennummer/Pop-Key bereinigen.

## Offene Fragen
- Meldet der GasBuddy-Rohwert (Bytes 22–23) brutto oder netto? Die Zwei-Punkt-Kalibrierung funktioniert in beiden Fällen.
- Sinnvolle Grenzen und Überschwing-Toleranzen für Zonen und Fühler (aktuell Zone 50–400 °C, Fühler 30–120 °C).
- Notify oder Polling der Daten-Characteristic? (Explorer zeigt die Properties.)
- Ein Handy-Browser kann nur mit Web Bluetooth (Chrome Android) direkt verbinden; iOS braucht die ESP32-Bridge.
