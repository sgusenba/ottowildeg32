# BLE-Protokoll G32 Connected (Arbeitsstand)

Wird nach jeder Analyse-Session ergänzt. Alles unter "Bekannt" ist belegt, "Hypothesen" sind ungeprüft.

## Bekannt (öffentliche Quellen)
- Die Cloud-Sensordaten (TCP `socket.ottowildeapp.com:4502`) sind laut Community-Analyse
  identisch mit dem Datenpaket, das der Grill per BLE sendet; das Binärformat ist größtenteils
  entschlüsselt (GSV-Forum, User Sandorson; Referenz-Repo `fschwarz86/g32`, `cloud_function.js`).
- Der Grill hat einen Pairing-Modus: Bluetooth-Taste am Touchpanel 2 s drücken.
- GasBuddy-Daten in der Cloud-API: `criticalLevel`, `gasCapacity`, `gasLevelCalibration`,
  `gasStock`, `tankInstalledDate`, `tareWeight`.

## Zu ermitteln (Phase 0)
- [ ] Advertising-Name / Service-UUIDs
- [ ] GATT-Services und Characteristics (UUID, Properties)
- [ ] Notification-Paketformat (Länge, Header, Prüfsumme)
- [ ] Byte-Layout der Werte (Brenner 1–n, Fühler, Gasstand, Akku)
- [ ] Schreibbefehl für Zieltemperatur
- [ ] Schreibbefehl für GasBuddy-Anlernen (falls vorhanden)

## Vorgehen
1. **nRF Connect (Handy):** Grill im Pairing-Modus scannen, Services/Characteristics notieren.
2. **Explorer:** `web/explorer.html` mit den gefundenen Service-UUIDs, Notifications loggen.
3. **HCI-Snoop-Log (Android):** Entwickleroptionen -> "Bluetooth-HCI-Snoop-Log aktivieren",
   in der Original-App Temperaturen setzen / Flasche anlernen, Log per `adb bugreport`
   ziehen, in Wireshark Filter `btatt` -> Writes den App-Aktionen zuordnen.
4. Ergebnisse hier eintragen, dann `web/js/decoder.js` implementieren.

## Mitschnitt-Tabelle (Vorlage)

| Zeit | Aktion in der App | Richtung | Characteristic | Hex-Payload | Deutung |
|------|-------------------|----------|----------------|-------------|---------|
|      |                   |          |                |             |         |

## Hypothesen
- (leer)
