# WESIMA Energiecheck – Offline-Checkliste für das iPad

Statische Web-App (PWA). Läuft nach der Installation auf dem Home-Bildschirm ohne Netz.
Alle Kundendaten und Fotos liegen ausschließlich lokal auf dem iPad (IndexedDB) – im Repository sind keine Kundendaten.

## Einmalig: auf GitHub Pages veröffentlichen

1. Auf github.com neues Repository anlegen, z. B. `energiecheck`, Sichtbarkeit **Public**
   (GitHub Pages ist mit GitHub Free nur für öffentliche Repositories verfügbar. Öffentlich ist nur der App-Code, keine Daten).
2. Im Repository: **Add file → Upload files** → den kompletten Inhalt dieses Ordners hochladen
   (index.html, app.js, schema.js, style.css, sw.js, manifest.webmanifest, Ordner `icons`). → **Commit changes**.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch `main`, Ordner `/ (root)` → Save.
4. Nach 1–2 Minuten ist die App erreichbar unter `https://<dein-github-name>.github.io/energiecheck/`.

## Auf dem iPad installieren

1. Die Adresse **in Safari** öffnen (nicht in Chrome).
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. App einmal über das neue Symbol öffnen (dabei wird alles für offline gespeichert).
4. Test: Flugmodus an, App schließen und wieder öffnen → muss starten.

Wichtig: Immer über das Home-Bildschirm-Symbol arbeiten, nicht im Safari-Tab. Nur dort gelten die Speicherregeln für installierte Web-Apps.

## Ablauf pro Kunde

1. Rechnungen an Claude → du bekommst `energiecheck_<kunde>_vorab.json`.
2. Datei per AirDrop/Dateien-App aufs iPad, in der App **Kunde importieren**.
3. Vor Ort: Prüfpunkte abarbeiten, Module ausfüllen, Fotos aufnehmen. Pflichtfelder sind gelb markiert;
   wenn etwas nicht ermittelbar ist, „nicht ermittelbar / entfällt" anhaken.
4. **Übersicht → Exportieren** → ZIP (daten.json + Fotos) an Claude für die Analyse.
5. Erneuter Import einer Vorab-Datei für einen vorhandenen Kunden aktualisiert nur Vorab-Daten und ergänzt Prüfpunkte; Vor-Ort-Eingaben bleiben erhalten.
   Ein exportiertes ZIP kann auf einem anderen Gerät wieder importiert werden (Wiederherstellung inkl. Fotos).

## Updates der App

Geänderte Dateien hochladen und in `sw.js` die Zeile `const VERSION = 'ec-vN'` hochzählen.
Danach die App auf dem iPad einmal **online** öffnen, schließen und erneut öffnen.

## Datenformat

`daten.json`: `werte` (Feld-ID → Wert), `vorab.energietraeger[].perioden[]` (von, bis, verbrauch_kwh, kosten_brutto, quelle),
`pruefpunkte[]`, `fotoIndex[]`. Feld-IDs sind in `schema.js` definiert und dürfen nicht umbenannt werden (nur ergänzen).
