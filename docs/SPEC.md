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
| 2 | Zieltemperaturen in der App (+/-, Status, Ton) | gebaut (`targets.js`) |
| 3 | Gasflasche anlernen in der App (Profile, Kalibrierung) | gebaut (`gas.js`) |
| 4 | ESP32-Bridge + WebSocket-Transport | offen |
| 5 | Optional: Ziele/Profile zusätzlich auf dem ESP32 ablegen, damit sie geräteübergreifend gelten | offen |

Hinweis zu Meilenstein 4: Fertige ESPHome-Projekte lesen die Daten-Characteristic bereits stabil per BLE.
Der ESP32 braucht also nur Connect, Read/Notify und das Durchreichen. Das NimBLE-Gerüst bleibt klein.
Bei Read-only-Characteristic (kein Notify) pollt die Bridge im 1–2-Sekunden-Takt.

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
