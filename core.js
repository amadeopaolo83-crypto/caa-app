'use strict';
/* core.js — archivio dati, utilità, ARASAAC, voce, finestre, navigazione */

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

function add(el, k) {
  if (k == null || k === false) return;
  if (Array.isArray(k)) k.forEach(x => add(el, x));
  else el.append(k.nodeType ? k : document.createTextNode(String(k)));
}
function h(tag, attrs) {
  const el = document.createElement(tag);
  let val;
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') val = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = true;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
  if (val !== undefined) el.value = val;
  return el;
}

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const fmtDate = t => new Date(t).toLocaleDateString('it-IT');
const fmtDT = t => new Date(t).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const CREDITS = "Pittogrammi: Sergio Palao per ARASAAC (arasaac.org), Governo d'Aragona — licenza CC BY-NC-SA. Uso non commerciale.";
const COLORS = [
  ['none', 'Nessuno', '#ffffff'], ['giallo', 'Pronomi', '#fff3bf'], ['verde', 'Verbi', '#d3f9d8'],
  ['arancio', 'Nomi', '#ffe8cc'], ['blu', 'Aggettivi', '#d0ebff'], ['rosa', 'Sociale / sì-no', '#ffdeeb'],
  ['viola', 'Domande', '#e5dbff'], ['marrone', 'Avverbi', '#f1e0d0']
];
const AGES = [['', '—'], ['<6', 'meno di 6 anni'], ['6-10', '6–10 anni'], ['11-17', '11–17 anni'], ['18+', 'adulto']];
const ageLabel = a => (AGES.find(x => x[0] === a) || AGES[0])[1];

/* ---------- archivio (IndexedDB) ---------- */
const DB = (() => {
  let dbp;
  function open() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('caa-app', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('img'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const rq = fn(t.objectStore(store));
      t.oncomplete = () => res(rq && rq.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  return {
    get: (s, k) => tx(s, 'readonly', o => o.get(k)),
    put: (s, k, v) => tx(s, 'readwrite', o => o.put(v, k)),
    del: (s, k) => tx(s, 'readwrite', o => o.delete(k)),
    clear: s => tx(s, 'readwrite', o => o.clear())
  };
})();

/* ---------- stato ---------- */
let S = null;          // tutti i dati
let ADULT = false;     // modalità adulto sbloccata (solo in memoria)
let saveT = null;
const P = () => (S && S.profiles.find(p => p.id === S.last)) || null;

function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 250); }
async function saveNow() {
  clearTimeout(saveT);
  try { await DB.put('kv', 'state', S); } catch (e) { toast('Errore di salvataggio: ' + e.message); }
}
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

function defaultSettings() {
  return { cols: 4, rows: 3, labels: true, speakTap: true, sentenceBar: true, dwell: 0, contrast: 'normal', font: 'm', voice: '', rate: 0.9, pitch: 1, logUse: true, coreFixed: true, vibrate: false };
}
function newState() { return { v: 1, pin: null, recovery: null, profiles: [], last: null, showCodes: true, lastBackup: null }; }
function newProfile(code) {
  const hid = uid();
  return { id: uid(), code: code, created: Date.now(), age: '', consent: { ok: false, date: '' }, settings: defaultSettings(), pages: [{ id: hid, name: 'Principale', cells: [] }], home: hid, phrases: [], notes: [], goals: [], log: [] };
}
const str = (x, n) => String(x == null ? '' : x).slice(0, n);
const num = (x, a, b, d) => { x = Number(x); return isFinite(x) ? Math.min(b, Math.max(a, x)) : d; };
function cleanPic(x) { return (x && (x.k === 'a' || x.k === 'p') && /^[\w-]+$/.test(String(x.id))) ? { k: x.k, id: String(x.id) } : null; }
function cleanProfile(p, keepId) {
  const q = newProfile(str(p.code || 'IMP', 20));
  if (keepId && p.id) q.id = str(p.id, 30);
  if (keepId && p.created) q.created = num(p.created, 0, 9e15, q.created);
  q.age = AGES.some(a => a[0] === p.age) ? p.age : '';
  q.consent = { ok: !!(p.consent && p.consent.ok), date: str(p.consent && p.consent.date, 10) };
  const s = Object.assign(defaultSettings(), p.settings || {}), d = defaultSettings();
  s.cols = num(s.cols, 2, 8, d.cols); s.rows = num(s.rows, 1, 12, d.rows); s.dwell = num(s.dwell, 0, 5000, 0);
  s.rate = num(s.rate, 0.5, 1.5, d.rate); s.pitch = num(s.pitch, 0.5, 1.5, 1); s.voice = str(s.voice, 200);
  s.contrast = ['normal', 'high', 'dark'].includes(s.contrast) ? s.contrast : 'normal';
  s.font = ['s', 'm', 'l'].includes(s.font) ? s.font : 'm';
  ['labels', 'speakTap', 'sentenceBar', 'logUse', 'coreFixed', 'vibrate'].forEach(k => { s[k] = !!s[k]; });
  q.settings = s;
  const pages = Array.isArray(p.pages) ? p.pages : [];
  q.pages = pages.map(pg => ({
    id: str(pg.id || uid(), 30), name: str(pg.name || 'Pagina', 40),
    cells: Array.from(pg.cells || [], c => !c ? null : {
      label: str(c.label, 60), speak: str(c.speak, 160), type: c.type === 'folder' ? 'folder' : 'word', target: str(c.target, 30),
      color: COLORS.some(k => k[0] === c.color) ? c.color : 'none', core: !!c.core, pic: cleanPic(c.pic)
    })
  }));
  if (!q.pages.length) q.pages = [{ id: uid(), name: 'Principale', cells: [] }];
  q.home = q.pages.some(x => x.id === p.home) ? p.home : q.pages[0].id;
  q.phrases = Array.from(p.phrases || [], f => ({ id: str(f.id || uid(), 30), text: str(f.text, 300), pic: cleanPic(f.pic) })).filter(f => f.text);
  q.notes = Array.from(p.notes || [], n => ({ id: str(n.id || uid(), 30), t: num(n.t, 0, 9e15, Date.now()), text: str(n.text, 5000) }));
  q.goals = Array.from(p.goals || [], g => ({
    id: str(g.id || uid(), 30), text: str(g.text, 500), created: num(g.created, 0, 9e15, Date.now()), target: str(g.target, 10), done: !!g.done,
    prog: Array.from(g.prog || [], r => ({ t: num(r.t, 0, 9e15, Date.now()), v: num(r.v, 0, 5, 0), n: str(r.n, 500) }))
  }));
  q.log = Array.from(p.log || [], e => ({ t: num(e.t, 0, 9e15, 0), k: ['w', 's', 'f'].includes(e.k) ? e.k : 'w', l: str(e.l, 200) })).slice(-30000);
  return q;
}
function migrate() {
  const base = newState();
  for (const k in base) if (S[k] === undefined) S[k] = base[k];
  S.profiles = S.profiles.map(p => cleanProfile(p, true));
  if (!S.profiles.some(p => p.id === S.last)) S.last = S.profiles.length ? S.profiles[0].id : null;
}

/* ---------- finestre ---------- */
function modal(o) {
  return new Promise(res => {
    const back = h('div', { class: 'modal-back' }), box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
    const close = v => { back.remove(); res(v); };
    const btns = (o.buttons || []).map(b => h('button', {
      type: 'button', class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''),
      onclick: () => { if (b.check && b.check() === false) return; close(typeof b.value === 'function' ? b.value() : b.value); }
    }, b.label));
    box.append(h('h2', null, o.title || ''));
    add(box, o.body);
    box.append(h('div', { class: 'modal-btns' }, btns));
    back.append(box);
    box.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const p = box.querySelector('.btn.primary'); if (p) p.click(); }
      else if (e.key === 'Escape') close(null);
    });
    $('#layer').append(back);
    const f = box.querySelector('input,textarea,select'); if (f) f.focus();
  });
}
const confirmBox = (msg, ok, danger) => modal({ title: 'Conferma', body: h('p', null, msg), buttons: [{ label: 'Annulla', value: false }, { label: ok || 'Sì', primary: !danger, danger: !!danger, value: true }] });
function textBox(title, label, initial, multi) {
  const inp = multi ? h('textarea', null, initial || '') : h('input', { type: 'text', value: initial || '' });
  return modal({ title: title, body: h('div', { class: 'fld' }, label ? h('label', null, label) : null, inp), buttons: [{ label: 'Annulla', value: null }, { label: 'OK', primary: true, value: () => inp.value.trim() }] });
}
function overlay(el) { const back = h('div', { class: 'modal-back' }, h('div', { class: 'modal' }, el)); $('#layer').append(back); return () => back.remove(); }
let toastT = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
function download(name, text, mime) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' })), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- PIN modalità adulto ---------- */
async function setPinFlow() {
  const a = h('input', { type: 'password', inputmode: 'numeric', maxlength: 4, class: 'pin', autocomplete: 'off' });
  const b = h('input', { type: 'password', inputmode: 'numeric', maxlength: 4, class: 'pin', autocomplete: 'off' });
  const r = await modal({
    title: 'Scegli il PIN',
    body: [h('p', null, 'PIN di 4 cifre: protegge le impostazioni da modifiche accidentali (non è una protezione dei dati).'), h('div', { class: 'fld' }, h('label', null, 'Nuovo PIN'), a), h('div', { class: 'fld' }, h('label', null, 'Ripeti il PIN'), b)],
    buttons: [{ label: 'Annulla', value: null }, {
      label: 'Salva PIN', primary: true, value: () => a.value,
      check: () => { if (!/^\d{4}$/.test(a.value)) { toast('Servono 4 cifre'); return false; } if (a.value !== b.value) { toast('I due PIN sono diversi'); return false; } }
    }]
  });
  if (!r) return false;
  S.pin = r;
  if (!S.recovery) {
    S.recovery = String(Math.floor(10000000 + Math.random() * 89999999));
    await modal({ title: 'Codice di recupero', body: [h('p', null, 'Scrivilo su carta. Serve se dimentichi il PIN:'), h('p', { style: { fontSize: '2em', textAlign: 'center', fontWeight: '700', letterSpacing: '.1em' } }, S.recovery)], buttons: [{ label: 'Ho scritto il codice', primary: true, value: true }] });
  }
  await saveNow();
  return true;
}
async function adultGate() {
  if (ADULT) return true;
  if (S.pin == null) { const ok = await setPinFlow(); if (ok) ADULT = true; return ok; }
  const inp = h('input', { type: 'password', inputmode: 'numeric', maxlength: 4, class: 'pin', autocomplete: 'off' });
  const r = await modal({
    title: 'Modalità adulto', body: h('div', { class: 'fld' }, h('label', null, 'Inserisci il PIN'), inp),
    buttons: [{ label: 'Annulla', value: null }, { label: 'PIN dimenticato', value: 'forgot' }, { label: 'OK', primary: true, value: () => inp.value }]
  });
  if (r === 'forgot') {
    const c = await textBox('Recupero PIN', 'Codice di recupero (8 cifre)', '');
    if (c && c === S.recovery) { const ok = await setPinFlow(); if (ok) ADULT = true; return ok; }
    if (c) toast('Codice errato');
    return false;
  }
  if (r == null) return false;
  if (r === S.pin) { ADULT = true; return true; }
  toast('PIN errato'); return false;
}

/* ---------- ARASAAC ---------- */
const AR = { api: 'https://api.arasaac.org/v1', img: id => 'https://static.arasaac.org/pictograms/' + id + '/' + id + '_300.png' };
async function arSearch(term, eps) {
  term = term.trim(); if (!term) return [];
  for (const ep of (eps || ['search', 'bestsearch'])) {
    const r = await fetch(AR.api + '/pictograms/it/' + ep + '/' + encodeURIComponent(term));
    if (r.status === 404) continue;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (Array.isArray(j) && j.length) return j.map(x => ({ id: x._id, kw: (x.keywords && x.keywords[0] && x.keywords[0].keyword) || term }));
  }
  return [];
}
const IMG = new Map(); // chiave -> URL locale dell'immagine
const picKey = p => p ? p.k + ':' + p.id : null;
function picSrc(p) { if (!p) return ''; const k = picKey(p); if (IMG.has(k)) return IMG.get(k); return p.k === 'a' ? AR.img(p.id) : ''; }
async function picLoad(p) {
  const k = picKey(p); if (!k || IMG.has(k)) return;
  try { const b = await DB.get('img', k); if (b) IMG.set(k, URL.createObjectURL(b)); } catch (e) { /* ignora */ }
}
async function picFetch(p) {
  const k = picKey(p); if (!k) return false;
  await picLoad(p); if (IMG.has(k)) return true;
  if (p.k !== 'a') return false;
  try {
    const r = await fetch(AR.img(p.id)); if (!r.ok) return false;
    const b = await r.blob(); await DB.put('img', k, b); IMG.set(k, URL.createObjectURL(b)); return true;
  } catch (e) { return false; }
}
async function addPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const m = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * m); c.height = Math.round(img.naturalHeight * m);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85));
    const pic = { k: 'p', id: 'ph' + uid() };
    await DB.put('img', picKey(pic), blob); IMG.set(picKey(pic), URL.createObjectURL(blob));
    return pic;
  } finally { URL.revokeObjectURL(url); }
}
async function preloadAll() {
  for (const pr of S.profiles) {
    for (const pg of pr.pages) for (const c of pg.cells) if (c && c.pic) await picLoad(c.pic);
    for (const f of pr.phrases) if (f.pic) await picLoad(f.pic);
  }
}

/* ---------- voce ---------- */
let VOICES = [];
function loadVoices() { try { VOICES = speechSynthesis.getVoices().filter(v => /^it/i.test(v.lang)); } catch (e) { VOICES = []; } }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text, st) {
  if (!text) return;
  if (!('speechSynthesis' in window)) { toast('Questo dispositivo non ha la voce sintetica'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'it-IT';
  const v = VOICES.find(x => x.voiceURI === st.voice); if (v) u.voice = v;
  u.rate = st.rate; u.pitch = st.pitch;
  speechSynthesis.speak(u);
}

/* ---------- navigazione ---------- */
const SCREENS = {};
let CUR = { code: null, params: {} };
function guard(code) {
  if (code === '2a' && !P()) return '1a';
  if ((code.charAt(0) === '3' || code === '1b') && !ADULT) return P() ? '2a' : '1a';
  if (code.charAt(0) === '3' && !P()) return '1a';
  return code;
}
function applyTheme() { const p = P(), st = p ? p.settings : defaultSettings(); document.body.className = 'c-' + st.contrast + ' f-' + st.font; }
function render() {
  applyTheme();
  const app = $('#app'); app.replaceChildren();
  document.body.dataset.screen = CUR.code;
  app.append(SCREENS[CUR.code](CUR.params));
  if (S.showCodes) app.append(h('div', { class: 'codice noprint' }, 'scheda ' + CUR.code));
  window.scrollTo(0, 0);
}
function go(code, params, replace) {
  code = guard(code); params = params || {};
  CUR = { code: code, params: params };
  try { if (replace) history.replaceState({ code: code, params: params }, ''); else history.pushState({ code: code, params: params }, ''); } catch (e) { /* ignora */ }
  render();
}
window.addEventListener('popstate', e => {
  const s = e.state; if (!s || !SCREENS[s.code]) return;
  CUR = { code: guard(s.code), params: s.params || {} };
  render();
});
