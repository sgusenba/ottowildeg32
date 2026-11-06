# BLE-Protokoll G32 Connected (Arbeitsstand)

Alles unter "Belegt" stammt aus laufenden Fremdprojekten (Quellen unten), ist aber am eigenen Grill
noch zu verifizieren. "Offen" ist ungeklärt.

## Belegt

**Gerät und GATT**
- Advertising-Name beginnt mit `OWG-G32C`.
- Service: `dc0f41ea-b6ae-46a8-a19e-1a3bf4342bcb`
- Daten-Characteristic: `dc0f41e2-b6ae-46a8-a19e-1a3bf4342bcb` (wird von einem ESPHome-Projekt per Read gepollt).
- Das ESPHome-Projekt verbindet ohne erkennbares Bonding/Pairing-Setup. Ob der Grill dafür den Pairing-Modus
  (Bluetooth-Taste 2 s) braucht, ist am eigenen Gerät zu prüfen.

**Datenblock** (Index = Byte-Offset, `hi`/`lo` = zwei aufeinanderfolgende Bytes)

| Bytes | Inhalt | Kodierung |
|-------|--------|-----------|
| 0–5 | unbekannt (Header) | – |
| 6–13 | Zone 1–4 | °C = `hi*10 + lo/10` |
| 14–21 | Fühler 1–4 | wie Zonen |
| 22–23 | GasBuddy Gewicht in g | uint16 big endian; ≥ 11000 wird als 11000 angezeigt |
| 24 | Haube offen | ≠ 0 |
| 25 | Licht an | ≠ 0 |
| 26–29 | unbekannt | – |
| 30 | unbekannt (Status?) | – |
| 31 | GasBuddy Füllstand in % | > 100 = unbekannt |

- Wert 1500 °C (`hi=150, lo=0`) bedeutet "nicht vorhanden/kein Fühler".
- Das Cloud-Paket (`socket.ottowildeapp.com:4502`, 1 Paket/s) hat dasselbe Layout wie BLE.
  Die Cloud-Funktion rechnet die Bytes 22–23 anders um (`((uint16 - 4192) - 10400) / 11000`), die Bedeutung
  ist unklar und nicht belegt. Für BLE wird die Gramm-Angabe oben verwendet.

**Cloud-API** (nur zur Orientierung, wird nicht genutzt)
- `https://mobile-api.ottowildeapp.com/login`, `/v2/grills`, `/firmware`.
- `gasbuddyInfo` in `/v2/grills`: `criticalLevel`, `gasCapacity`, `gasLevelCalibration`, `gasStock`,
  `tankInstalledDate`, `tareWeight`. Die Gas-Kalibrierung liegt also zumindest auch in der Cloud.

## Offen
- [ ] Welche weiteren Characteristics hat der Service (Write/Notify)? Der Explorer listet sie auf.
- [ ] Notifications statt Polling? (Explorer zeigt die Properties der Daten-Characteristic.)
- [ ] Schreibbefehle (Zieltemperatur am Grill, GasBuddy anlernen): In keinem der Fremdprojekte vorhanden, deren
  "Temperaturlimits" sind reine Display-Alarme. **Nicht mehr nötig:** Die App setzt Ziele und Gasprofile selbst
  (siehe SPEC.md). Nur relevant, falls der Grill die Werte später selbst regeln soll (HCI-Snoop-Log der Original-App).
- [ ] Bedeutung der Bytes 0–5, 26–30.
- [ ] Ist ein Pairing/Bonding nötig, und erlaubt der Grill gleichzeitig mehrere Verbindungen?

## Vorgehen für die offenen Punkte
1. **Explorer** (`web/explorer.html`): Services/Properties ansehen, Log mit Hex speichern. Zeigt auch unbekannte Bytes
   live, damit man sie durch Aktionen am Grill (Haube auf, Licht, Brenner an/aus) zuordnen kann.
2. **HCI-Snoop-Log (Android):** Entwickleroptionen -> "Bluetooth-HCI-Snoop-Log aktivieren", in der Original-App
   Temperatur setzen bzw. Flasche anlernen, Log per `adb bugreport` ziehen, in Wireshark Filter `btatt` -> Writes
   den App-Aktionen zuordnen.
3. Ergebnisse hier eintragen, dann Schreib-Funktion in `web/js/decoder.js` bzw. einem neuen `commands.js` bauen.

## Mitschnitt-Tabelle (Vorlage)

| Zeit | Aktion in der App | Richtung | Characteristic | Hex-Payload | Deutung |
|------|-------------------|----------|----------------|-------------|---------|
|      |                   |          |                |             |         |

## Quellen und Lizenzhinweis
- JBecker32, *G32-Display-480x320-BT* (ESPHome, GPL-3.0): UUIDs, Namenspräfix, Byte-Layout der BLE-Daten.
- fschwarz86, *g32*: Cloud-API und Socket-Dekodierung (Zonen/Fühler/Gas).
- Community: GSV-Forum, Thread "Otto Wilde G32 Connected Erfahrungen" (User Sandorson).

Aus diesen Projekten wurden nur Fakten (UUIDs, Byte-Offsets, Formeln) übernommen, kein Code.
