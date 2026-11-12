# G32 Grill – Dynatrace App

Dynatrace-App (AppEngine, React + Strato) für die Metriken des [G32-Forwarders](../forwarder/README.md).

- **Live:** Verbindungsstatus, Haube/Licht, Gas-Füllstand (Warnung ab ≤ 10 %), Zonen 1–4, Fühler 1–4.
  Aktualisiert sich alle 15 s.
- **Verlauf:** Zonen, Fühler, Gas und Haube/Licht/Verbindung als Zeitreihen, Zeitraum frei wählbar.

Die Daten kommen per DQL aus Grail (`timeseries … g32.*`), die Abfragen stehen in `ui/app/queries.ts`.
Zielwerte und Alarme bleiben im Web-Dashboard (lokal im Browser), die App zeigt nur die Messwerte.

**Status:** `dt-app build` läuft durch, gegen eine echte Umgebung ist die App noch nicht gelaufen
(DQL-Abfragen also noch nicht live geprüft).

## Voraussetzungen

- Dynatrace SaaS mit Grail (Platform) und Berechtigung, Apps zu installieren (`app-engine:apps:install`).
- Der Forwarder läuft und sendet an dieselbe Umgebung.
- Node.js 24 wird von `dt-app` empfohlen (20.19+ funktioniert mit Warnung).

## Einrichten

1. In `app.config.json` die eigene Umgebung eintragen: `"environmentUrl": "https://<env-id>.apps.dynatrace.com/"`
   (der Wert `abc12345` ist ein Platzhalter).
2. Im Ordner `dynatrace-app/`:
   ```bash
   npm ci
   npm start          # Entwicklungsserver, öffnet die App gegen die Umgebung (Login im Browser)
   npm run deploy     # baut und installiert die App in der Umgebung
   ```
3. In Dynatrace unter Apps → **G32 Grill** öffnen. Die App fragt beim ersten Start nach den Scopes
   `storage:metrics:read` und `storage:buckets:read`.

Kommen keine Werte an, im Notebook prüfen: `timeseries avg(g32.zone.temperature), by:{zone}`.
Ist das leer, sendet der Forwarder nicht (Token-Scope `metrics.ingest`, `DT_URL` mit `.live.` statt `.apps.`).

## Struktur

```
app.config.json        App-ID my.g32.grill, Scopes, Umgebung
ui/main.tsx            Einstieg (AppRoot, Router)
ui/app/App.tsx         Seiten Live und Verlauf
ui/app/queries.ts      DQL auf die Forwarder-Metriken
ui/app/format.ts       Anzeige, Gas-Warnschwelle, Verbindungsstatus
ui/app/pages/          Live.tsx, History.tsx
ui/app/components/     Header, Kachel, Fehleranzeige
```
