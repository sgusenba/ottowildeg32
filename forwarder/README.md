# G32 → Dynatrace Forwarder

Liest die Live-Daten der ESP32-Bridge (`ws://g32.local:81`) und schickt sie als Metriken an Dynatrace
(Metrics API v2, Line Protocol). Die [Dynatrace-App](../dynatrace-app/README.md) zeigt sie an.

```
Grill --BLE--> ESP32-Bridge --WebSocket--> Forwarder (Node) --HTTPS--> Dynatrace  <-- DQL --  Dynatrace-App
```

Läuft auf jedem Rechner im selben WLAN wie die Bridge (Raspberry Pi, NAS, Laptop). Node 22+, keine Abhängigkeiten.
Wie die Bridge ist er **read-only**: Er sendet nichts an den Grill.

## Start

1. In Dynatrace einen Access Token mit Scope **`metrics.ingest`** anlegen (Zugriffstoken → Token generieren).
2. Starten:
   ```bash
   DT_URL=https://abc12345.live.dynatrace.com \
   DT_TOKEN=dt0c01.XXXX \
   node forwarder/dynatrace-forwarder.mjs
   ```
3. Ohne Dynatrace testen: `node forwarder/dynatrace-forwarder.mjs --dry-run` (gibt die Zeilen nur aus).
   Ohne Grill: vorher `node tools/mock-bridge.mjs` starten und `BRIDGE_URL=ws://localhost:8081/` setzen.

| Variable | Standard | Bedeutung |
|----------|----------|-----------|
| `DT_URL` | – | Umgebung, z. B. `https://abc12345.live.dynatrace.com` (Managed: `https://<host>/e/<env-id>`) |
| `DT_TOKEN` | – | Token mit `metrics.ingest` |
| `DT_INGEST_URL` | aus `DT_URL` | Ganze Ingest-URL, z. B. lokaler OneAgent `http://localhost:14499/metrics/ingest` (dann ohne Token) |
| `BRIDGE_URL` | `ws://g32.local:81/` | WebSocket der Bridge |
| `BRIDGE_TOKEN` | – | Nur falls `WS_TOKEN` in der Bridge gesetzt ist |
| `INTERVAL_S` | `10` | Sendeintervall in Sekunden (min. 5). Der Grill liefert alle 2,4 s, gesendet wird der letzte Wert |
| `GAS_EMPTY`, `GAS_FULL` | – | Flaschenprofil (Rohwerte wie im Dashboard unter Config → Flaschenprofile), aktiviert `g32.gas.calibrated_percent` |
| `GRILL_NAME` | – | Zusätzliche Dimension `grill`, z. B. `Terrasse` |
| `FORWARDER_NAME` | Hostname | Dimension `forwarder` |

Fällt Dynatrace aus, puffert der Forwarder bis zu 5000 Zeilen und sendet sie nach. Abbrüche der Bridge werden mit
wachsender Wartezeit (bis 30 s) neu verbunden.

## Metriken

Alle mit Dimension `device` (Geräte-ID des Grills) und `forwarder`. Fehlende Zonen und nicht gesteckte Fühler werden
nicht gesendet (statt 1500 °C).

| Schlüssel | Einheit | Weitere Dimension |
|-----------|---------|-------------------|
| `g32.zone.temperature` | °C | `zone` = 1–4 |
| `g32.probe.temperature` | °C | `probe` = 1–4 |
| `g32.gas.percent` | % | vom Grill gemeldet (Byte 31) |
| `g32.gas.calibrated_percent`, `g32.gas.remaining_grams` | %, g | nur mit `GAS_EMPTY`/`GAS_FULL` |
| `g32.gas.raw` | Rohwert | Bytes 22–23 |
| `g32.hood.open`, `g32.light.on` | 0/1 | |
| `g32.bridge.connected` | 0/1 | Heartbeat: 1 = frische Grill-Daten (< 15 s), 0 = Bridge ohne Grill |

Die Schlüssel sind in `lines.mjs` festgelegt und werden von der App abgefragt. Bei Änderungen beide anpassen.

## Dauerbetrieb (systemd, Beispiel)

```ini
# /etc/systemd/system/g32-forwarder.service
[Unit]
Description=G32 -> Dynatrace Forwarder
After=network-online.target

[Service]
WorkingDirectory=/opt/ottowildeg32
EnvironmentFile=/etc/g32-forwarder.env   # DT_URL=..., DT_TOKEN=... (Rechte 600)
ExecStart=/usr/bin/node forwarder/dynatrace-forwarder.mjs
Restart=always

[Install]
WantedBy=multi-user.target
```

Tests: `node forwarder/test/lines.test.mjs`
