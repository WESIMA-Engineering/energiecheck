// WESIMA Energiecheck – Checklisten-Schema
// Feld-IDs sind stabil und werden in der Analyse referenziert. Nicht umbenennen,
// nur ergänzen. Typen: text, textarea, number, select, yesno, multi, photo, date
'use strict';

const SCHEMA_VERSION = 1;

const YN = ['ja', 'nein', 'unbekannt'];

const SECTIONS = [
  {
    id: 'stammdaten', titel: 'Stammdaten & Gebäude', felder: [
      { id: 'name', label: 'Kunde', typ: 'text', pflicht: true },
      { id: 'adresse', label: 'Straße, Nr.', typ: 'text', pflicht: true },
      { id: 'plz', label: 'PLZ', typ: 'text', pflicht: true, hinweis: 'Nötig für den DWD-Klimafaktor' },
      { id: 'ort', label: 'Ort', typ: 'text', pflicht: true },
      { id: 'termin', label: 'Datum Vor-Ort-Termin', typ: 'date' },
      { id: 'gebaeudetyp', label: 'Gebäudetyp', typ: 'select', pflicht: true, optionen: ['Einfamilienhaus', 'Doppelhaushälfte', 'Reihenhaus', 'Zweifamilienhaus', 'Wohnung im MFH'] },
      { id: 'baujahr', label: 'Baujahr Gebäude', typ: 'number', pflicht: true },
      { id: 'wohnflaeche', label: 'Wohnfläche', typ: 'number', einheit: 'm²', pflicht: true },
      { id: 'flaeche_quelle', label: 'Quelle Wohnfläche', typ: 'select', optionen: ['Kundenangabe', 'Bauplan / Wohnflächenberechnung', 'Energieausweis', 'geschätzt'] },
      { id: 'keller', label: 'Keller', typ: 'select', optionen: ['kein Keller', 'unbeheizt', 'teilbeheizt', 'voll beheizt'] },
      { id: 'geschosse', label: 'Vollgeschosse (ohne Keller)', typ: 'number' },
      { id: 'dg_ausgebaut', label: 'Dachgeschoss ausgebaut', typ: 'yesno' },
      { id: 'personen', label: 'Personen im Haushalt', typ: 'number', pflicht: true },
      { id: 'anwesenheit', label: 'Anwesenheit tagsüber', typ: 'select', optionen: ['kaum', 'teilweise', 'überwiegend'] },
      { id: 'homeoffice', label: 'Homeoffice / Büro im Haus', typ: 'select', optionen: ['nein', 'gelegentlich', 'regelmäßig', 'Vollzeit'] },
      { id: 'energieausweis', label: 'Energieausweis vorhanden', typ: 'select', optionen: ['nein', 'Verbrauchsausweis', 'Bedarfsausweis'] },
      { id: 'energieausweis_foto', label: 'Energieausweis (Foto Seite 1–2)', typ: 'photo' },
      { id: 'gebaeude_foto', label: 'Ansicht Gebäude', typ: 'photo' },
    ]
  },
  {
    id: 'huelle', titel: 'Gebäudehülle', felder: [
      { id: 'dach_art', label: 'Dach / oberste Geschossdecke', typ: 'select', pflicht: true, optionen: ['ungedämmt', 'teilgedämmt / alt', 'gedämmt (nach 2002)', 'unbekannt'] },
      { id: 'dach_daemmung_cm', label: 'Dämmstärke Dach / OGD', typ: 'number', einheit: 'cm' },
      { id: 'dach_jahr', label: 'Jahr letzte Dachsanierung', typ: 'number' },
      { id: 'wand_art', label: 'Außenwand', typ: 'select', pflicht: true, optionen: ['ungedämmt (Baujahrstandard)', 'WDVS / Dämmung nachträglich', 'monolithisch hochdämmend', 'unbekannt'] },
      { id: 'wand_daemmung_cm', label: 'Dämmstärke Außenwand', typ: 'number', einheit: 'cm' },
      { id: 'wand_jahr', label: 'Jahr Fassadensanierung', typ: 'number' },
      { id: 'fenster_verglasung', label: 'Fenster Verglasung (überwiegend)', typ: 'select', pflicht: true, optionen: ['Einfach', 'Zweifach (alt, Isolierglas)', 'Zweifach Wärmeschutz', 'Dreifach'] },
      { id: 'fenster_jahr', label: 'Baujahr Fenster (Stempel im Scheibenzwischenraum)', typ: 'number' },
      { id: 'fenster_foto', label: 'Fenster / Glasstempel', typ: 'photo' },
      { id: 'kellerdecke', label: 'Kellerdecke / Bodenplatte', typ: 'select', optionen: ['ungedämmt', 'gedämmt', 'kein Keller / unbekannt'] },
      { id: 'rollladenkaesten', label: 'Rollladenkästen gedämmt/dicht', typ: 'yesno' },
      { id: 'haustuer', label: 'Haustür', typ: 'select', optionen: ['alt / undicht', 'ok', 'neu'] },
      { id: 'lueftung', label: 'Lüftungsanlage', typ: 'select', optionen: ['keine (Fensterlüftung)', 'Abluft', 'zentral mit WRG', 'dezentral mit WRG'] },
      { id: 'huelle_auffaellig', label: 'Auffälligkeiten (Schimmel, Zugluft, Wärmebrücken)', typ: 'textarea' },
      { id: 'huelle_fotos', label: 'Fotos Hülle', typ: 'photo' },
    ]
  },
  {
    id: 'heizung', titel: 'Heizung', felder: [
      { id: 'erzeuger_typ', label: 'Wärmeerzeuger', typ: 'select', pflicht: true, optionen: ['Gas-Brennwert', 'Gas-Niedertemperatur/Heizwert', 'Öl-Brennwert', 'Öl-Niedertemperatur', 'Pellet', 'Scheitholz', 'Wärmepumpe Luft/Wasser', 'Wärmepumpe Sole/Wasser', 'Fernwärme', 'Nachtspeicher/Stromdirekt', 'Hybrid', 'Sonstiges'] },
      { id: 'erzeuger_modell', label: 'Hersteller / Modell', typ: 'text' },
      { id: 'erzeuger_baujahr', label: 'Baujahr Wärmeerzeuger', typ: 'number', pflicht: true },
      { id: 'erzeuger_leistung', label: 'Nennleistung', typ: 'number', einheit: 'kW' },
      { id: 'typenschild_heizung', label: 'Typenschild Wärmeerzeuger', typ: 'photo', pflicht: true },
      { id: 'heizflaechen', label: 'Heizflächen', typ: 'select', optionen: ['Heizkörper', 'Fußbodenheizung', 'gemischt'] },
      { id: 'vorlauf_max', label: 'Vorlauftemperatur bei Auslegung / Heizkurve', typ: 'text', hinweis: 'z. B. Steilheit 1,4 / Niveau 0, oder VL 55 °C bei −12 °C' },
      { id: 'regelung_foto', label: 'Regler-Einstellungen (Fotos)', typ: 'photo' },
      { id: 'aussentemp_gefuehrt', label: 'Außentemperaturgeführt', typ: 'yesno' },
      { id: 'absenkung', label: 'Nacht-/Abwesenheitsabsenkung', typ: 'select', optionen: ['keine', 'Absenkung', 'Abschaltung', 'unbekannt'] },
      { id: 'pumpe', label: 'Heizkreispumpe', typ: 'select', pflicht: true, optionen: ['ungeregelt (alt, Stufen)', 'Hocheffizienzpumpe', 'im Gerät integriert', 'unbekannt'] },
      { id: 'pumpe_foto', label: 'Pumpe / Typenschild', typ: 'photo' },
      { id: 'abgleich', label: 'Hydraulischer Abgleich', typ: 'select', optionen: YN },
      { id: 'thermostate', label: 'Thermostatventile', typ: 'select', optionen: ['manuell alt', 'manuell neu (voreinstellbar)', 'smart / elektronisch', 'Einzelraumregelung FBH'] },
      { id: 'leitungsdaemmung', label: 'Leitungen in unbeheizten Räumen gedämmt', typ: 'select', optionen: ['vollständig', 'teilweise', 'nein', 'nicht zutreffend'] },
      { id: 'raumtemp', label: 'Raumtemperatur Wohnbereich (gemessen)', typ: 'number', einheit: '°C' },
      { id: 'abgasverlust', label: 'Abgasverlust lt. Schornsteinfeger', typ: 'number', einheit: '%' },
      { id: 'kehrbuch_foto', label: 'Messprotokoll Schornsteinfeger', typ: 'photo' },
      { id: 'zusatzheizung', label: 'Zusatzheizung (Kaminofen, Elektroheizer, IR)', typ: 'textarea' },
      { id: 'brennstoff_bestand', label: 'Tank-/Lagerstand (nur Öl/Pellets/Holz)', typ: 'text', hinweis: 'Menge + Datum, für Verbrauchsrechnung zwingend' },
      { id: 'gaszaehler_stand', label: 'Gaszählerstand heute', typ: 'number', einheit: 'm³' },
      { id: 'gaszaehler_foto', label: 'Gaszähler', typ: 'photo' },
      { id: 'heizung_fotos', label: 'Fotos Heizraum', typ: 'photo' },
    ]
  },
  {
    id: 'warmwasser', titel: 'Warmwasser', felder: [
      { id: 'ww_bereitung', label: 'Warmwasserbereitung', typ: 'select', pflicht: true, optionen: ['zentral über Heizung', 'zentral + Solarthermie', 'Wärmepumpe (Heizung)', 'Brauchwasser-WP', 'Elektro-Speicher', 'Durchlauferhitzer', 'Gas-Therme dezentral'] },
      { id: 'ww_speicher_l', label: 'Speichervolumen', typ: 'number', einheit: 'l' },
      { id: 'ww_speicher_jahr', label: 'Baujahr Speicher', typ: 'number' },
      { id: 'ww_speicher_ort', label: 'Aufstellort Speicher', typ: 'text' },
      { id: 'ww_temp', label: 'Solltemperatur', typ: 'number', einheit: '°C' },
      { id: 'zirkulation', label: 'Zirkulation', typ: 'select', pflicht: true, optionen: ['keine', 'Dauerbetrieb', 'Zeitprogramm', 'bedarfsgesteuert'] },
      { id: 'zirk_pumpe', label: 'Zirkulationspumpe (Typ / Leistung)', typ: 'text' },
      { id: 'solarthermie_m2', label: 'Solarthermie Kollektorfläche', typ: 'number', einheit: 'm²' },
      { id: 'ww_fotos', label: 'Fotos Speicher / Zirkulation', typ: 'photo' },
    ]
  },
  {
    id: 'strom', titel: 'Strom & Geräte', felder: [
      { id: 'zaehlerplatz_foto', label: 'Zählerplatz', typ: 'photo', pflicht: true },
      { id: 'zaehlertyp', label: 'Zählertyp Bezug', typ: 'select', pflicht: true, optionen: ['Ferraris', 'moderne Messeinrichtung (mME)', 'intelligentes Messsystem (iMSys)'] },
      { id: 'zaehler_bezug', label: 'Zählerstand Bezug (1.8.0) heute', typ: 'number', einheit: 'kWh' },
      { id: 'zaehler_einspeisung', label: 'Zählerstand Einspeisung (2.8.0) heute', typ: 'number', einheit: 'kWh' },
      { id: 'zwischenzaehler', label: 'Zwischen-/Unterzähler (WP, Wallbox …)', typ: 'textarea', hinweis: 'Was, Zählerstand, seit wann' },
      { id: 'grundlast_w', label: 'Grundlast gemessen', typ: 'number', einheit: 'W', pflicht: true },
      { id: 'grundlast_methode', label: 'Methode Grundlast', typ: 'select', optionen: ['Zähler-Momentanwert nachts', 'Monitoring/Lastgang', 'Zangen-/Rogowski-Messung', 'Zählerstand über Zeit'] },
      { id: 'grossverbraucher', label: 'Vorhandene Großverbraucher', typ: 'multi', optionen: ['Zweitkühlschrank', 'Gefriertruhe/-schrank', 'Wäschetrockner (Abluft/Kondens)', 'Wärmepumpentrockner', 'Elektroherd/Ceran', 'Induktion', 'Pool-Pumpe/-Heizung', 'Sauna', 'Whirlpool', 'Aquarium/Terrarium', 'Klimagerät', 'Server/NAS/IT im Dauerbetrieb', 'Elektro-/IR-Heizung', 'Teichpumpe', 'Werkstatt'] },
      { id: 'kuehl_alter', label: 'Kühl-/Gefriergeräte: Anzahl, Alter, Effizienzklasse', typ: 'textarea' },
      { id: 'beleuchtung_led', label: 'Beleuchtung LED-Anteil', typ: 'select', optionen: ['< 25 %', '25–75 %', '> 75 %', '100 %'] },
      { id: 'aussenbeleuchtung', label: 'Außen-/Dekobeleuchtung (Laufzeit, Leistung)', typ: 'textarea' },
      { id: 'standby_auffaellig', label: 'Standby-/Dauerläufer-Auffälligkeiten', typ: 'textarea' },
      { id: 'smarthome', label: 'Smart Home / Gebäudeautomation', typ: 'text' },
      { id: 'strom_fotos', label: 'Fotos Geräte / Typenschilder', typ: 'photo' },
    ]
  },
  {
    id: 'erzeugung', titel: 'PV, Speicher, Mobilität', felder: [
      { id: 'pv', label: 'PV-Anlage vorhanden', typ: 'yesno', pflicht: true },
      { id: 'pv_kwp', label: 'PV-Leistung', typ: 'number', einheit: 'kWp' },
      { id: 'pv_inbetrieb', label: 'Inbetriebnahme PV', typ: 'text' },
      { id: 'pv_ausrichtung', label: 'Ausrichtung / Neigung', typ: 'text' },
      { id: 'wr_modell', label: 'Wechselrichter Hersteller/Modell', typ: 'text' },
      { id: 'wr_foto', label: 'Typenschild Wechselrichter', typ: 'photo' },
      { id: 'speicher_kwh', label: 'Batteriespeicher nutzbar', typ: 'number', einheit: 'kWh' },
      { id: 'pv_erzeugung_jahr', label: 'PV-Erzeugung 12 Monate (Monitoring)', typ: 'number', einheit: 'kWh' },
      { id: 'monitoring_export', label: 'Monitoring-Export erhalten', typ: 'select', optionen: ['ja, Monatswerte', 'ja, Tages-/Lastgangwerte', 'nein, nachreichen', 'kein Monitoring'] },
      { id: 'monitoring_foto', label: 'Screenshot Monitoring (Jahresbilanz)', typ: 'photo' },
      { id: 'einspeiseverguetung', label: 'Einspeisevergütung', typ: 'number', einheit: 'ct/kWh' },
      { id: 'wallbox', label: 'Wallbox', typ: 'select', optionen: ['keine', '11 kW', '22 kW', 'geplant'] },
      { id: 'eauto_km', label: 'E-Auto Fahrleistung', typ: 'number', einheit: 'km/a' },
      { id: 'eauto_laden_kwh', label: 'Ladeenergie zuhause', typ: 'number', einheit: 'kWh/a' },
      { id: 'dyn_tarif', label: 'Dynamischer Stromtarif', typ: 'yesno' },
      { id: 'p14a', label: '§14a EnWG angemeldet', typ: 'select', optionen: ['nein', 'Modul 1', 'Modul 2', 'Modul 1 + 3', 'unbekannt'] },
      { id: 'ems', label: 'Energiemanagement vorhanden (was steuert was?)', typ: 'textarea' },
    ]
  },
  {
    id: 'nutzer', titel: 'Nutzung & Ziele', felder: [
      { id: 'wunschtemp', label: 'Wunschtemperatur Wohnen', typ: 'number', einheit: '°C' },
      { id: 'lueften', label: 'Lüftungsverhalten', typ: 'select', optionen: ['Stoßlüften', 'Kippfenster dauerhaft', 'gemischt'] },
      { id: 'ww_nutzung', label: 'Warmwassernutzung', typ: 'select', optionen: ['sparsam', 'normal', 'intensiv (Wanne, lange Duschen)'] },
      { id: 'veraenderungen', label: 'Veränderungen im Abrechnungszeitraum (Personen, Leerstand, neue Geräte)', typ: 'textarea', pflicht: true },
      { id: 'geplant', label: 'Geplante Maßnahmen / Anschaffungen', typ: 'textarea' },
      { id: 'kundenziel', label: 'Ziel des Kunden (Kosten, Komfort, Klima, Autarkie)', typ: 'textarea', pflicht: true },
      { id: 'budget', label: 'Budget / Zeithorizont', typ: 'text' },
    ]
  },
  {
    id: 'notizen', titel: 'Notizen', felder: [
      { id: 'notizen', label: 'Freie Notizen', typ: 'textarea' },
      { id: 'notiz_fotos', label: 'Weitere Fotos', typ: 'photo' },
    ]
  },
];
