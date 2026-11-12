'use strict';
/* comunica.js — schede 1a (profili), 1b (profilo), 2a (tavola), 2b (barra frase), 2c (frasi rapide) */

const CM = { page: null, stack: [], sent: [] };
function cmReset() { const p = P(); CM.page = p ? p.home : null; CM.stack = []; CM.sent = []; }

function logUse(kind, label) {
  const p = P(); if (!p || !p.settings.logUse) return;
  p.log.push({ t: Date.now(), k: kind, l: label });
  if (p.log.length > 30000) p.log.splice(0, p.log.length - 30000);
  save();
}

/* cella visibile in una posizione: propria, oppure "core fisso" copiata dalla pagina principale */
function cellAt(prof, page, i) {
  const own = page.cells[i];
  if (own) return { cell: own, ghost: false };
  if (prof.settings.coreFixed && page.id !== prof.home) {
    const home = prof.pages.find(p => p.id === prof.home), hc = home && home.cells[i];
    if (hc && hc.core && hc.type !== 'folder') return { cell: hc, ghost: true };
  }
  return null;
}

/* pressione: tocco normale oppure "tieni premuto" (dwell) */
function attachPress(el, st, fn, noDwell) {
  if (!st.dwell || noDwell) { el.addEventListener('click', fn); return; }
  let tm = null;
  const start = () => {
    if (tm) return;
    el.classList.add('dwelling'); el.style.setProperty('--dwell', st.dwell + 'ms');
    tm = setTimeout(() => { tm = null; el.classList.remove('dwelling'); fn(); }, st.dwell);
  };
  const stop = () => { if (tm) { clearTimeout(tm); tm = null; } el.classList.remove('dwelling'); };
  el.addEventListener('pointerdown', e => { e.preventDefault(); start(); });
  el.addEventListener('pointerup', stop); el.addEventListener('pointerleave', stop); el.addEventListener('pointercancel', stop);
  el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') start(); });
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('click', e => e.preventDefault());
}

/* disegna la griglia. o = { editor, sel, onTap(cella, posizione, fantasma) } */
function renderGrid(host, page, prof, o) {
  const st = prof.settings;
  host.style.gridTemplateColumns = 'repeat(' + st.cols + ',1fr)';
  host.style.gridTemplateRows = 'repeat(' + st.rows + ',1fr)';
  host.replaceChildren();
  for (let i = 0; i < st.cols * st.rows; i++) {
    const r = cellAt(prof, page, i);
    if (!r) {
      host.append(o.editor
        ? h('button', { class: 'cell empty ed' + (o.sel === i ? ' sel' : ''), type: 'button', 'aria-label': 'Cella vuota ' + (i + 1), onclick: () => o.onTap(null, i, false) }, '+')
        : h('div', { class: 'cell empty' }));
      continue;
    }
    const c = r.cell;
    const el = h('button', { type: 'button', 'aria-label': c.label, class: 'cell col-' + (c.color || 'none') + (c.type === 'folder' ? ' folder' : '') + (r.ghost ? ' ghost' : '') + (o.sel === i ? ' sel' : '') });
    const src = picSrc(c.pic);
    if (src) el.append(h('img', { src: src, alt: '', draggable: 'false' }));
    if (st.labels || !src) el.append(h('span', { class: 'lbl' }, c.label));
    attachPress(el, st, () => o.onTap(c, i, r.ghost), o.editor);
    host.append(el);
  }
}

/* ---------- 1a: scelta profilo ---------- */
SCREENS['1a'] = () => {
  const list = S.profiles.map(p => h('div', { class: 'prow' },
    h('button', { class: 'btn big grow', onclick: () => { S.last = p.id; save(); cmReset(); go('2a'); } }, h('b', null, p.code), '  ', h('small', null, ageLabel(p.age))),
    h('button', { class: 'btn', 'aria-label': 'Modifica profilo', onclick: async () => { if (await adultGate()) { S.last = p.id; go('1b', { id: p.id }); } } }, '✎')));
  return h('div', { class: 'page' },
    h('h1', null, 'CAA — Comunicazione aumentativa'),
    S.profiles.length ? h('p', { class: 'hint' }, 'Scegli il profilo (codice).')
      : h('div', { class: 'card' }, h('p', null, 'Benvenuto. Per iniziare crea un profilo. Usa sempre un codice (es. P-001), mai il nome del paziente.')),
    h('div', { class: 'plist' }, list),
    h('button', { class: 'btn primary big', onclick: async () => { if (await adultGate()) go('1b', {}); } }, '＋ Nuovo profilo'),
    ' ',
    P() ? h('button', { class: 'btn big', onclick: () => { cmReset(); go('2a'); } }, 'Torna alla tavola') : null,
    h('p', { class: 'credit' }, CREDITS));
};

/* ---------- 1b: nuovo / modifica profilo ---------- */
SCREENS['1b'] = (params) => {
  const edit = params && params.id ? S.profiles.find(p => p.id === params.id) : null;
  const code = h('input', { type: 'text', maxlength: 20, value: edit ? edit.code : '', placeholder: 'es. P-001', autocapitalize: 'characters' });
  const age = h('select', { value: edit ? edit.age : '' }, AGES.map(a => h('option', { value: a[0] }, a[1])));
  const cons = h('input', { type: 'checkbox', checked: edit ? edit.consent.ok : false });
  const cdate = h('input', { type: 'date', value: edit ? edit.consent.date : '' });
  cons.addEventListener('change', () => { if (cons.checked && !cdate.value) cdate.value = dayKey(Date.now()); });
  return h('div', { class: 'page' },
    h('div', { class: 'head' }, h('button', { class: 'btn', onclick: () => go(P() ? '3a' : '1a') }, '← Indietro'), h('h1', null, edit ? 'Modifica profilo' : 'Nuovo profilo')),
    h('div', { class: 'card' },
      h('div', { class: 'fld' }, h('label', null, 'Codice del profilo'), code, h('small', { class: 'hint' }, 'Mai il nome reale: usa un codice (es. P-014). Il collegamento codice ↔ persona resta su carta.')),
      h('div', { class: 'fld' }, h('label', null, 'Fascia di età (facoltativa)'), age),
      h('label', { class: 'chk' }, cons, 'Consenso scritto dei genitori raccolto'),
      h('div', { class: 'fld' }, h('label', null, 'Data del consenso'), cdate)),
    h('button', {
      class: 'btn primary big', onclick: () => {
        const c = code.value.trim();
        if (!c) return toast('Inserisci il codice');
        if (S.profiles.some(p => p.code.toLowerCase() === c.toLowerCase() && p !== edit)) return toast('Questo codice esiste già');
        if (edit) { edit.code = c; edit.age = age.value; edit.consent = { ok: cons.checked, date: cdate.value }; save(); toast('Salvato'); go(P() ? '3a' : '1a'); }
        else {
          const p = newProfile(c); p.age = age.value; p.consent = { ok: cons.checked, date: cdate.value };
          S.profiles.push(p); S.last = p.id; save(); cmReset(); toast('Profilo creato'); go('3a');
        }
      }
    }, 'Salva'),
    ' ',
    edit ? h('button', {
      class: 'btn danger', onclick: async () => {
        const t = await textBox('Elimina profilo', 'Per confermare scrivi il codice: ' + edit.code, '');
        if (t == null) return;
        if (t !== edit.code) return toast('Codice non corrispondente');
        S.profiles = S.profiles.filter(p => p !== edit);
        if (S.last === edit.id) S.last = S.profiles.length ? S.profiles[0].id : null;
        save(); toast('Profilo eliminato'); go('1a');
      }
    }, 'Elimina profilo') : null);
};

/* ---------- 2a: tavola di comunicazione (2b = barra frase, 2c = frasi rapide) ---------- */
SCREENS['2a'] = () => {
  ADULT = false; // tornando in tavola la modalità adulto si richiude
  const prof = P(), st = prof.settings;
  if (!CM.page || !prof.pages.some(p => p.id === CM.page)) cmReset();
  const grid = h('div', { class: 'grid' });
  const title = h('span', { class: 'pname' });
  const tiles = h('div', { class: 'stiles' });
  const homeB = h('button', { class: 'btn', 'aria-label': 'Home', onclick: () => { CM.stack = []; CM.page = prof.home; draw(); } }, '🏠');
  const backB = h('button', { class: 'btn', 'aria-label': 'Indietro', onclick: () => { if (CM.stack.length) { CM.page = CM.stack.pop(); draw(); } } }, '◀');

  const sentenceText = () => CM.sent.map(x => x.s).join(' ');
  function drawSentence() {
    tiles.replaceChildren();
    if (!CM.sent.length) tiles.append(h('span', { class: 'sph' }, 'Tocca i simboli…'));
    CM.sent.forEach(x => {
      const s = picSrc(x.pic);
      tiles.append(h('div', { class: 'stile' }, s ? h('img', { src: s, alt: '' }) : null, h('span', null, x.l)));
    });
    tiles.scrollLeft = tiles.scrollWidth;
  }
  function onTap(c, i, ghost) {
    if (c.type === 'folder') {
      if (!prof.pages.some(p => p.id === c.target)) return toast('Cartella vuota');
      CM.stack.push(CM.page); CM.page = c.target; draw(); return;
    }
    if (st.vibrate && navigator.vibrate) navigator.vibrate(25);
    const say = c.speak || c.label;
    logUse('w', c.label);
    if (st.sentenceBar) { CM.sent.push({ l: c.label, s: say, pic: c.pic }); drawSentence(); }
    if (st.speakTap || !st.sentenceBar) speak(say, st);
  }
  function draw() {
    const page = prof.pages.find(p => p.id === CM.page) || prof.pages[0];
    title.textContent = page.id === prof.home ? '' : page.name;
    backB.disabled = !CM.stack.length; homeB.disabled = page.id === prof.home && !CM.stack.length;
    renderGrid(grid, page, prof, { onTap: onTap });
  }

  async function openPhrases() {
    const body = prof.phrases.length ? prof.phrases.map(f => {
      const s = picSrc(f.pic);
      return h('button', { class: 'btn phr', type: 'button', onclick: () => { speak(f.text, st); logUse('f', f.text); } }, s ? h('img', { src: s, alt: '', style: { height: '40px', verticalAlign: 'middle', marginRight: '8px', background: '#fff', borderRadius: '4px' } }) : null, f.text);
    }) : h('p', null, 'Nessuna frase. Si aggiungono dalla modalità adulto (scheda 3e).');
    await modal({ title: 'Frasi rapide', body: body, buttons: [{ label: 'Chiudi', primary: true, value: true }] });
  }

  const bar = h('div', { class: 'bar' }, homeB, backB, title,
    h('button', { class: 'btn', 'aria-label': 'Frasi rapide', onclick: openPhrases }, '💬'),
    h('button', { class: 'btn', 'aria-label': 'Modalità adulto', onclick: async () => { if (await adultGate()) go('3a'); } }, '🔒'));
  const sb = st.sentenceBar ? h('div', { class: 'sbar' }, tiles,
    h('button', { class: 'btn primary', 'aria-label': 'Parla', onclick: () => { const t = sentenceText(); if (t) { speak(t, st); logUse('s', t); } } }, '▶'),
    h('button', { class: 'btn', 'aria-label': 'Cancella ultima', onclick: () => { CM.sent.pop(); drawSentence(); } }, '⌫'),
    h('button', { class: 'btn', 'aria-label': 'Cancella tutto', onclick: () => { CM.sent = []; drawSentence(); } }, '✕')) : null;
  drawSentence(); draw();
  return h('div', { class: 'comm' }, bar, sb, grid);
};

/* ---------- avvio ---------- */
async function start() {
  try { S = (await DB.get('kv', 'state')) || newState(); }
  catch (e) { S = newState(); toast('Archivio non disponibile: i dati non verranno salvati'); }
  migrate();
  await preloadAll();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignora */ }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
  cmReset();
  go(P() ? '2a' : '1a', {}, true);
}
