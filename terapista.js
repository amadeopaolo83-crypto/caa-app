'use strict';
/* terapista.js — modalità adulto: 3a menu, 3b tavole, 3c cella (3d ricerca simboli), 3e frasi,
   3f impostazioni, 3g registro, 3h note, 3i obiettivi, 3j report, 3k esporta/importa, 3l info */

const ED = { pid: null, page: null, move: false, src: null };
const fld = (l, el, hint) => h('div', { class: 'fld' }, h('label', null, l), el, hint ? h('small', { class: 'hint' }, hint) : null);
const head = (t, back) => h('div', { class: 'head noprint' }, h('button', { class: 'btn', onclick: () => go(back || '3a') }, '← ' + (back && back !== '3a' ? 'Indietro' : 'Menu')), h('h1', null, t));
const chk = (label, val, on) => { const c = h('input', { type: 'checkbox', checked: !!val }); c.addEventListener('change', () => on(c.checked)); return h('label', { class: 'chk' }, c, label); };

/* ---------- 3a: menu ---------- */
SCREENS['3a'] = () => {
  const p = P();
  const items = [['3b', '🧩', 'Tavole e celle'], ['3e', '💬', 'Frasi pronte'], ['3f', '⚙️', 'Impostazioni'], ['3g', '📊', "Registro d'uso"], ['3h', '📝', 'Note'], ['3i', '🎯', 'Obiettivi'], ['3j', '📄', 'Report'], ['3k', '💾', 'Esporta / Importa'], ['3l', 'ℹ️', 'Info, PIN, crediti']];
  const old = !S.lastBackup || Date.now() - S.lastBackup > 30 * 864e5;
  return h('div', { class: 'page' },
    h('div', { class: 'head' }, h('button', { class: 'btn primary', onclick: () => { cmReset(); go('2a'); } }, '▶ Torna alla tavola'), h('h1', null, 'Modalità adulto')),
    h('p', null, 'Profilo: ', h('b', null, p.code), ' ', h('button', { class: 'link', onclick: () => go('1a') }, 'cambia profilo'), ' · ', h('button', { class: 'link', onclick: () => go('1b', { id: p.id }) }, 'modifica profilo')),
    old ? h('div', { class: 'card warn' }, 'I dati sono solo su questo dispositivo. Fai un backup dalla scheda 3k (Esporta).') : null,
    h('div', { class: 'menu' }, items.map(it => h('button', { class: 'mbtn', onclick: () => go(it[0]) }, h('span', null, it[1]), it[2], h('small', null, it[0])))));
};

/* ---------- componente: ricerca simboli (3d) ---------- */
function symbolPicker(onPick, term0) {
  const q = h('input', { type: 'search', placeholder: 'Cerca simbolo (es. mangiare)', value: term0 || '' });
  const status = h('small', { class: 'hint' }), res = h('div', { class: 'picks' });
  const doSearch = async () => {
    status.textContent = 'Ricerca…'; res.replaceChildren();
    try {
      const list = await arSearch(q.value);
      if (!list.length) { status.textContent = 'Nessun risultato. Prova un\'altra parola.'; return; }
      status.textContent = list.length + ' risultati — tocca per scegliere';
      list.slice(0, 60).forEach(x => res.append(h('button', {
        class: 'pick', type: 'button', onclick: async () => {
          status.textContent = 'Salvo il simbolo…';
          const pic = { k: 'a', id: String(x.id) }; const ok = await picFetch(pic);
          onPick(pic, x.kw);
          status.textContent = ok ? 'Simbolo scelto e salvato.' : 'Scelto, ma non salvato per l\'uso offline (serve internet).';
        }
      }, h('img', { src: AR.img(x.id), alt: x.kw, loading: 'lazy' }), h('span', null, x.kw))));
    } catch (e) { status.textContent = 'Ricerca non riuscita: serve la connessione internet.'; }
  };
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
  return h('div', { class: 'picker' }, h('div', { class: 'row2' }, q, h('button', { class: 'btn', type: 'button', onclick: doSearch }, 'Cerca')), status, res);
}

/* ---------- 3b: editor tavole ---------- */
const STARTER = [['io', 'giallo'], ['tu', 'giallo'], ['noi', 'giallo'], ['voglio', 'verde', 'volere'], ['mangiare', 'verde'], ['bere', 'verde'], ['giocare', 'verde'], ['andare', 'verde'],
['guardare', 'verde'], ['dare', 'verde'], ['aprire', 'verde'], ['fare', 'verde'], ['sì', 'rosa'], ['no', 'rosa'], ['aiuto', 'rosa'], ['grazie', 'rosa'], ['ciao', 'rosa'], ['finito', 'rosa'],
['ancora', 'marrone'], ['più', 'marrone'], ['non', 'marrone'], ['qui', 'marrone'], ['dove', 'viola'], ['cosa', 'viola'], ['bene', 'blu'], ['male', 'blu'], ['bagno', 'arancio'], ['mamma', 'arancio'], ['papà', 'arancio']];

async function loadStarter(prof) {
  const home = prof.pages.find(p => p.id === prof.home);
  const items = STARTER.filter(it => !home.cells.some(c => c && c.label === it[0]));
  if (!items.length) return toast('Vocabolario già presente');
  if (!await confirmBox('Aggiungo ' + items.length + ' parole core (con simboli ARASAAC) nelle celle libere della pagina principale. Non cambio nulla di quello che c\'è. Serve internet. Procedo?', 'Procedi')) return;
  const st = prof.settings;
  const freeSlots = () => { const f = []; for (let i = 0; i < st.cols * st.rows; i++) if (!home.cells[i]) f.push(i); return f; };
  while (freeSlots().length < items.length && st.rows < 12) st.rows++;
  const free = freeSlots();
  const msg = h('p', null, 'Avvio…'), cancel = { v: false };
  const close = overlay([h('h2', null, 'Vocabolario iniziale'), msg, h('button', { class: 'btn', onclick: () => { cancel.v = true; } }, 'Interrompi')]);
  let done = 0, noPic = 0, errs = 0;
  for (let i = 0; i < items.length && !cancel.v; i++) {
    const it = items[i];
    msg.textContent = 'Scarico ' + (i + 1) + ' / ' + items.length + ': ' + it[0];
    let pic = null;
    try {
      const r = await arSearch(it[2] || it[0], ['bestsearch', 'search']);
      if (r.length) { pic = { k: 'a', id: String(r[0].id) }; if (!await picFetch(pic)) { /* resta il collegamento web */ } } else noPic++;
      errs = 0;
    } catch (e) { errs++; if (errs >= 3) break; i--; continue; }
    home.cells[free[done]] = { label: it[0], speak: '', type: 'word', target: '', color: it[1], core: true, pic: pic };
    done++;
  }
  close(); save();
  toast(errs >= 3 ? 'Connessione assente: aggiunte ' + done + ' parole. Riprova con internet.' : 'Aggiunte ' + done + ' parole' + (noPic ? ' (' + noPic + ' senza simbolo)' : ''));
  render();
}

SCREENS['3b'] = (params) => {
  const prof = P();
  if (ED.pid !== prof.id) { ED.pid = prof.id; ED.page = prof.home; ED.move = false; ED.src = null; }
  if (params && params.pageId) ED.page = params.pageId;
  const page = prof.pages.find(p => p.id === ED.page) || prof.pages.find(p => p.id === prof.home);
  ED.page = page.id;
  const sel = h('select', { value: page.id, onchange: e => { ED.page = e.target.value; ED.src = null; render(); } },
    prof.pages.map(p => h('option', { value: p.id }, p.name + (p.id === prof.home ? ' (principale)' : ''))));
  const grid = h('div', { class: 'grid edgrid' });
  grid.style.height = Math.max(240, Math.min(prof.settings.rows * 88, 1000)) + 'px';
  renderGrid(grid, page, prof, {
    editor: true, sel: ED.move ? ED.src : null,
    onTap: (c, i, ghost) => {
      if (ghost) return toast('Cella core: si modifica nella pagina principale');
      if (ED.move) {
        if (ED.src == null) { if (!c) return toast('Scegli prima una cella piena'); ED.src = i; render(); return; }
        const a = page.cells[ED.src], b = page.cells[i];
        page.cells[ED.src] = b || null; page.cells[i] = a || null; ED.src = null; save(); render(); return;
      }
      go('3c', { pageId: page.id, slot: i });
    }
  });
  return h('div', { class: 'page' }, head('Tavole e celle'),
    h('div', { class: 'card' },
      fld('Pagina', sel),
      h('div', { class: 'row2' },
        h('button', { class: 'btn', onclick: async () => { const n = await textBox('Nuova pagina', 'Nome della pagina', ''); if (!n) return; const pg = { id: uid(), name: n.slice(0, 40), cells: [] }; prof.pages.push(pg); ED.page = pg.id; save(); render(); } }, '＋ Pagina'),
        h('button', { class: 'btn', onclick: async () => { const n = await textBox('Rinomina pagina', 'Nome', page.name); if (!n) return; page.name = n.slice(0, 40); save(); render(); } }, 'Rinomina'),
        page.id === prof.home ? null : h('button', {
          class: 'btn danger', onclick: async () => {
            if (!await confirmBox('Eliminare la pagina "' + page.name + '" e le sue celle?', 'Elimina', true)) return;
            prof.pages = prof.pages.filter(p => p !== page);
            prof.pages.forEach(pg => pg.cells.forEach((c, i) => { if (c && c.target === page.id) pg.cells[i] = Object.assign({}, c, { target: '' }); }));
            ED.page = prof.home; save(); render();
          }
        }, 'Elimina pagina'))),
    h('p', { class: 'hint' }, 'Tocca una cella per modificarla. Le posizioni restano fisse: aiuta la memoria motoria.'),
    grid,
    h('div', { class: 'row2', style: { marginTop: '10px' } },
      h('button', { class: 'btn' + (ED.move ? ' on' : ''), onclick: () => { ED.move = !ED.move; ED.src = null; render(); } }, ED.move ? 'Sposta: ATTIVO (tocca origine, poi destinazione)' : 'Sposta celle'),
      page.id === prof.home ? h('button', { class: 'btn', onclick: () => loadStarter(prof) }, 'Vocabolario iniziale (core)') : null));
};

/* ---------- 3c: modifica cella (include 3d) ---------- */
SCREENS['3c'] = (params) => {
  const prof = P(), page = prof.pages.find(p => p.id === params.pageId), slot = params.slot;
  const orig = page.cells[slot] || null;
  const d = Object.assign({ label: '', speak: '', type: 'word', target: '', color: 'none', core: false, pic: null }, orig ? JSON.parse(JSON.stringify(orig)) : {});
  const prev = h('div', { class: 'prev' });
  const label = h('input', { type: 'text', maxlength: 60, value: d.label, oninput: e => { d.label = e.target.value; drawPrev(); } });
  const spk = h('input', { type: 'text', maxlength: 160, value: d.speak, oninput: e => { d.speak = e.target.value; } });
  function drawPrev() {
    const src = picSrc(d.pic);
    prev.className = 'prev cell col-' + d.color + (d.type === 'folder' ? ' folder' : '');
    prev.replaceChildren(); if (src) prev.append(h('img', { src: src, alt: '' })); prev.append(h('span', { class: 'lbl' }, d.label || '…'));
  }
  const tgt = h('select', { onchange: e => { d.target = e.target.value; } },
    [h('option', { value: '' }, '— nuova pagina con il nome della cella —')].concat(prof.pages.filter(p => p.id !== page.id).map(p => h('option', { value: p.id }, p.name))));
  tgt.value = d.target || '';
  const folderBox = h('div', { class: 'fld' }, h('label', null, 'Apre la pagina'), tgt);
  folderBox.hidden = d.type !== 'folder';
  const typ = h('select', { value: d.type, onchange: e => { d.type = e.target.value; folderBox.hidden = d.type !== 'folder'; drawPrev(); } },
    h('option', { value: 'word' }, 'Parola (si aggiunge alla frase e si pronuncia)'), h('option', { value: 'folder' }, 'Cartella (apre un\'altra pagina)'));
  const sw = h('div', { class: 'sw' });
  const drawSw = () => { sw.replaceChildren(); COLORS.forEach(c => sw.append(h('button', { type: 'button', class: d.color === c[0] ? 'on' : '', style: { background: c[2], borderColor: c[0] === 'none' ? '#adb5bd' : '' }, onclick: () => { d.color = c[0]; drawSw(); drawPrev(); } }, c[1]))); };
  const photo = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async e => { const f = e.target.files[0]; if (!f) return; try { d.pic = await addPhoto(f); drawPrev(); toast('Foto aggiunta'); } catch (err) { toast('Foto non valida'); } } });
  const picker = symbolPicker((pic, kw) => { d.pic = pic; if (!d.label.trim()) { d.label = kw; label.value = kw; } drawPrev(); }, orig ? orig.label : '');
  drawSw(); drawPrev();
  return h('div', { class: 'page' }, head('Cella ' + (slot + 1) + ' — ' + page.name, '3b'),
    prev,
    h('div', { class: 'card' },
      fld('Testo mostrato', label), fld('Da dire (se diverso dal testo)', spk, 'Facoltativo, es. testo "bere" → dice "voglio bere"'),
      fld('Tipo', typ), folderBox,
      fld('Colore (codice Fitzgerald)', sw),
      chk('Parola core: resta nella stessa posizione in tutte le pagine (se attivo "core fisso")', d.core, v => { d.core = v; })),
    h('div', { class: 'card' }, h('h2', null, 'Simbolo'), picker,
      h('div', { class: 'row2', style: { marginTop: '8px' } }, h('button', { class: 'btn', type: 'button', onclick: () => photo.click() }, '📷 Foto personale'), photo,
        h('button', { class: 'btn', type: 'button', onclick: () => { d.pic = null; drawPrev(); } }, 'Nessun simbolo'))),
    h('div', { class: 'row2' },
      h('button', {
        class: 'btn primary big', onclick: () => {
          if (!d.label.trim()) return toast('Scrivi il testo della cella');
          const cell = { label: d.label.trim(), speak: d.speak.trim(), type: d.type, target: d.type === 'folder' ? d.target : '', color: d.color, core: !!d.core, pic: d.pic };
          if (cell.type === 'folder' && !prof.pages.some(p => p.id === cell.target)) { const pg = { id: uid(), name: cell.label.slice(0, 40), cells: [] }; prof.pages.push(pg); cell.target = pg.id; }
          page.cells[slot] = cell; save(); toast('Cella salvata'); history.back();
        }
      }, 'Salva'),
      h('button', { class: 'btn', onclick: () => history.back() }, 'Annulla'),
      orig ? h('button', { class: 'btn danger', onclick: async () => { if (!await confirmBox('Svuotare questa cella?', 'Svuota', true)) return; page.cells[slot] = null; save(); history.back(); } }, 'Svuota cella') : null));
};

/* ---------- 3e: frasi pronte ---------- */
SCREENS['3e'] = () => {
  const prof = P(), list = h('div');
  const inp = h('input', { type: 'text', maxlength: 300, placeholder: 'Nuova frase (es. Ho fame)' });
  const addPhrase = () => { const t = inp.value.trim(); if (!t) return; prof.phrases.push({ id: uid(), text: t, pic: null }); inp.value = ''; save(); draw(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') addPhrase(); });
  function draw() {
    list.replaceChildren();
    if (!prof.phrases.length) list.append(h('p', { class: 'hint' }, 'Nessuna frase.'));
    prof.phrases.forEach((f, i) => {
      const s = picSrc(f.pic);
      list.append(h('div', { class: 'item' }, s ? h('img', { src: s, alt: '', style: { height: '40px', background: '#fff', borderRadius: '4px' } }) : null, h('div', { class: 'txt' }, f.text),
        h('button', { class: 'btn', 'aria-label': 'Prova', onclick: () => speak(f.text, prof.settings) }, '▶'),
        h('button', { class: 'btn', 'aria-label': 'Su', disabled: i === 0, onclick: () => { prof.phrases.splice(i - 1, 0, prof.phrases.splice(i, 1)[0]); save(); draw(); } }, '↑'),
        h('button', { class: 'btn', 'aria-label': 'Giù', disabled: i === prof.phrases.length - 1, onclick: () => { prof.phrases.splice(i + 1, 0, prof.phrases.splice(i, 1)[0]); save(); draw(); } }, '↓'),
        h('button', { class: 'btn', 'aria-label': 'Modifica', onclick: () => editPhrase(f) }, '✎'),
        h('button', { class: 'btn danger', 'aria-label': 'Elimina', onclick: async () => { if (await confirmBox('Eliminare la frase "' + f.text + '"?', 'Elimina', true)) { prof.phrases = prof.phrases.filter(x => x !== f); save(); draw(); } } }, '🗑')));
    });
  }
  async function editPhrase(f) {
    const t = h('input', { type: 'text', maxlength: 300, value: f.text });
    let pic = f.pic; const info = h('small', { class: 'hint' }, pic ? 'Simbolo scelto' : 'Nessun simbolo');
    const picker = symbolPicker(p => { pic = p; info.textContent = 'Simbolo scelto'; }, f.text);
    const r = await modal({ title: 'Modifica frase', body: [fld('Testo', t), info, picker], buttons: [{ label: 'Senza simbolo', value: 'nopic' }, { label: 'Annulla', value: null }, { label: 'Salva', primary: true, value: 'ok' }] });
    if (r == null) return;
    if (t.value.trim()) f.text = t.value.trim();
    f.pic = r === 'nopic' ? null : pic; save(); draw();
  }
  draw();
  return h('div', { class: 'page' }, head('Frasi pronte'),
    h('p', { class: 'hint' }, 'Compaiono nel pulsante 💬 della tavola: un tocco e la frase viene pronunciata.'),
    h('div', { class: 'card' }, h('div', { class: 'row2' }, inp, h('button', { class: 'btn primary', onclick: addPhrase }, 'Aggiungi')), list));
};

/* ---------- 3f: impostazioni ---------- */
SCREENS['3f'] = () => {
  const prof = P(), st = prof.settings;
  const sel = (key, opts, conv) => h('select', { value: String(st[key]), onchange: e => { st[key] = conv ? conv(e.target.value) : e.target.value; save(); applyTheme(); } }, opts.map(o => h('option', { value: String(o[0]) }, o[1])));
  const range = (n, a, b) => { const o = []; for (let i = a; i <= b; i++) o.push([i, i + ' ' + n]); return o; };
  const voiceOpts = [['', 'Predefinita del dispositivo']].concat(VOICES.map(v => [v.voiceURI, v.name + ' (' + v.lang + ')']));
  return h('div', { class: 'page' }, head('Impostazioni — ' + prof.code),
    h('div', { class: 'card' }, h('h2', null, 'Griglia'),
      fld('Colonne', sel('cols', range('colonne', 2, 8), Number)), fld('Righe', sel('rows', range('righe', 1, 12), Number), 'Ridurre non cancella le celle: restano salvate ma nascoste.'),
      chk('Mostra il testo sotto i simboli', st.labels, v => { st.labels = v; save(); }),
      chk('Core fisso: le parole core restano nella stessa posizione in ogni pagina', st.coreFixed, v => { st.coreFixed = v; save(); }),
      chk('Barra frase (le parole si accumulano e si pronunciano con ▶)', st.sentenceBar, v => { st.sentenceBar = v; save(); }),
      chk('Cancella la frase quando finisce di leggerla', st.autoClear, v => { st.autoClear = v; save(); }),
      chk('Pronuncia ogni parola al tocco', st.speakTap, v => { st.speakTap = v; save(); })),
    h('div', { class: 'card' }, h('h2', null, 'Accesso'),
      fld('Tieni premuto per selezionare', sel('dwell', [[0, 'No: tocco normale'], [300, '0,3 secondi'], [500, '0,5 secondi'], [800, '0,8 secondi'], [1000, '1 secondo'], [1500, '1,5 secondi'], [2000, '2 secondi'], [3000, '3 secondi']], Number), 'Evita i tocchi involontari (tremori, movimenti non controllati).'),
      fld('Contrasto', sel('contrast', [['normal', 'Normale'], ['high', 'Alto contrasto (nero/giallo)'], ['dark', 'Scuro']])),
      fld('Dimensione del testo', sel('font', [['s', 'Piccolo'], ['m', 'Medio'], ['l', 'Grande']])),
      chk('Vibrazione al tocco (se il dispositivo la supporta)', st.vibrate, v => { st.vibrate = v; save(); })),
    h('div', { class: 'card' }, h('h2', null, 'Voce'),
      VOICES.length ? fld('Voce italiana', sel('voice', voiceOpts)) : h('p', { class: 'hint' }, 'Nessuna voce italiana trovata. Si installa dalle impostazioni del dispositivo (es. Android: "Sintesi vocale Google" → italiano).'),
      fld('Velocità', sel('rate', [[0.6, 'Molto lenta'], [0.8, 'Lenta'], [0.9, 'Normale'], [1, 'Media'], [1.2, 'Veloce']], Number)),
      fld('Tono', sel('pitch', [[0.8, 'Basso'], [1, 'Normale'], [1.2, 'Alto']], Number)),
      h('button', { class: 'btn', onclick: () => speak('Ciao, questa è la mia voce.', st) }, '▶ Prova la voce')),
    h('div', { class: 'card' }, h('h2', null, 'Dati'),
      chk('Registra l\'uso (parole e frasi) per il registro', st.logUse, v => { st.logUse = v; save(); })));
};

/* ---------- registro: statistiche comuni a 3g e 3j ---------- */
function usage(prof, days) {
  const since = days ? Date.now() - days * 864e5 : 0, ev = prof.log.filter(e => e.t >= since);
  const top = {}, byDay = {}, daysUsed = {};
  let words = 0, sents = 0, phrs = 0;
  ev.forEach(e => {
    daysUsed[dayKey(e.t)] = 1; byDay[dayKey(e.t)] = (byDay[dayKey(e.t)] || 0) + 1;
    if (e.k === 'w') { words++; top[e.l] = (top[e.l] || 0) + 1; } else if (e.k === 's') sents++; else phrs++;
  });
  const list = Object.keys(top).map(k => [k, top[k]]).sort((a, b) => b[1] - a[1]);
  return { ev: ev, words: words, sents: sents, phrs: phrs, daysUsed: Object.keys(daysUsed).length, diff: list.length, top: list, byDay: byDay, since: since };
}
const barsOf = (rows, max) => h('div', { class: 'bars' }, rows.map(r => h('div', { class: 'b' }, h('span', null, r[0]), h('i', { style: { width: Math.max(2, Math.round(r[1] / (max || 1) * 60)) + '%' } }), h('b', null, r[1]))));
const PERIODS = [[7, 'Ultimi 7 giorni'], [30, 'Ultimi 30 giorni'], [90, 'Ultimi 90 giorni'], [0, 'Tutto']];
let REGDAYS = 30;
const csvEsc = s => '"' + String(s).replace(/"/g, '""') + '"';
function exportCsv(prof, ev) {
  download('registro_' + prof.code + '_' + dayKey(Date.now()) + '.csv', '﻿data_ora;tipo;testo\r\n' + ev.map(e => [csvEsc(fmtDT(e.t)), e.k === 'w' ? 'parola' : e.k === 's' ? 'frase composta' : 'frase rapida', csvEsc(e.l)].join(';')).join('\r\n'), 'text/csv');
}

/* ---------- 3g: registro d'uso ---------- */
SCREENS['3g'] = () => {
  const prof = P(), u = usage(prof, REGDAYS);
  const last14 = []; for (let i = 13; i >= 0; i--) { const k = dayKey(Date.now() - i * 864e5); last14.push([k.slice(8) + '/' + k.slice(5, 7), u.byDay[k] || 0]); }
  const per = h('select', { value: String(REGDAYS), onchange: e => { REGDAYS = Number(e.target.value); render(); } }, PERIODS.map(p => h('option', { value: String(p[0]) }, p[1])));
  return h('div', { class: 'page' }, head("Registro d'uso — " + prof.code),
    prof.settings.logUse ? null : h('div', { class: 'card warn' }, 'La registrazione è spenta (scheda 3f).'),
    fld('Periodo', per),
    h('div', { class: 'card' }, h('table', null,
      h('tr', null, h('th', null, 'Parole toccate'), h('td', null, u.words)), h('tr', null, h('th', null, 'Frasi composte pronunciate'), h('td', null, u.sents)),
      h('tr', null, h('th', null, 'Frasi rapide'), h('td', null, u.phrs)), h('tr', null, h('th', null, 'Parole diverse usate'), h('td', null, u.diff)), h('tr', null, h('th', null, 'Giorni di utilizzo'), h('td', null, u.daysUsed)))),
    h('div', { class: 'card' }, h('h2', null, 'Parole più usate'), u.top.length ? barsOf(u.top.slice(0, 20), u.top[0][1]) : h('p', { class: 'hint' }, 'Ancora nessun dato.')),
    h('div', { class: 'card' }, h('h2', null, 'Ultimi 14 giorni (tocchi al giorno)'), barsOf(last14, Math.max.apply(null, last14.map(x => x[1]).concat([1])))),
    h('div', { class: 'row2' },
      h('button', { class: 'btn', onclick: () => u.ev.length ? exportCsv(prof, u.ev) : toast('Nessun dato da esportare') }, 'Scarica CSV (Excel)'),
      h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('Cancellare TUTTO il registro di questo profilo?', 'Cancella', true)) { prof.log = []; save(); render(); } } }, 'Cancella registro')));
};

/* ---------- 3h: note ---------- */
SCREENS['3h'] = () => {
  const prof = P(), list = h('div'), ta = h('textarea', { placeholder: 'Nuova nota clinica (usa solo il codice del paziente)…' });
  function draw() {
    list.replaceChildren();
    if (!prof.notes.length) list.append(h('p', { class: 'hint' }, 'Nessuna nota.'));
    prof.notes.slice().sort((a, b) => b.t - a.t).forEach(n => list.append(h('div', { class: 'card' }, h('small', { class: 'hint' }, fmtDT(n.t)), h('div', { style: { whiteSpace: 'pre-wrap' } }, n.text),
      h('div', { class: 'row2', style: { marginTop: '6px' } },
        h('button', { class: 'btn', onclick: async () => { const t = await textBox('Modifica nota', '', n.text, true); if (t) { n.text = t; save(); draw(); } } }, '✎ Modifica'),
        h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('Eliminare questa nota?', 'Elimina', true)) { prof.notes = prof.notes.filter(x => x !== n); save(); draw(); } } }, '🗑')))));
  }
  draw();
  return h('div', { class: 'page' }, head('Note — ' + prof.code), h('div', { class: 'card' }, ta,
    h('button', { class: 'btn primary', style: { marginTop: '8px' }, onclick: () => { const t = ta.value.trim(); if (!t) return; prof.notes.push({ id: uid(), t: Date.now(), text: t }); ta.value = ''; save(); draw(); } }, 'Salva nota')), list);
};

/* ---------- 3i: obiettivi e progressi ---------- */
SCREENS['3i'] = () => {
  const prof = P(), list = h('div');
  const gt = h('input', { type: 'text', maxlength: 500, placeholder: 'Nuovo obiettivo (es. Chiede "ancora" in modo autonomo)' }), gd = h('input', { type: 'date' });
  const addGoal = () => { const t = gt.value.trim(); if (!t) return; prof.goals.push({ id: uid(), text: t, created: Date.now(), target: gd.value, done: false, prog: [] }); gt.value = ''; gd.value = ''; save(); draw(); };
  async function addProg(g) {
    let v = 3; const btns = h('div', { class: 'sw' }), note = h('input', { type: 'text', maxlength: 500, placeholder: 'Nota (facoltativa)' });
    const drawB = () => { btns.replaceChildren(); [0, 1, 2, 3, 4, 5].forEach(i => btns.append(h('button', { type: 'button', class: v === i ? 'on' : '', style: { background: '#fff' }, onclick: () => { v = i; drawB(); } }, String(i)))); }; drawB();
    const r = await modal({ title: 'Valutazione', body: [h('p', { class: 'hint' }, '0 = nessuna autonomia, 5 = obiettivo pienamente raggiunto'), btns, fld('Nota', note)], buttons: [{ label: 'Annulla', value: null }, { label: 'Salva', primary: true, value: true }] });
    if (r) { g.prog.push({ t: Date.now(), v: v, n: note.value.trim() }); save(); draw(); }
  }
  function draw() {
    list.replaceChildren();
    if (!prof.goals.length) list.append(h('p', { class: 'hint' }, 'Nessun obiettivo.'));
    prof.goals.forEach(g => {
      const last = g.prog.slice(-8);
      list.append(h('div', { class: 'card' },
        h('div', null, h('b', null, g.text), g.done ? h('span', { class: 'chip ok' }, 'raggiunto') : null),
        h('small', { class: 'hint' }, 'Creato il ' + fmtDate(g.created) + (g.target ? ' · scadenza ' + fmtDate(g.target) : '')),
        last.length ? h('div', { style: { margin: '6px 0' } }, h('span', { class: 'spark' }, last.map(r => h('i', { style: { height: (4 + r.v * 4.8) + 'px' }, title: r.v }))), ' ultima: ', h('b', null, last[last.length - 1].v + '/5')) : null,
        g.prog.slice(-3).reverse().map(r => h('div', { class: 'hint' }, fmtDate(r.t) + ' — ' + r.v + '/5' + (r.n ? ' — ' + r.n : ''))),
        h('div', { class: 'row2', style: { marginTop: '6px' } },
          h('button', { class: 'btn', onclick: () => addProg(g) }, '＋ Valutazione'),
          h('button', { class: 'btn', onclick: () => { g.done = !g.done; save(); draw(); } }, g.done ? 'Riapri' : '✓ Raggiunto'),
          h('button', { class: 'btn', onclick: async () => { const t = await textBox('Modifica obiettivo', '', g.text); if (t) { g.text = t.slice(0, 500); save(); draw(); } } }, '✎'),
          h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('Eliminare l\'obiettivo e le sue valutazioni?', 'Elimina', true)) { prof.goals = prof.goals.filter(x => x !== g); save(); draw(); } } }, '🗑'))));
    });
  }
  draw();
  return h('div', { class: 'page' }, head('Obiettivi — ' + prof.code), h('div', { class: 'card' }, fld('Obiettivo', gt), fld('Scadenza (facoltativa)', gd), h('button', { class: 'btn primary', onclick: addGoal }, 'Aggiungi obiettivo')), list);
};

/* ---------- 3j: report stampabile ---------- */
let REPDAYS = 30;
SCREENS['3j'] = () => {
  const prof = P(), u = usage(prof, REPDAYS), since = u.since;
  const per = h('select', { value: String(REPDAYS), onchange: e => { REPDAYS = Number(e.target.value); render(); } }, PERIODS.map(p => h('option', { value: String(p[0]) }, p[1])));
  const notes = prof.notes.filter(n => n.t >= since).sort((a, b) => a.t - b.t);
  return h('div', { class: 'page' }, head('Report'),
    h('div', { class: 'noprint' }, fld('Periodo', per), h('div', { class: 'row2' }, h('button', { class: 'btn primary', onclick: () => window.print() }, '🖨 Stampa / Salva come PDF'), h('button', { class: 'btn', onclick: () => u.ev.length ? exportCsv(prof, u.ev) : toast('Nessun dato') }, 'CSV del registro'))),
    h('div', { class: 'report' },
      h('h1', null, 'Report CAA — profilo ' + prof.code),
      h('p', null, 'Periodo: ' + (since ? 'dal ' + fmtDate(since) + ' ' : 'tutto il registro ') + 'al ' + fmtDate(Date.now()) + (prof.age ? ' · fascia di età: ' + ageLabel(prof.age) : '')),
      h('div', { class: 'card' }, h('h2', null, 'Utilizzo'), h('table', null,
        h('tr', null, h('th', null, 'Parole toccate'), h('td', null, u.words)), h('tr', null, h('th', null, 'Frasi composte pronunciate'), h('td', null, u.sents)),
        h('tr', null, h('th', null, 'Frasi rapide'), h('td', null, u.phrs)), h('tr', null, h('th', null, 'Parole diverse usate'), h('td', null, u.diff)), h('tr', null, h('th', null, 'Giorni di utilizzo'), h('td', null, u.daysUsed)))),
      h('div', { class: 'card' }, h('h2', null, 'Parole più usate'), u.top.length ? barsOf(u.top.slice(0, 15), u.top[0][1]) : h('p', null, 'Nessun dato nel periodo.')),
      h('div', { class: 'card' }, h('h2', null, 'Obiettivi'), prof.goals.length ? prof.goals.map(g => {
        const pr = g.prog.filter(r => r.t >= since);
        return h('div', { style: { margin: '8px 0' } }, h('b', null, g.text), g.done ? ' (raggiunto)' : '', pr.length ? pr.map(r => h('div', null, fmtDate(r.t) + ' — ' + r.v + '/5' + (r.n ? ' — ' + r.n : ''))) : h('div', { class: 'hint' }, 'Nessuna valutazione nel periodo.'));
      }) : h('p', null, 'Nessun obiettivo.')),
      h('div', { class: 'card' }, h('h2', null, 'Note'), notes.length ? notes.map(n => h('div', { style: { margin: '6px 0' } }, h('small', { class: 'hint' }, fmtDT(n.t)), h('div', { style: { whiteSpace: 'pre-wrap' } }, n.text))) : h('p', null, 'Nessuna nota nel periodo.')),
      h('p', { class: 'credit' }, 'Dati generati dall\'app sul dispositivo; non sostituiscono la valutazione clinica. ' + CREDITS)));
};

/* ---------- 3k: esporta / importa ---------- */
const toDataURL = blob => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
async function buildExport(profs, opt) {
  const out = profs.map(p => { const c = JSON.parse(JSON.stringify(p)); if (!opt.log) c.log = []; if (!opt.notes) { c.notes = []; c.goals = []; } return c; });
  const keys = new Set(), images = {};
  out.forEach(p => { p.pages.forEach(pg => pg.cells.forEach(c => { if (c && c.pic) keys.add(picKey(c.pic)); })); p.phrases.forEach(f => { if (f.pic) keys.add(picKey(f.pic)); }); });
  for (const k of keys) { try { const b = await DB.get('img', k); if (b) images[k] = await toDataURL(b); } catch (e) { /* ignora */ } }
  return { app: 'caa-app', v: 1, exported: Date.now(), profiles: out, images: images };
}
async function importData(data) {
  if (!data || data.app !== 'caa-app' || !Array.isArray(data.profiles)) throw new Error('File non riconosciuto');
  const imgs = data.images && typeof data.images === 'object' ? data.images : {};
  for (const k of Object.keys(imgs)) {
    if (!/^[ap]:[\w-]+$/.test(k) || typeof imgs[k] !== 'string' || imgs[k].indexOf('data:image/') !== 0) continue;
    try { const b = await (await fetch(imgs[k])).blob(); await DB.put('img', k, b); await picLoad({ k: k.charAt(0), id: k.slice(2) }); } catch (e) { /* ignora */ }
  }
  let n = 0;
  for (const raw of data.profiles) {
    const q = cleanProfile(raw, false), ex = S.profiles.find(p => p.code.toLowerCase() === q.code.toLowerCase());
    if (ex) {
      const r = await modal({ title: 'Il profilo ' + q.code + ' esiste già', body: h('p', null, 'Sostituirlo con quello del file, oppure importarlo come copia?'), buttons: [{ label: 'Salta', value: 'skip' }, { label: 'Importa come copia', value: 'copy' }, { label: 'Sostituisci', primary: true, value: 'rep' }] });
      if (r === 'rep') { q.id = ex.id; q.created = ex.created; S.profiles[S.profiles.indexOf(ex)] = q; n++; }
      else if (r === 'copy') { let c = q.code + '-copia', i = 2; while (S.profiles.some(p => p.code.toLowerCase() === c.toLowerCase())) c = q.code + '-copia' + i++; q.code = c; S.profiles.push(q); n++; }
    } else { S.profiles.push(q); n++; }
  }
  if (!S.last && S.profiles.length) S.last = S.profiles[0].id;
  await saveNow(); return n;
}
SCREENS['3k'] = () => {
  const prof = P(), o = { log: false, notes: false };
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const n = await importData(JSON.parse(await f.text())); toast('Importati ' + n + ' profili'); cmReset(); render(); } catch (err) { toast('Importazione non riuscita: ' + err.message); }
    e.target.value = '';
  } });
  return h('div', { class: 'page' }, head('Esporta / Importa'),
    h('div', { class: 'card' }, h('h2', null, 'Backup completo'), h('p', { class: 'hint' }, 'Tutti i profili, con registro, note e obiettivi. Conserva il file in un posto sicuro: contiene dati sensibili.' + (S.lastBackup ? ' Ultimo backup: ' + fmtDate(S.lastBackup) + '.' : '')),
      h('button', { class: 'btn primary', onclick: async () => { const d = await buildExport(S.profiles, { log: true, notes: true }); download('CAA_backup_' + dayKey(Date.now()) + '.json', JSON.stringify(d), 'application/json'); S.lastBackup = Date.now(); save(); render(); } }, 'Scarica backup completo')),
    h('div', { class: 'card' }, h('h2', null, 'Condividi un profilo (' + prof.code + ')'), h('p', { class: 'hint' }, 'Per passare tavole e frasi a un altro dispositivo (es. dalla terapista ai genitori).'),
      chk('Includi il registro d\'uso', false, v => { o.log = v; }), chk('Includi note e obiettivi', false, v => { o.notes = v; }),
      h('button', { class: 'btn', onclick: async () => { const d = await buildExport([prof], o); download('CAA_' + prof.code + '_' + dayKey(Date.now()) + '.json', JSON.stringify(d), 'application/json'); } }, 'Scarica profilo')),
    h('div', { class: 'card' }, h('h2', null, 'Importa'), h('p', { class: 'hint' }, 'Carica un file .json creato da questa app. Se un codice esiste già ti chiedo cosa fare.'),
      file, h('button', { class: 'btn', onclick: () => file.click() }, 'Scegli il file…')));
};

/* ---------- 3l: info, PIN, crediti ---------- */
SCREENS['3l'] = () => {
  const info = h('small', { class: 'hint' }, '');
  try { if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { info.textContent = 'Spazio usato: ' + Math.round((e.usage || 0) / 1048576) + ' MB'; }); } catch (e) { /* ignora */ }
  return h('div', { class: 'page' }, head('Info, PIN, crediti'),
    h('div', { class: 'card' }, h('h2', null, 'PIN'), h('button', { class: 'btn', onclick: async () => { if (await setPinFlow()) toast('PIN cambiato'); } }, 'Cambia PIN')),
    h('div', { class: 'card' }, h('h2', null, 'Schermate'), chk('Mostra il codice della scheda in basso a sinistra (utile per segnalare modifiche)', S.showCodes, v => { S.showCodes = v; save(); render(); })),
    h('div', { class: 'card' }, h('h2', null, 'Uso sul dispositivo'),
      h('p', null, 'I dati restano solo su questo dispositivo, nel browser. Non c\'è nessun server. Fai backup dalla scheda 3k.'),
      h('p', null, 'Per evitare che il bambino esca dall\'app: Android → "Blocco schermo/fissa app"; iPad → "Accesso guidato".'),
      h('p', null, 'Installazione: Chrome → menu ⋮ → "Installa app"; Safari → Condividi → "Aggiungi a Home".'), info),
    h('div', { class: 'card' }, h('h2', null, 'Crediti e licenza'), h('p', null, CREDITS), h('p', null, 'App CAA — versione 1.0')));
};
