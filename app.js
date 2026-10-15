// WESIMA Energiecheck – Offline-App (IndexedDB, keine externen Abhängigkeiten)
'use strict';

const FORMAT = 'wesima-energiecheck';
const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fmt = (n, d = 0) => (n == null || n === '' || isNaN(n)) ? '–' : Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('de-DE') : '–';
const tageZwischen = (von, bis) => Math.round((new Date(bis) - new Date(von)) / 86400000) + 1;

// ---------- IndexedDB ----------
let dbP;
function db() {
  if (!dbP) dbP = new Promise((res, rej) => {
    const r = indexedDB.open('wesima-energiecheck', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('kunden', { keyPath: 'id' });
      const f = d.createObjectStore('fotos', { keyPath: 'id' });
      f.createIndex('kundeId', 'kundeId');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbP;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
  });
}
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const kundenAlle = () => tx('kunden', 'readonly', s => req(s.getAll()));
const kundeGet = id => tx('kunden', 'readonly', s => req(s.get(id)));
const kundePut = k => { k.geaendert = new Date().toISOString(); return tx('kunden', 'readwrite', s => s.put(k)); };
const fotoPut = f => tx('fotos', 'readwrite', s => s.put(f));
const fotoGet = id => tx('fotos', 'readonly', s => req(s.get(id)));
const fotoDel = id => tx('fotos', 'readwrite', s => s.delete(id));
const fotosVonKunde = kid => tx('fotos', 'readonly', s => req(s.index('kundeId').getAll(kid)));
async function kundeLoeschen(k) {
  const fotos = await fotosVonKunde(k.id);
  for (const f of fotos) await fotoDel(f.id);
  await tx('kunden', 'readwrite', s => s.delete(k.id));
}

function neuerKunde(teil = {}) {
  return {
    format: FORMAT, schemaVersion: SCHEMA_VERSION, id: uid(),
    angelegt: new Date().toISOString(), geaendert: null, exportiert: null,
    werte: {}, fotos: {}, vorab: { energietraeger: [], luecken: [], hinweise: [] }, pruefpunkte: [],
    ...teil,
  };
}

// ---------- ZIP (STORE, ohne Kompression) ----------
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipErstellen(dateien) { // [{name, data: Uint8Array}]
  const enc = new TextEncoder(); const teile = []; const zentral = []; let off = 0;
  for (const f of dateien) {
    const name = enc.encode(f.name); const crc = crc32(f.data); const n = f.data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
    h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, n, true); h.setUint32(22, n, true);
    h.setUint16(26, name.length, true);
    teile.push(new Uint8Array(h.buffer), name, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, n, true); c.setUint32(24, n, true); c.setUint16(28, name.length, true);
    c.setUint32(42, off, true);
    zentral.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + n;
  }
  const zLen = zentral.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, dateien.length, true); e.setUint16(10, dateien.length, true);
  e.setUint32(12, zLen, true); e.setUint32(16, off, true);
  return new Blob([...teile, ...zentral, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
function zipLesen(buf) { // nur eigene STORE-Archive
  const dv = new DataView(buf); const dec = new TextDecoder(); const out = {}; let p = 0;
  while (p + 30 <= buf.byteLength && dv.getUint32(p, true) === 0x04034b50) {
    const methode = dv.getUint16(p + 8, true); const n = dv.getUint32(p + 18, true);
    const nl = dv.getUint16(p + 26, true); const xl = dv.getUint16(p + 28, true);
    const name = dec.decode(new Uint8Array(buf, p + 30, nl));
    if (methode !== 0) throw new Error('Komprimierte ZIP-Dateien werden nicht unterstützt (nur App-Exporte).');
    out[name] = new Uint8Array(buf, p + 30 + nl + xl, n);
    p += 30 + nl + xl + n;
  }
  return out;
}

// ---------- Fotos ----------
const fotoBlob = f => f.blob || new Blob([f.data], { type: f.type || 'image/jpeg' });
async function bildVerkleinern(file, max = 1800, q = 0.82) {
  const bmp = await createImageBitmap(file).catch(() => null);
  let src = bmp, w, h;
  if (!bmp) { // Fallback ältere Safari
    src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  w = src.width; h = src.height;
  const f = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * f); c.height = Math.round(h * f);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(res, 'image/jpeg', q));
}

// ---------- Status / Fortschritt ----------
function istGefuellt(k, f) {
  if (f.typ === 'photo') return (k.fotos[f.id] || []).length > 0;
  const v = k.werte[f.id];
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== '';
}
function fortschritt(k, sec) {
  const pf = sec.felder.filter(f => f.pflicht);
  const ok = pf.filter(f => istGefuellt(k, f) || k.werte[f.id + '__na']).length;
  const alle = sec.felder.filter(f => istGefuellt(k, f)).length;
  return { pflicht: pf.length, pflichtOk: ok, gefuellt: alle, gesamt: sec.felder.length };
}
function offenePflicht(k) {
  const out = [];
  for (const s of SECTIONS) for (const f of s.felder) if (f.pflicht && !istGefuellt(k, f) && !k.werte[f.id + '__na']) out.push({ s, f });
  return out;
}

// ---------- Auswertung Vorab ----------
function traegerSumme(t) {
  const p = t.perioden || [];
  const kwh = p.reduce((a, x) => a + (Number(x.verbrauch_kwh) || 0), 0);
  const eur = p.reduce((a, x) => a + (Number(x.kosten_brutto) || 0), 0);
  const tage = p.reduce((a, x) => a + (x.von && x.bis ? tageZwischen(x.von, x.bis) : 0), 0);
  const sort = [...p].filter(x => x.von && x.bis).sort((a, b) => a.von.localeCompare(b.von));
  const luecken = [];
  for (let i = 1; i < sort.length; i++) {
    const ende = new Date(sort[i - 1].bis); ende.setDate(ende.getDate() + 1);
    const naechst = new Date(sort[i].von);
    if (naechst > ende) { const b = new Date(naechst); b.setDate(b.getDate() - 1); luecken.push([ende.toISOString().slice(0, 10), b.toISOString().slice(0, 10)]); }
  }
  return { kwh, eur, tage, von: sort[0]?.von, bis: sort.at(-1)?.bis, luecken, hochgerechnet: tage ? kwh / tage * 365 : null };
}

// ---------- Rendering ----------
const app = () => $('#app');
let aktKunde = null, aktTab = 'uebersicht';
let speicherTimer = null;
function speichernVerzoegert() {
  clearTimeout(speicherTimer);
  $('#speicherstatus').textContent = 'speichert …';
  speicherTimer = setTimeout(async () => { await kundePut(aktKunde); $('#speicherstatus').textContent = 'gespeichert'; }, 400);
}

async function zeigeStart() {
  aktKunde = null;
  const kunden = (await kundenAlle()).sort((a, b) => (b.geaendert || b.angelegt).localeCompare(a.geaendert || a.angelegt));
  $('#titel').textContent = 'Energiecheck';
  $('#zurueck').hidden = true; $('#speicherstatus').textContent = '';
  app().innerHTML = `
    <div class="aktionen">
      <button class="btn primaer" id="neu">+ Neuer Kunde</button>
      <label class="btn">Kunde importieren<input type="file" id="import" accept=".json,.zip,application/json,application/zip" hidden></label>
    </div>
    ${kunden.length ? '' : '<p class="leer">Noch keine Kunden. Lege einen an oder importiere eine Vorab-Datei.</p>'}
    <ul class="liste">${kunden.map(k => {
      const op = offenePflicht(k).length;
      const ppOffen = k.pruefpunkte.filter(p => p.status === 'offen').length;
      const exportAlt = !k.exportiert || (k.geaendert && k.geaendert > k.exportiert);
      return `<li data-id="${k.id}">
        <div><strong>${esc(k.werte.name || 'Ohne Namen')}</strong><br><span class="klein">${esc([k.werte.adresse, k.werte.ort].filter(Boolean).join(', '))}</span></div>
        <div class="badges">
          ${op ? `<span class="badge warn">${op} Pflicht offen</span>` : '<span class="badge ok">Pflicht komplett</span>'}
          ${ppOffen ? `<span class="badge">${ppOffen} Prüfpunkte</span>` : ''}
          ${exportAlt ? '<span class="badge rot">nicht exportiert</span>' : ''}
        </div></li>`;
    }).join('')}</ul>
    <p class="klein fuss">Daten liegen nur auf diesem Gerät. Nach jedem Termin exportieren. · Schema v${SCHEMA_VERSION}</p>`;
  $('#neu').onclick = async () => { const k = neuerKunde(); await kundePut(k); oeffne(k.id, 'stammdaten'); };
  $('#import').onchange = e => importieren(e.target.files[0]);
  app().querySelectorAll('.liste li').forEach(li => li.onclick = () => oeffne(li.dataset.id));
}

async function oeffne(id, tab = 'uebersicht') {
  aktKunde = await kundeGet(id);
  aktTab = tab;
  $('#zurueck').hidden = false;
  rendereKunde();
}

function tabs() {
  return [['uebersicht', 'Übersicht'], ['verbrauch', 'Verbrauch'], ['pruef', 'Prüfpunkte'], ...SECTIONS.map(s => [s.id, s.titel])];
}

function rendereKunde() {
  const k = aktKunde;
  $('#titel').textContent = k.werte.name || 'Kunde';
  const tabHtml = tabs().map(([id, t]) => {
    const sec = SECTIONS.find(s => s.id === id);
    let mark = '';
    if (sec) { const f = fortschritt(k, sec); mark = f.pflicht ? (f.pflichtOk === f.pflicht ? ' ✓' : ` (${f.pflicht - f.pflichtOk})`) : ''; }
    if (id === 'pruef') { const o = k.pruefpunkte.filter(p => p.status === 'offen').length; mark = o ? ` (${o})` : ''; }
    return `<button class="tab ${id === aktTab ? 'aktiv' : ''}" data-tab="${id}">${esc(t)}${mark}</button>`;
  }).join('');
  app().innerHTML = `<nav class="tabs">${tabHtml}</nav><section id="inhalt"></section>`;
  app().querySelectorAll('.tab').forEach(b => b.onclick = () => { aktTab = b.dataset.tab; rendereKunde(); window.scrollTo(0, 0); });
  const el = $('#inhalt');
  if (aktTab === 'uebersicht') return rendereUebersicht(el);
  if (aktTab === 'verbrauch') return rendereVerbrauch(el);
  if (aktTab === 'pruef') return renderePruef(el);
  rendereSektion(el, SECTIONS.find(s => s.id === aktTab));
}

function rendereUebersicht(el) {
  const k = aktKunde; const op = offenePflicht(k);
  el.innerHTML = `
    <div class="karte">
      <h2>Stand</h2>
      <table class="tab-uebersicht">${SECTIONS.map(s => { const f = fortschritt(k, s); return `<tr><td>${esc(s.titel)}</td><td>${f.gefuellt}/${f.gesamt} Felder</td><td>${f.pflicht ? `${f.pflichtOk}/${f.pflicht} Pflicht` : ''}</td></tr>`; }).join('')}</table>
      <p>Letzter Export: <strong>${k.exportiert ? new Date(k.exportiert).toLocaleString('de-DE') : 'noch nie'}</strong></p>
      <div class="aktionen"><button class="btn primaer" id="exp">Exportieren (ZIP für Analyse)</button></div>
    </div>
    ${op.length ? `<div class="karte"><h2>Offene Pflichtfelder (${op.length})</h2><ul class="einfach">${op.map(({ s, f }) => `<li><a href="#" data-sec="${s.id}">${esc(s.titel)}</a> · ${esc(f.label)}</li>`).join('')}</ul></div>` : ''}
    ${(k.vorab.hinweise || []).length ? `<div class="karte"><h2>Hinweise aus der Vorab-Auswertung</h2><ul class="einfach">${k.vorab.hinweise.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
    <div class="karte gefahr"><button class="btn" id="del">Kunde auf diesem Gerät löschen</button></div>`;
  $('#exp').onclick = exportieren;
  el.querySelectorAll('[data-sec]').forEach(a => a.onclick = e => { e.preventDefault(); aktTab = a.dataset.sec; rendereKunde(); });
  $('#del').onclick = async () => {
    const exp = aktKunde.exportiert && aktKunde.geaendert <= aktKunde.exportiert;
    if (!confirm(`${aktKunde.werte.name || 'Kunde'} mit allen Fotos löschen?${exp ? '' : '\n\nACHTUNG: Der aktuelle Stand ist NICHT exportiert.'}`)) return;
    await kundeLoeschen(aktKunde); zeigeStart();
  };
}

function rendereVerbrauch(el) {
  const k = aktKunde; const v = k.vorab;
  el.innerHTML = `
    ${v.energietraeger.map((t, ti) => { const s = traegerSumme(t); return `
      <div class="karte">
        <h2>${esc(t.art)} <span class="klein">${esc(t.versorger || '')}</span></h2>
        <p class="klein">Zähler ${esc(t.zaehlernummer || '–')} · MaLo ${esc(t.malo || '–')}${t.hinweis ? ' · ' + esc(t.hinweis) : ''}</p>
        <div class="scroll"><table class="daten"><thead><tr><th>von</th><th>bis</th><th>Tage</th><th>kWh</th><th>€ brutto</th><th>Quelle</th><th></th></tr></thead><tbody>
        ${(t.perioden || []).map((p, pi) => `<tr class="${p.unsicher ? 'unsicher' : ''}"><td>${fmtDate(p.von)}</td><td>${fmtDate(p.bis)}</td><td>${p.von && p.bis ? tageZwischen(p.von, p.bis) : ''}</td><td class="r">${fmt(p.verbrauch_kwh, 2)}</td><td class="r">${fmt(p.kosten_brutto, 2)}</td><td class="klein">${esc(p.quelle || '')}${p.hinweis ? '<br>' + esc(p.hinweis) : ''}</td><td><button class="mini" data-del="${ti}:${pi}">✕</button></td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="2">Summe</td><td>${s.tage}</td><td class="r">${fmt(s.kwh, 0)}</td><td class="r">${fmt(s.eur, 2)}</td><td colspan="2" class="klein">${s.von ? fmtDate(s.von) + ' – ' + fmtDate(s.bis) : ''}</td></tr></tfoot></table></div>
        ${s.luecken.length ? `<p class="warnung">Lücken: ${s.luecken.map(l => fmtDate(l[0]) + '–' + fmtDate(l[1])).join(', ')}</p>` : ''}
        <details><summary>Periode hinzufügen</summary>
          <div class="raster3" data-add="${ti}">
            <label>von<input type="date" name="von"></label><label>bis<input type="date" name="bis"></label>
            <label>kWh<input type="number" step="any" inputmode="decimal" name="kwh"></label>
            <label>€ brutto<input type="number" step="any" inputmode="decimal" name="eur"></label>
            <label class="breit">Quelle / Hinweis<input type="text" name="quelle" placeholder="z. B. Zählerablesung vor Ort"></label>
            <button class="btn">Übernehmen</button>
          </div></details>
      </div>`; }).join('')}
    <div class="karte"><details><summary>Energieträger hinzufügen</summary>
      <div class="raster3" id="neuTraeger">
        <label>Art<select name="art"><option>Strom (Netzbezug)</option><option>Erdgas</option><option>Heizöl</option><option>Pellets</option><option>Scheitholz</option><option>Fernwärme</option><option>Flüssiggas</option><option>Strom Wärmepumpe (separat)</option><option>PV-Erzeugung</option><option>Einspeisung</option></select></label>
        <label>Versorger<input name="versorger"></label><label>Zählernummer<input name="zaehlernummer"></label>
        <button class="btn">Anlegen</button></div></details></div>
    ${(v.luecken || []).length ? `<div class="karte"><h2>Fehlende Unterlagen</h2><ul class="einfach">${v.luecken.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>` : ''}`;
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    const [ti, pi] = b.dataset.del.split(':').map(Number);
    if (!confirm('Periode löschen?')) return;
    k.vorab.energietraeger[ti].perioden.splice(pi, 1); speichernVerzoegert(); rendereKunde();
  });
  el.querySelectorAll('[data-add]').forEach(box => $('button', box).onclick = () => {
    const g = n => $(`[name=${n}]`, box).value;
    if (!g('von') || !g('bis') || g('kwh') === '') return alert('von, bis und kWh sind nötig.');
    k.vorab.energietraeger[+box.dataset.add].perioden.push({ von: g('von'), bis: g('bis'), verbrauch_kwh: Number(g('kwh')), kosten_brutto: g('eur') === '' ? null : Number(g('eur')), quelle: g('quelle') || 'manuell erfasst' });
    speichernVerzoegert(); rendereKunde();
  });
  $('#neuTraeger button').onclick = () => {
    const b = $('#neuTraeger'); const g = n => $(`[name=${n}]`, b).value;
    k.vorab.energietraeger.push({ id: uid(), art: g('art'), versorger: g('versorger'), zaehlernummer: g('zaehlernummer'), perioden: [] });
    speichernVerzoegert(); rendereKunde();
  };
}

function renderePruef(el) {
  const k = aktKunde;
  el.innerHTML = `${k.pruefpunkte.length ? '' : '<p class="leer">Keine Prüfpunkte.</p>'}
    ${k.pruefpunkte.map((p, i) => `<div class="karte pruef ${p.status}">
      <div class="kopf"><strong>${esc(p.titel)}</strong>
        <select data-i="${i}" class="status">${['offen', 'erledigt', 'entfällt'].map(s => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      ${p.text ? `<p>${esc(p.text)}</p>` : ''}
      ${p.feld ? `<p class="klein">→ Feld: <a href="#" data-feld="${esc(p.feld)}">${esc(feldLabel(p.feld))}</a></p>` : ''}
      <textarea data-n="${i}" placeholder="Befund vor Ort">${esc(p.notiz || '')}</textarea></div>`).join('')}
    <div class="karte"><details><summary>Prüfpunkt hinzufügen</summary>
      <input id="ppNeu" placeholder="Titel"><button class="btn" id="ppAdd">Hinzufügen</button></details></div>`;
  el.querySelectorAll('.status').forEach(s => s.onchange = () => { k.pruefpunkte[+s.dataset.i].status = s.value; speichernVerzoegert(); rendereKunde(); });
  el.querySelectorAll('[data-n]').forEach(t => t.oninput = () => { k.pruefpunkte[+t.dataset.n].notiz = t.value; speichernVerzoegert(); });
  el.querySelectorAll('[data-feld]').forEach(a => a.onclick = e => { e.preventDefault(); springeZuFeld(a.dataset.feld); });
  $('#ppAdd').onclick = () => { const t = $('#ppNeu').value.trim(); if (!t) return; k.pruefpunkte.push({ id: uid(), titel: t, status: 'offen', quelle: 'vor Ort' }); speichernVerzoegert(); rendereKunde(); };
}
function feldLabel(id) { for (const s of SECTIONS) { const f = s.felder.find(f => f.id === id); if (f) return `${s.titel} · ${f.label}`; } return id; }
function springeZuFeld(id) {
  const s = SECTIONS.find(s => s.felder.some(f => f.id === id)); if (!s) return;
  aktTab = s.id; rendereKunde();
  const el = document.getElementById('f_' + id); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('blink'); }
}

function rendereSektion(el, sec) {
  const k = aktKunde;
  el.innerHTML = sec.felder.map(f => feldHtml(k, f)).join('') +
    `<div class="weiter">${naechsteSektionBtn(sec)}</div>`;
  for (const f of sec.felder) bindeFeld(el, f);
  const nb = $('#naechste'); if (nb) nb.onclick = () => { aktTab = nb.dataset.sec; rendereKunde(); window.scrollTo(0, 0); };
  sec.felder.filter(f => f.typ === 'photo').forEach(f => ladeVorschau(f.id));
}
function naechsteSektionBtn(sec) {
  const i = SECTIONS.indexOf(sec); const n = SECTIONS[i + 1];
  return n ? `<button class="btn primaer" id="naechste" data-sec="${n.id}">Weiter: ${esc(n.titel)} →</button>` : '';
}

function feldHtml(k, f) {
  const v = k.werte[f.id]; const na = k.werte[f.id + '__na'];
  const fehlt = f.pflicht && !istGefuellt(k, f) && !na;
  const kopf = `<div class="label">${esc(f.label)}${f.einheit ? ` <span class="klein">[${esc(f.einheit)}]</span>` : ''}${f.pflicht ? ' <span class="pflicht">*</span>' : ''}</div>${f.hinweis ? `<div class="klein">${esc(f.hinweis)}</div>` : ''}`;
  let inp = '';
  switch (f.typ) {
    case 'text': inp = `<input type="text" data-f="${f.id}" value="${esc(v)}">`; break;
    case 'date': inp = `<input type="date" data-f="${f.id}" value="${esc(v)}">`; break;
    case 'number': inp = `<input type="number" step="any" inputmode="decimal" data-f="${f.id}" value="${esc(v)}">`; break;
    case 'textarea': inp = `<textarea data-f="${f.id}" rows="3">${esc(v)}</textarea>`; break;
    case 'select': case 'yesno': {
      const opts = f.typ === 'yesno' ? YN : f.optionen;
      inp = `<div class="chips" data-chips="${f.id}">${opts.map(o => `<button type="button" class="chip ${v === o ? 'an' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`; break;
    }
    case 'multi': {
      const arr = Array.isArray(v) ? v : [];
      inp = `<div class="chips" data-multi="${f.id}">${f.optionen.map(o => `<button type="button" class="chip ${arr.includes(o) ? 'an' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`; break;
    }
    case 'photo':
      inp = `<div class="fotos" id="fv_${f.id}"></div><label class="btn">📷 Foto aufnehmen<input type="file" accept="image/*" capture="environment" data-foto="${f.id}" hidden></label>
        <label class="btn">Aus Mediathek<input type="file" accept="image/*" multiple data-foto="${f.id}" hidden></label>`; break;
  }
  const naBtn = f.pflicht ? `<label class="na"><input type="checkbox" data-na="${f.id}" ${na ? 'checked' : ''}> nicht ermittelbar / entfällt</label>` : '';
  return `<div class="feld ${fehlt ? 'fehlt' : ''}" id="f_${f.id}">${kopf}${inp}${naBtn}</div>`;
}

function bindeFeld(el, f) {
  const k = aktKunde;
  const markiere = () => { const box = document.getElementById('f_' + f.id); box.classList.toggle('fehlt', f.pflicht && !istGefuellt(k, f) && !k.werte[f.id + '__na']); };
  const inp = el.querySelector(`[data-f="${f.id}"]`);
  if (inp) inp.oninput = () => {
    k.werte[f.id] = f.typ === 'number' ? (inp.value === '' ? '' : Number(inp.value)) : inp.value;
    if (f.id === 'name') $('#titel').textContent = inp.value || 'Kunde';
    markiere(); speichernVerzoegert();
  };
  const ch = el.querySelector(`[data-chips="${f.id}"]`);
  if (ch) ch.querySelectorAll('.chip').forEach(b => b.onclick = () => {
    k.werte[f.id] = k.werte[f.id] === b.dataset.v ? '' : b.dataset.v;
    ch.querySelectorAll('.chip').forEach(x => x.classList.toggle('an', x.dataset.v === k.werte[f.id]));
    markiere(); speichernVerzoegert();
  });
  const mu = el.querySelector(`[data-multi="${f.id}"]`);
  if (mu) mu.querySelectorAll('.chip').forEach(b => b.onclick = () => {
    const arr = new Set(k.werte[f.id] || []); arr.has(b.dataset.v) ? arr.delete(b.dataset.v) : arr.add(b.dataset.v);
    k.werte[f.id] = [...arr]; b.classList.toggle('an'); markiere(); speichernVerzoegert();
  });
  el.querySelectorAll(`[data-foto="${f.id}"]`).forEach(fi => fi.onchange = async () => {
    for (const file of fi.files) {
      const blob = await bildVerkleinern(file);
      const id = uid();
      // ArrayBuffer statt Blob: Blobs in IndexedDB sind in WebKit nicht überall zuverlässig
      await fotoPut({ id, kundeId: k.id, feld: f.id, data: await blob.arrayBuffer(), type: 'image/jpeg', zeit: new Date().toISOString() });
      (k.fotos[f.id] = k.fotos[f.id] || []).push(id);
    }
    fi.value = ''; await kundePut(k); $('#speicherstatus').textContent = 'gespeichert'; markiere(); ladeVorschau(f.id);
  });
  const na = el.querySelector(`[data-na="${f.id}"]`);
  if (na) na.onchange = () => { k.werte[f.id + '__na'] = na.checked; markiere(); speichernVerzoegert(); };
}

async function ladeVorschau(feldId) {
  const box = document.getElementById('fv_' + feldId); if (!box) return;
  const ids = aktKunde.fotos[feldId] || [];
  box.innerHTML = '';
  for (const id of ids) {
    const f = await fotoGet(id); if (!f) continue;
    const url = URL.createObjectURL(fotoBlob(f));
    const d = document.createElement('div'); d.className = 'foto';
    d.innerHTML = `<img src="${url}" alt=""><button class="mini">✕</button>`;
    $('img', d).onclick = () => window.open(url);
    $('button', d).onclick = async () => {
      if (!confirm('Foto löschen?')) return;
      await fotoDel(id); aktKunde.fotos[feldId] = ids.filter(x => x !== id); await kundePut(aktKunde); ladeVorschau(feldId);
    };
    box.appendChild(d);
  }
}

// ---------- Export / Import ----------
function dateiname(k) {
  const n = (k.werte.name || 'kunde').toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-|-$/g, '');
  return `energiecheck_${n}_${new Date().toISOString().slice(0, 10)}`;
}
async function exportieren() {
  const k = aktKunde;
  const fotos = await fotosVonKunde(k.id);
  const enc = new TextEncoder();
  const zeit = new Date().toISOString();
  const daten = { ...k, exportiert: zeit, schema: SECTIONS.map(s => ({ id: s.id, titel: s.titel, felder: s.felder.map(f => ({ id: f.id, label: f.label, typ: f.typ, einheit: f.einheit })) })), fotoIndex: fotos.map(f => ({ id: f.id, feld: f.feld, datei: `fotos/${f.feld}_${f.id}.jpg`, zeit: f.zeit })) };
  const dateien = [{ name: 'daten.json', data: enc.encode(JSON.stringify(daten, null, 2)) }];
  for (const f of fotos) dateien.push({ name: `fotos/${f.feld}_${f.id}.jpg`, data: new Uint8Array(f.data || await f.blob.arrayBuffer()) });
  const blob = zipErstellen(dateien);
  const name = dateiname(k) + '.zip';
  const file = new File([blob], name, { type: 'application/zip' });
  let ok = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); ok = true; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  if (!ok) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); ok = true; }
  k.exportiert = zeit; await tx('kunden', 'readwrite', s => s.put(k)); // geaendert bewusst nicht anfassen
  rendereKunde();
}

async function importieren(file) {
  if (!file) return;
  try {
    let daten, fotoDateien = {};
    if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
      const inhalt = zipLesen(await file.arrayBuffer());
      daten = JSON.parse(new TextDecoder().decode(inhalt['daten.json']));
      fotoDateien = inhalt;
    } else daten = JSON.parse(await file.text());
    if (daten.format !== FORMAT) throw new Error('Keine Energiecheck-Datei.');
    const vorhanden = daten.id && await kundeGet(daten.id);
    let k;
    if (vorhanden) {
      const wahl = confirm(`${daten.werte?.name || 'Kunde'} existiert bereits.\n\nOK = Vorab-Daten und Prüfpunkte aktualisieren (Vor-Ort-Eingaben bleiben erhalten)\nAbbrechen = Import abbrechen`);
      if (!wahl) return;
      k = vorhanden;
      k.vorab = daten.vorab || k.vorab;
      const bekannt = new Set(k.pruefpunkte.map(p => p.id));
      for (const p of daten.pruefpunkte || []) if (!bekannt.has(p.id)) k.pruefpunkte.push(p);
      for (const [f, v] of Object.entries(daten.werte || {})) if (k.werte[f] === undefined || k.werte[f] === '') k.werte[f] = v;
    } else {
      k = neuerKunde({ ...daten, fotos: {}, exportiert: daten.exportiert || null });
      for (const fi of daten.fotoIndex || []) {
        const bytes = fotoDateien[fi.datei]; if (!bytes) continue;
        await fotoPut({ id: fi.id, kundeId: k.id, feld: fi.feld, data: bytes.slice().buffer, type: 'image/jpeg', zeit: fi.zeit });
        (k.fotos[fi.feld] = k.fotos[fi.feld] || []).push(fi.id);
      }
      delete k.schema; delete k.fotoIndex;
    }
    k.werte = k.werte || {}; k.pruefpunkte = k.pruefpunkte || []; k.vorab = k.vorab || { energietraeger: [], luecken: [], hinweise: [] };
    await kundePut(k);
    oeffne(k.id);
  } catch (e) { alert('Import fehlgeschlagen: ' + e.message); }
}

// ---------- Start ----------
$('#zurueck').onclick = async () => { if (aktKunde) await kundePut(aktKunde); zeigeStart(); };
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
window.addEventListener('pagehide', () => { if (aktKunde) kundePut(aktKunde); });
zeigeStart();
