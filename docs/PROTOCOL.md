# BLE-Protokoll G32 Connected (Arbeitsstand)

Stand: Layout am eigenen Grill bestätigt (Mitschnitt vom 2026-11-06, 59 Pakete, Explorer). Quellen für die
Ausgangsbasis unten. "Offen" ist ungeklärt.

## Belegt

**Gerät und GATT**
- Advertising-Name beginnt mit `OWG-G32C`.
- Service: `dc0f41ea-b6ae-46a8-a19e-1a3bf4342bcb`
- Daten-Characteristic: `dc0f41e2-b6ae-46a8-a19e-1a3bf4342bcb`: **Read und Notify**. Notifications kommen alle
  ca. 2,4 s (Median 2401 ms, max 2521 ms), Polling ist nicht nötig. Ein Read direkt nach dem Verbinden liefert
  32 Byte, Notifications haben 33 Byte.
- Verbinden und Notifications abonnieren klappte im Test (Web Bluetooth, Chrome) ohne Bonding-Dialog.
- Zweite Characteristic `5f8b9bdc-86f7-4c68-9dce-3d1d4cb21b95` mit notify/indicate: Abonnieren schlägt mit
  "GATT Error Unknown" fehl. Rolle unbekannt, Kandidat für einen Befehls-/Antwortkanal (siehe Offen).

**GATT-Struktur** (Explorer-Mitschnitt; Properties noch nicht erfasst, der Explorer zeigte wegen eines Fehlers `[]`)

| Service | Characteristics |
|---------|-----------------|
| `0000180a` Device Information | `2a24` (Modellnummer), `2a26` (Firmware-Revision), `2a29` (Hersteller), außerdem `5f8b9bd0`, `5f8b9bda`, `5f8b9bdb`, `5f8b9bdc` (Basis `-86f7-4c68-9dce-3d1d4cb21b95`) |
| `dc0f41ea-…` (G32) | `dc0f41e1` (Rolle unbekannt, Schwester der Daten-Characteristic, Kandidat für Befehle), `dc0f41e2` (Daten) |
| `00001800` Generic Access | `2a00` (Gerätename), `2a01` (Appearance) |

Die vier `5f8b9bd…`-Characteristics liegen laut Mitschnitt unter dem Device-Information-Service. Wofür sie dienen,
ist unbekannt. Das Abonnieren von `5f8b9bdc` schlug fehl.

**Datenblock** (Index = Byte-Offset, `hi`/`lo` = zwei aufeinanderfolgende Bytes)

| Bytes | Inhalt | Kodierung |
|-------|--------|-----------|
| 0–1 | Kennung | immer `a3 3a` |
| 2–5 | Geräte-ID | identisch mit dem Suffix des Gerätenamens (`OWG-G32C-<id>`) |
| 6–13 | Zone 1–4 | °C = `hi*10 + lo/10` (bestätigt) |
| 14–21 | Fühler 1–4 | wie Zonen (bestätigt) |
| 22–23 | GasBuddy-Rohwert | uint16 big endian; Einheit/Bedeutung unbestätigt, siehe Offen |
| 24 | Haube offen | ≠ 0 (bestätigt) |
| 25 | Licht an | ≠ 0 (bestätigt) |
| 26–29 | unbekannt | im Test konstant `0d 01 04 05` |
| 30 | unbekannt | im Test konstant `ff` |
| 31 | GasBuddy Füllstand in % | > 100 = unbekannt; Bedeutung unbestätigt (im Test `08`) |
| 32 | Schlussbyte | `c3`, nur in Notifications; ändert sich nicht mit den Daten, also kein Prüfwert |

- Wert 1500 °C (`hi=150, lo=0`) bedeutet "nicht vorhanden/kein Fühler" (bestätigt: nicht gesteckte Fühler).

**Am eigenen Grill bestätigt** (Außentemperatur ca. 4 °C, Brenner aus)
- Zonen lasen 4/4/5/4 °C. Zone 2 stieg von 4 auf 5 °C.
- Fühler 1–4 wurden nacheinander gesteckt und mit der Hand erwärmt: 4 → 5 → 9 → 13 °C (Fühler 1), 22 → 19 °C
  (Fühler 2), 16 → 15 → 14 °C (Fühler 3), 14 → 13 °C (Fühler 4). Beim Abziehen sprang jeweils auf "nicht vorhanden".
- Haube öffnen schaltet auch das Licht ein (Bytes 24 und 25 beide 1). Licht allein: nur Byte 25.
- Gas-Rohwert pendelte zwischen 624 und 628 (Rauschen ca. ±2), Byte 31 blieb 8.
- Das Cloud-Paket (`socket.ottowildeapp.com:4502`, 1 Paket/s) hat dasselbe Layout wie BLE.
  Die Cloud-Funktion rechnet die Bytes 22–23 anders um (`((uint16 - 4192) - 10400) / 11000`), die Bedeutung
  ist unklar und nicht belegt. Für BLE wird die Gramm-Angabe oben verwendet.

**Cloud-API** (nur zur Orientierung, wird nicht genutzt)
- `https://mobile-api.ottowildeapp.com/login`, `/v2/grills`, `/firmware`.
- `gasbuddyInfo` in `/v2/grills`: `criticalLevel`, `gasCapacity`, `gasLevelCalibration`, `gasStock`,
  `tankInstalledDate`, `tareWeight`. Die Gas-Kalibrierung liegt also zumindest auch in der Cloud.

## Offen
- [ ] **GasBuddy:** Was bedeutet der Rohwert (624–628) und das Prozent-Byte (8)? Zu klären mit der Original-App
  (welche Flasche liegt auf, welcher Wert wird dort gezeigt). Die Gas-Kalibrierung in der App deckt das ab.
- [ ] Rolle der Characteristic `5f8b9bdc-…` (Abonnieren scheitert, vermutlich Pairing/Verschlüsselung nötig oder
  Indicate-only mit geschütztem Zugriff). Properties im Explorer-Abschnitt "Services" prüfen.
- [ ] Schreibbefehle (Zieltemperatur am Grill, GasBuddy anlernen): In keinem der Fremdprojekte vorhanden, deren
  "Temperaturlimits" sind reine Display-Alarme. **Nicht mehr nötig:** Die App setzt Ziele und Gasprofile selbst
  (siehe SPEC.md). Nur relevant, falls der Grill die Werte später selbst regeln soll (HCI-Snoop-Log der Original-App).
- [ ] Bedeutung der Bytes 26–30 (konstant, Burner-/Statusflags? Test mit eingeschaltetem Brenner nötig).
- [ ] Erlaubt der Grill gleichzeitig mehrere Verbindungen (z. B. App und ESP32)?

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
