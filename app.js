/* PanelLabels — app.js
 * Λογική εφαρμογής: δεδομένα (τοπική αποθήκευση), οθόνες, επεξεργασία, εκτύπωση, αντίγραφα ασφαλείας.
 * Χωρίς server και χωρίς εξωτερικές βιβλιοθήκες.
 */
'use strict';

const APP_VERSION = '1.2.0';
const STORE_KEY = 'panellabels.v1';
const WIDTHS = [1, 1.5, 2, 3, 4, 5, 6];
const SUGGEST = ['Γενικός διακόπτης', 'Ρελέ διαρροής', 'Θερμοσίφωνας', 'Πρίζες κουζίνας', 'Φωτισμός σαλονιού',
  'Κλιματιστικό', 'Πλυντήριο', 'Πρίζες υπνοδωματίων', 'Κουζίνα', 'Φωτισμός', 'Πρίζες', 'Εφεδρικό'];
const SUGGEST_SYM = { 'Γενικός διακόπτης': 'main', 'Ρελέ διαρροής': 'rcd', 'Θερμοσίφωνας': 'heater', 'Πρίζες κουζίνας': 'socket',
  'Φωτισμός σαλονιού': 'light', 'Κλιματιστικό': 'ac', 'Πλυντήριο': 'washer', 'Πρίζες υπνοδωματίων': 'socket', 'Κουζίνα': 'cooker',
  'Φωτισμός': 'light', 'Πρίζες': 'socket' };
const DEFAULT_SETTINGS = {
  unitMM: 17.5, labelH: 12, pageMode: 'a4l', showSymbols: true, showCaptions: true, rollMax: 250,
  stickerW: 80, stickerH: 40, stickerCopies: 1
};
const BACKUP_REMIND_DAYS = 7;
/* Χρώματα στοιχείου: φόντο (bg), γράμματα (fg), σύμβολο (sc), περίγραμμα (bc) */
const DEF_COL = { bg: '#ffffff', fg: '#000000', sc: '#000000', bc: '#000000' };
const COL_KEYS = ['bg', 'fg', 'sc', 'bc'];
const COL_LABEL = { bg: 'Φόντο', fg: 'Γράμματα', sc: 'Σύμβολο', bc: 'Περίγραμμα' };
const BG_SWATCH = ['#ffffff', '#f1f3f5', '#fff3bf', '#ffe8cc', '#ffe3e3', '#d3f9d8', '#d0ebff', '#e5dbff',
  '#ffd43b', '#ff922b', '#fa5252', '#40c057', '#339af0', '#212529'];
const INK_SWATCH = ['#000000', '#495057', '#ffffff', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#7048e8'];
const isHex = c => /^#[0-9a-f]{6}$/i.test(String(c || ''));

/* Μελλοντικές συνδρομές: όλα τα δικαιώματα περνούν από εδώ. Στην έκδοση καταστήματος
 * το isPro() θα ελέγχει την αγορά (π.χ. RevenueCat / StoreKit / Play Billing) — τα έργα μένουν στη συσκευή. */
const Entitlements = { isPro: () => true, canUse: feature => true };

const $ = (sel, root) => (root || document).querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : d; };

/* ================= Δεδομένα ================= */
function normItem(i) {
  i = i || {};
  return { id: i.id || uid(), w: WIDTHS.includes(+i.w) ? +i.w : 1, text: String(i.text || ''), sym: SYMBOLS[i.sym] ? i.sym : '', rating: String(i.rating || '') };
}
function normRow(r) { r = r || {}; return { id: r.id || uid(), name: String(r.name || ''), items: (Array.isArray(r.items) ? r.items : []).map(normItem) }; }
function normColors(c, items) {
  // έκδοση 1.1 είχε χρώματα ανά στοιχείο: παίρνουμε του πρώτου στοιχείου με μη-προεπιλεγμένα χρώματα
  if (!c && items) c = items.find(i => i && COL_KEYS.some(k => isHex(i[k]) && i[k].toLowerCase() !== DEF_COL[k]));
  c = c || {};
  const o = {};
  COL_KEYS.forEach(k => { o[k] = isHex(c[k]) ? c[k].toLowerCase() : DEF_COL[k]; });
  return o;
}
function normProject(p) {
  if (!p || typeof p !== 'object') return null;
  const rawItems = (Array.isArray(p.rows) ? p.rows : []).flatMap(r => (r && Array.isArray(r.items)) ? r.items : []);
  return {
    colors: normColors(p.colors, rawItems),
    id: p.id || uid(), name: String(p.name || 'Χωρίς όνομα'), address: String(p.address || ''),
    modulesPerRow: clamp(Math.round(num(p.modulesPerRow, 12)), 0, 96), fillEmpty: p.fillEmpty !== false,
    sample: !!p.sample, createdAt: +p.createdAt || Date.now(), updatedAt: +p.updatedAt || Date.now(),
    rows: (Array.isArray(p.rows) ? p.rows : []).map(normRow)
  };
}
function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  const s = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
  s.unitMM = clamp(num(s.unitMM, 17.5), 10, 30);
  s.labelH = clamp(num(s.labelH, 12), 6, 40);
  s.rollMax = clamp(num(s.rollMax, 250), 40, 2000);
  s.stickerW = clamp(num(s.stickerW, 80), 20, 200);
  s.stickerH = clamp(num(s.stickerH, 40), 10, 150);
  s.stickerCopies = clamp(Math.round(num(s.stickerCopies, 1)), 1, 200);
  if (!['a4l', 'a4p', 'roll'].includes(s.pageMode)) s.pageMode = 'a4l';
  return {
    schema: 1,
    projects: (Array.isArray(d.projects) ? d.projects : []).map(normProject).filter(Boolean),
    electrician: (e => { e.bg = isHex(e.bg) ? e.bg.toLowerCase() : '#ffffff'; return e; })(Object.assign({ name: '', phone: '', email: '', extra: '', logo: '', bg: '#ffffff' }, d.electrician || {})),
    settings: s,
    lastProjectId: d.lastProjectId || null,
    lastBackup: d.lastBackup || null,
    initialized: !!d.initialized
  };
}

const Store = {
  data: null,
  available: true,
  load() {
    let raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { this.available = false; }
    let d = null;
    try { d = raw ? JSON.parse(raw) : null; } catch (e) { d = null; }
    this.data = normalize(d);
  },
  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      toast('Η αποθήκευση απέτυχε. Ο χώρος του browser ίσως γέμισε ή είναι αποκλεισμένος. Κάντε αντίγραφο ασφαλείας.', true);
      return false;
    }
  }
};

function sampleProject() {
  const it = (text, w, sym, rating) => normItem({ text, w, sym, rating });
  return normProject({
    name: 'Παράδειγμα — Διαμέρισμα 2ου ορόφου', address: 'Δείγμα για δοκιμή', modulesPerRow: 12, sample: true,
    rows: [
      { name: 'Γενικά & μεγάλες καταναλώσεις', items: [
        it('Γενικός διακόπτης', 2, 'main', '40A'), it('Ρελέ διαρροής', 2, 'rcd', '40A 30mA'),
        it('Θερμοσίφωνας', 1, 'heater', '20A'), it('Κουζίνα', 1.5, 'cooker', '25A'),
        it('Κλιματιστικό σαλονιού', 1, 'ac', '16A'), it('Πλυντήριο', 1, 'washer', '16A')] },
      { name: 'Φωτισμός & πρίζες', items: [
        it('Φωτισμός σαλονιού', 1, 'light', '10A'), it('Φωτισμός υπνοδωματίων', 1, 'light', '10A'),
        it('Πρίζες κουζίνας', 1, 'socket', '16A'), it('Πρίζες σαλονιού', 1, 'socket', '16A'),
        it('Πρίζες υπνοδωματίων', 1, 'socket', '16A'), it('Πρίζες μπάνιου', 1, 'socket', '16A'),
        it('Εξωτερικός φωτισμός', 1, 'outdoor', '10A')] }
    ]
  });
}

/* ================= Κατάσταση UI ================= */
const UI = { view: 'projects', sheetItem: null, previewTimer: 0, installEvt: null, busy: false };

const D = () => Store.data;
const S = () => Store.data.settings;
function currentProject() { return D().projects.find(p => p.id === D().lastProjectId) || null; }
function findItem(p, itemId) {
  for (let ri = 0; ri < p.rows.length; ri++) {
    const ii = p.rows[ri].items.findIndex(i => i.id === itemId);
    if (ii >= 0) return { row: p.rows[ri], ri, ii, item: p.rows[ri].items[ii] };
  }
  return null;
}

/* Ελεύθερες θέσεις σειράς (Infinity αν δεν υπάρχει όριο). exceptItem: δεν μετράει αυτό το στοιχείο. */
function rowFree(p, row, exceptItem) {
  const cap = +p.modulesPerRow || 0;
  if (!cap) return Infinity;
  const used = row.items.reduce((a, i) => a + (i === exceptItem ? 0 : i.w), 0);
  return Math.round((cap - used) * 2) / 2;
}
function fullMsg(p, row) {
  const ri = p.rows.indexOf(row);
  return `Η σειρά ${ri + 1} δεν έχει άλλο χώρο (${fmtUnits(rowUnits(row))}/${p.modulesPerRow} θέσεις).`;
}

let saveTimer = 0;
function commit(opts) {
  const p = currentProject();
  if (p && !(opts && opts.noTouch)) p.updatedAt = Date.now();
  clearTimeout(saveTimer);
  const doSave = () => {
    if (Store.save()) setSaveState('Αποθηκεύτηκε ' + new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }));
  };
  if (opts && opts.debounce) { setSaveState('Αποθήκευση…'); saveTimer = setTimeout(doSave, 400); }
  else doSave();
}
function setSaveState(t) { const el = $('#saveState'); if (el) el.textContent = t; }

/* ================= Βοηθητικά UI ================= */
let toastTimer = 0;
function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, isErr ? 6000 : 2400);
}

function dialog({ title, text, ok = 'Εντάξει', cancel = 'Άκυρο', danger = false, input = null, choices = null }) {
  return new Promise(resolve => {
    const m = $('#modal');
    const btns = choices
      ? choices.map((c, i) => `<button class="btn ${c.cls || ''}" data-choice="${i}">${esc(c.label)}</button>`).join('')
      : `<button class="btn ghost" data-choice="cancel">${esc(cancel)}</button><button class="btn ${danger ? 'solid-danger' : 'primary'}" data-choice="ok">${esc(ok)}</button>`;
    m.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
      <h2 id="dlgTitle">${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}
      ${input ? `<label class="fld"><span>${esc(input.label)}</span><input id="dlgInput" value="${esc(input.value || '')}" autocomplete="off"></label>` : ''}
      <div class="btn-row end">${btns}</div></div>`;
    m.hidden = false;
    const inp = $('#dlgInput', m);
    setTimeout(() => { const f = inp || m.querySelector('[data-choice="ok"],[data-choice="0"]'); if (f) f.focus(); }, 30);
    const done = v => { m.hidden = true; m.innerHTML = ''; m.onclick = null; document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => {
      if (e.key === 'Escape') done(choices ? null : false);
      if (e.key === 'Enter' && inp) done(inp.value.trim());
    };
    document.addEventListener('keydown', onKey);
    m.onclick = e => {
      if (e.target === m) return done(choices ? null : false);
      const b = e.target.closest('[data-choice]');
      if (!b) return;
      const c = b.dataset.choice;
      if (choices) return done(+c);
      if (c === 'cancel') return done(input ? null : false);
      done(input ? (inp.value.trim() || input.value || '') : true);
    };
  });
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function safeName(s) { return (String(s || 'PanelLabels').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 60)) || 'PanelLabels'; }
const isTouch = () => matchMedia('(pointer: coarse)').matches;

/* Παράδοση αρχείου: στο κινητό με το μενού κοινοποίησης (εκεί υπάρχει «Εκτύπωση» και «Αποθήκευση»),
 * αλλιώς λήψη. Αν ο browser δεν επιτρέψει την κοινοποίηση επειδή πέρασε χρόνος από το πάτημα,
 * εμφανίζεται κουμπί για νέο πάτημα. printHint: κείμενο που εξηγεί πού είναι η εκτύπωση. */
async function deliverFile(blob, filename, printHint) {
  const file = new File([blob], filename, { type: blob.type });
  const canShare = isTouch() && navigator.canShare && navigator.canShare({ files: [file] });
  if (canShare) {
    try { await navigator.share({ files: [file], title: filename }); return 'shared'; }
    catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      if (e && e.name === 'NotAllowedError') {
        const go = await dialog({ title: 'Το αρχείο είναι έτοιμο', text: printHint || filename, ok: printHint ? 'Άνοιγμα για εκτύπωση' : 'Άνοιγμα', cancel: 'Κλείσιμο' });
        if (!go) return 'cancelled';
        try { await navigator.share({ files: [file], title: filename }); return 'shared'; }
        catch (e2) { if (e2 && e2.name === 'AbortError') return 'cancelled'; }
      }
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ================= Πλοήγηση ================= */
const VIEWS = ['projects', 'editor', 'colors', 'print', 'info', 'backup'];
function route() {
  const h = (location.hash || '').replace('#', '');
  UI.view = VIEWS.includes(h) ? h : (currentProject() ? 'editor' : 'projects');
  closeSheet(true);
  render();
  window.scrollTo(0, 0);
}
function go(view) { if (location.hash === '#' + view) route(); else location.hash = view; }

function render() {
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === UI.view));
  const p = currentProject();
  $('#topProject').textContent = p ? p.name : 'Ετικέτες ηλεκτρικών πινάκων';
  const app = $('#app');
  const fn = { projects: viewProjects, editor: viewEditor, colors: viewColors, print: viewPrint, info: viewInfo, backup: viewBackup }[UI.view];
  app.innerHTML = fn();
  if (UI.view === 'colors') renderColorPreview();
  if (UI.view === 'print') schedulePreview(0);
  if (UI.view === 'info') renderStickerPreview();
}

/* ================= Οθόνη: Έργα ================= */
function backupNotice() {
  const d = D();
  const real = d.projects.filter(p => !p.sample).length;
  if (!real) return '';
  const days = d.lastBackup ? (Date.now() - d.lastBackup) / 864e5 : Infinity;
  if (days < BACKUP_REMIND_DAYS) return '';
  return `<div class="notice"><p><b>Τα έργα υπάρχουν μόνο σε αυτή τη συσκευή.</b> ${d.lastBackup ? `Τελευταίο αντίγραφο: ${fmtDate(d.lastBackup)}.` : 'Δεν έχετε κάνει ακόμη αντίγραφο ασφαλείας.'}</p>
    <button class="btn small primary" data-act="exportBackup">Αντίγραφο τώρα</button></div>`;
}

function viewProjects() {
  const d = D();
  const list = [...d.projects].sort((a, b) => b.updatedAt - a.updatedAt);
  const cards = list.map(p => {
    const items = p.rows.reduce((a, r) => a + r.items.length, 0);
    return `<div class="pcard ${p.id === d.lastProjectId ? 'current' : ''}">
      <button class="open" data-act="openProject" data-id="${p.id}">
        <span class="pname">${esc(p.name)}${p.sample ? '<span class="tag">παράδειγμα</span>' : ''}</span>
        ${p.address ? `<span class="pmeta">${esc(p.address)}</span>` : ''}
        <span class="pmeta">${p.rows.length} ${p.rows.length === 1 ? 'σειρά' : 'σειρές'} · ${items} στοιχεία · ${fmtDate(p.updatedAt)}</span>
      </button>
      <div class="pacts">
        <button class="btn icon ghost" data-act="dupProject" data-id="${p.id}" title="Αντιγραφή έργου" aria-label="Αντιγραφή έργου"><svg viewBox="0 0 24 24"><path d="M8 8h12v12H8zM4 16V4h12"/></svg></button>
        <button class="btn icon ghost danger" data-act="delProject" data-id="${p.id}" title="Διαγραφή έργου" aria-label="Διαγραφή έργου"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
      </div></div>`;
  }).join('');
  return `<div class="view-head"><div><div class="eyebrow">Έργα</div><h1>Οι πίνακές σας</h1></div>
      <button class="btn primary" data-act="newProject"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Νέο έργο</button></div>
    ${!Store.available ? '<div class="notice err"><p>Ο browser δεν επιτρέπει τοπική αποθήκευση (π.χ. ιδιωτική περιήγηση). Τα έργα δεν θα κρατηθούν.</p></div>' : ''}
    ${backupNotice()}
    ${list.length ? `<div class="plist">${cards}</div>` :
      `<div class="panel empty-state"><p>Δεν υπάρχουν έργα ακόμη. Κάθε ηλεκτρικός πίνακας είναι ένα έργο.</p>
       <button class="btn primary" data-act="newProject">Δημιουργία πρώτου έργου</button></div>`}`;
}

/* ================= Οθόνη: Πίνακας ================= */
function viewEditor() {
  const p = currentProject();
  if (!p) return `<div class="panel empty-state"><h2>Δεν έχει ανοίξει έργο</h2><p>Ανοίξτε ένα έργο από τη λίστα ή δημιουργήστε νέο.</p>
    <div class="btn-row"><button class="btn primary" data-act="newProject">Νέο έργο</button><a class="btn" href="#projects">Λίστα έργων</a></div></div>`;
  return `${p.sample ? '<div class="notice"><p>Αυτό είναι έργο-παράδειγμα για να δείτε πώς λειτουργεί η εφαρμογή. Μπορείτε να το αλλάξετε ή να το διαγράψετε.</p></div>' : ''}
    <section class="panel">
      <div class="proj-fields">
        <label class="fld wide"><span>Όνομα έργου</span><input id="pName" data-pf="name" value="${esc(p.name)}" autocomplete="off"></label>
        <label class="fld wide"><span>Πελάτης / διεύθυνση (προαιρετικά)</span><input id="pAddr" data-pf="address" value="${esc(p.address)}" autocomplete="off"></label>
        <label class="fld"><span>Θέσεις ανά σειρά</span><input id="pMod" data-pf="modulesPerRow" type="number" inputmode="numeric" min="0" max="96" value="${p.modulesPerRow}"></label>
      </div>
      <p class="hint">Θέσεις ανά σειρά: πόσες μονάδες χωράει κάθε ράγα (0 = χωρίς όριο). Μία μονάδα = ${fmtMM(+S().unitMM)} mm.</p>
    </section>
    <div id="rows" style="display:flex;flex-direction:column;gap:12px">${p.rows.map((r, ri) => rowHtml(p, r, ri)).join('')}</div>
    <button class="btn" data-act="addRow"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Προσθήκη σειράς</button>
    <div class="sticky-actions">
      <button class="btn" data-act="saveNow"><svg viewBox="0 0 24 24"><path d="M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7"/></svg>Αποθήκευση</button>
      <a class="btn primary" href="#print"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6a3 3 0 1 0 0 6z"/></svg>Προεπισκόπηση</a>
    </div>`;
}

function rowHtml(p, r, ri) {
  const used = rowUnits(r);
  const cap = +p.modulesPerRow || 0;
  const capCls = cap ? (used > cap ? 'over' : used === cap ? 'full' : '') : '';
  const cells = r.items.map(i => {
    const ph = !i.text.trim();
    return `<button class="cell item${ph ? ' ph' : ''}${UI.sheetItem === i.id ? ' sel' : ''}" style="--w:${i.w}" data-act="editItem" data-id="${i.id}" aria-label="${esc(i.text || 'Στοιχείο χωρίς περιγραφή')}, ${fmtUnits(i.w)} μονάδες">
      <span class="w">${fmtUnits(i.w)}</span>${i.sym ? symSvg(i.sym) : ''}<span class="t">${ph ? 'χωρίς περιγραφή' : esc(i.text)}</span>${i.rating ? `<span class="r">${esc(i.rating)}</span>` : ''}</button>`;
  }).join('');
  const free = rowFree(p, r);
  const canAdd = free >= 1;
  let empties = '';
  if (cap) {
    let rem = Math.round((cap - used) * 2) / 2 - (canAdd ? 1 : 0);
    while (rem >= 1) { empties += '<div class="cell empty" style="--w:1" aria-hidden="true"></div>'; rem -= 1; }
    if (rem > 0) empties += `<div class="cell empty" style="--w:${rem}" aria-hidden="true"></div>`;
  }
  return `<article class="row-card" data-row="${r.id}">
    <div class="row-head">
      <span class="row-num">${ri + 1}</span>
      <input class="row-name" data-rf="name" data-row="${r.id}" value="${esc(r.name)}" placeholder="Σειρά ${ri + 1}" aria-label="Όνομα σειράς ${ri + 1}">
      <span class="cap ${capCls}">${fmtUnits(used)}${cap ? ' / ' + cap : ''} μον.</span>
      <div class="row-tools">
        <button class="btn icon ghost" data-act="rowUp" data-row="${r.id}" aria-label="Μετακίνηση σειράς πάνω" ${ri === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>
        <button class="btn icon ghost" data-act="rowDown" data-row="${r.id}" aria-label="Μετακίνηση σειράς κάτω" ${ri === p.rows.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg></button>
        <button class="btn icon ghost danger" data-act="rowDel" data-row="${r.id}" aria-label="Διαγραφή σειράς"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
      </div>
    </div>
    <div class="strip-wrap" data-wrap="${r.id}"><div class="strip" style="--bg:${p.colors.bg};--fg:${p.colors.fg};--sc:${p.colors.sc};--bc:${p.colors.bc}">${cells}${canAdd ? `<button class="cell add" style="--w:1" data-act="addItem" data-row="${r.id}"><b>+</b>Στοιχείο</button>` : ''}${empties}</div></div>
    ${cap && !canAdd && used <= cap ? `<p class="hint">Η σειρά είναι γεμάτη.${free > 0 ? ' Περισσεύει μισή θέση.' : ''}</p>` : ''}
    ${cap && used > cap ? `<p class="row-warn">Η σειρά ξεπερνά τις ${cap} θέσεις κατά ${fmtUnits(used - cap)} μον.</p>` : ''}
  </article>`;
}

function rerenderRows() {
  const p = currentProject();
  const el = $('#rows');
  if (!p || !el) return;
  const keep = {};
  el.querySelectorAll('[data-wrap]').forEach(w => { keep[w.dataset.wrap] = w.scrollLeft; });
  el.innerHTML = p.rows.map((r, ri) => rowHtml(p, r, ri)).join('');
  el.querySelectorAll('[data-wrap]').forEach(w => { if (keep[w.dataset.wrap] != null) w.scrollLeft = keep[w.dataset.wrap]; });
}
/* Φέρνει στο οπτικό πεδίο της λωρίδας το στοιχείο (και το κουμπί «+» δίπλα του αν είναι το τελευταίο). */
function revealItem(itemId) {
  const cell = document.querySelector(`.cell[data-id="${itemId}"]`);
  if (!cell) return;
  const wrap = cell.closest('.strip-wrap');
  let right = cell.offsetLeft + cell.offsetWidth;
  const next = cell.nextElementSibling;
  if (next && next.classList.contains('add')) right += next.offsetWidth;
  const left = cell.offsetLeft;
  if (right > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = right - wrap.clientWidth + 8;
  else if (left < wrap.scrollLeft) wrap.scrollLeft = Math.max(0, left - 8);
}

/* ---------- Φύλλο στοιχείου ---------- */
function openSheet(itemId, focusText) {
  const p = currentProject();
  const f = p && findItem(p, itemId);
  if (!f) return;
  UI.sheetItem = itemId;
  const it = f.item;
  const sh = $('#sheet');
  const freeHere = rowFree(p, f.row, it);
  const prevRow = p.rows[f.ri - 1], nextRow = p.rows[f.ri + 1];
  sh.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Επεξεργασία στοιχείου">
    <div class="grab"></div>
    <div class="sheet-head"><h2>Σειρά ${f.ri + 1} · θέση ${f.ii + 1}</h2><button class="btn primary small" data-act="closeSheet">Έτοιμο</button></div>
    <label class="fld"><span>Περιγραφή</span><textarea id="itText" rows="2" placeholder="π.χ. Φωτισμός σαλονιού">${esc(it.text)}</textarea></label>
    <div class="chips" aria-label="Γρήγορες περιγραφές">${SUGGEST.map(s => `<button class="chip soft" data-act="suggest" data-text="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <div class="fld"><span>Πλάτος (μονάδες)</span><div class="chips" id="wChips">${WIDTHS.map(w => `<button class="chip ${it.w === w ? 'on' : ''}" data-act="setW" data-w="${w}" ${w > freeHere ? 'disabled' : ''}>${fmtUnits(w)}</button>`).join('')}</div>
      <span class="hint measure" id="wMM">${fmtMM(it.w * S().unitMM)} mm${p.modulesPerRow ? ` · ελεύθερες θέσεις στη σειρά: ${fmtUnits(freeHere - it.w)}` : ''}</span></div>
    <label class="fld"><span>Ένδειξη (προαιρετικά)</span><input id="itRating" value="${esc(it.rating)}" placeholder="π.χ. 16A, C16, 40A 30mA" autocomplete="off"></label>
    <div class="fld"><span>Σύμβολο (προαιρετικό)</span><div class="sym-grid" id="symGrid">
      <button class="sym-btn ${!it.sym ? 'on' : ''}" data-act="setSym" data-sym=""><svg viewBox="0 0 24 24"><path d="M5 5l14 14"/></svg>Χωρίς</button>
      ${Object.keys(SYMBOLS).map(k => `<button class="sym-btn ${it.sym === k ? 'on' : ''}" data-act="setSym" data-sym="${k}">${symSvg(k, '')}${esc(SYMBOLS[k].name)}</button>`).join('')}
    </div></div>
    <div class="fld"><span>Μετακίνηση</span><div class="move-grid">
      <button class="btn" data-act="mvLeft" ${f.ii === 0 ? 'disabled' : ''}>← Αριστερά</button>
      <button class="btn" data-act="mvRight" ${f.ii === f.row.items.length - 1 ? 'disabled' : ''}>Δεξιά →</button>
      <button class="btn" data-act="mvUpRow" ${!prevRow || rowFree(p, prevRow) < it.w ? 'disabled' : ''}>↑ Στην προηγ. σειρά</button>
      <button class="btn" data-act="mvDownRow" ${!nextRow || rowFree(p, nextRow) < it.w ? 'disabled' : ''}>↓ Στην επόμ. σειρά</button>
    </div></div>
    <div class="btn-row"><button class="btn" data-act="dupItem" ${freeHere - it.w < it.w ? 'disabled' : ''}>Διπλότυπο</button><button class="btn danger" data-act="delItem">Διαγραφή στοιχείου</button></div>
  </div>`;
  const prevScroll = UI.sheetScroll || 0;
  sh.hidden = false;
  if (UI.sheetReopen) { const el = $('.sheet', sh); if (el) el.scrollTop = prevScroll; }
  UI.sheetReopen = false;
  rerenderRows();
  revealItem(itemId);
  if (focusText) setTimeout(() => $('#itText').focus(), 60);
}
function reopenSheet() {
  const c = sheetCtx(); if (!c) return;
  const el = $('#sheet .sheet');
  UI.sheetScroll = el ? el.scrollTop : 0;
  UI.sheetReopen = true;
  openSheet(c.f.item.id, false);
}
function closeSheet(silent) {
  const sh = $('#sheet');
  if (sh.hidden) return;
  sh.hidden = true; sh.innerHTML = '';
  UI.sheetItem = null;
  if (!silent) rerenderRows();
}
function sheetCtx() { const p = currentProject(); const f = p && UI.sheetItem && findItem(p, UI.sheetItem); return f ? { p, f } : null; }

/* ================= Οθόνη: Χρώματα ετικετών ================= */
/* Επιλογέας χρώματος: έτοιμα χρώματα + «άλλο χρώμα». group: 'label' (ετικέτες έργου) ή 'sticker' (αυτοκόλλητο). */
function colorPicker(group, key, value, palette, label) {
  const sw = palette.map(c => `<button class="sw ${value === c ? 'on' : ''}" style="--c:${c}" data-act="pickColor" data-g="${group}" data-k="${key}" data-c="${c}" aria-label="${esc(label)} ${c}" aria-pressed="${value === c}"></button>`).join('');
  const custom = !palette.includes(value);
  return `<div class="color-row"><span class="cl">${esc(label)}</span><div class="sws" data-sws="${group}-${key}">${sw}
    <label class="sw custom ${custom ? 'on' : ''}" style="--c:${value}" title="Άλλο χρώμα"><input type="color" id="cp-${group}-${key}" data-pickg="${group}" data-pickk="${key}" value="${value}" aria-label="Άλλο χρώμα: ${esc(label)}"></label></div></div>`;
}
function applyColor(group, key, c, inputEl) {
  if (!isHex(c)) return;
  if (group === 'label') {
    const p = currentProject(); if (!p || !COL_KEYS.includes(key)) return;
    p.colors[key] = c;
    commit({ debounce: !!inputEl });
    renderColorPreview(inputEl ? 120 : 0);
  } else if (group === 'sticker') {
    D().electrician.bg = c;
    commit({ debounce: !!inputEl, noTouch: true });
    renderStickerPreview(inputEl ? 120 : 0);
  } else return;
  // ενημέρωση επιλεγμένου κύκλου χωρίς να ξαναχτιστεί η οθόνη (το παράθυρο χρώματος μένει ανοιχτό)
  const box = document.querySelector(`[data-sws="${group}-${key}"]`);
  if (box) {
    const pal = (key === 'bg' ? BG_SWATCH : INK_SWATCH);
    box.querySelectorAll('.sw').forEach(b => {
      const on = b.classList.contains('custom') ? !pal.includes(c) : b.dataset.c === c;
      b.classList.toggle('on', on);
      if (!b.classList.contains('custom')) b.setAttribute('aria-pressed', on);
    });
    const cust = box.querySelector('.sw.custom');
    if (cust) { cust.style.setProperty('--c', c); const i = cust.querySelector('input'); if (i && i !== inputEl) i.value = c; }
  }
}

function viewColors() {
  const p = currentProject();
  if (!p) return `<div class="panel empty-state"><h2>Δεν έχει ανοίξει έργο</h2><p>Τα χρώματα ορίζονται για κάθε έργο. Ανοίξτε ένα έργο πρώτα.</p><a class="btn primary" href="#projects">Λίστα έργων</a></div>`;
  const c = p.colors;
  return `<div class="view-head"><div><div class="eyebrow">Χρώματα ετικετών</div><h1>${esc(p.name)}</h1></div></div>
  <p class="lead">Ορίζονται μία φορά και ισχύουν για όλες τις ετικέτες αυτού του έργου, στην οθόνη, στο PDF και στην εκτύπωση.</p>
  <section class="panel">
    ${colorPicker('label', 'bg', c.bg, BG_SWATCH, 'Φόντο ετικέτας')}
    ${colorPicker('label', 'fg', c.fg, INK_SWATCH, 'Γραμματοσειρά')}
    ${colorPicker('label', 'sc', c.sc, INK_SWATCH, 'Σύμβολο')}
    ${colorPicker('label', 'bc', c.bc, INK_SWATCH, 'Περίγραμμα')}
    <div class="btn-row"><button class="btn ghost" data-act="colorsReset">Προεπιλογή (λευκό φόντο, μαύρα στοιχεία)</button></div>
  </section>
  <section class="panel">
    <h2>Προεπισκόπηση</h2>
    <div class="preview" id="colorPreview"></div>
    <p class="hint">Το αυτοκόλλητο ηλεκτρολόγου έχει δικό του φόντο, στην καρτέλα «Στοιχεία».</p>
  </section>`;
}

let colorTimer = 0;
function renderColorPreview(delay) {
  clearTimeout(colorTimer);
  colorTimer = setTimeout(() => {
    const box = $('#colorPreview');
    const p = currentProject();
    if (!box || !p) return;
    const st = S(), unit = +st.unitMM, H = +st.labelH;
    let rows = buildRows(p, st).slice(0, 2);
    if (!rows.length) rows = [{ cells: [{ w: 2, text: 'Γενικός διακόπτης', sym: 'main', rating: '40A' }, { w: 1, text: 'Φωτισμός', sym: 'light', rating: '10A' }, { w: 1, text: 'Πρίζες', sym: 'socket', rating: '16A' }].map(x => Object.assign(x, p.colors)) }];
    const width = Math.max(200, box.clientWidth - 28);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    box.innerHTML = '';
    rows.forEach(r => {
      // μόνο για ευανάγνωστη προεπισκόπηση: κομμάτια περίπου 3,2 px ανά mm
      const segs = splitCells(r.cells, unit, Math.max(unit * 2, width / 3.2));
      segs.forEach(seg => {
        const w = stripWidth(seg, unit);
        const pg = { w: w + 1, h: H + 1, els: [{ t: 'strip', x: 0.5, y: 0.5, cells: seg, h: H }] };
        const cssW = Math.min(width, (w + 1) * 3.2);
        const cv = renderPage(pg, Math.min(300, cssW * dpr / (pg.w / MM_PER_IN)), renderCtx(null), null);
        cv.style.width = cssW + 'px';
        box.appendChild(cv);
      });
    });
  }, delay || 0);
}

/* ================= Οθόνη: Εκτύπωση ================= */
function viewPrint() {
  const p = currentProject();
  const st = S();
  if (!p) return `<div class="panel empty-state"><h2>Δεν έχει ανοίξει έργο</h2><p>Ανοίξτε ένα έργο για να δείτε τις ετικέτες του.</p><a class="btn primary" href="#projects">Λίστα έργων</a></div>`;
  const roll = st.pageMode === 'roll';
  return `<div class="view-head"><div><div class="eyebrow">Εκτύπωση</div><h1>${esc(p.name)}</h1></div></div>
  <section class="panel">
    <div class="grid2">
      <label class="fld"><span>Μορφή χαρτιού</span><select id="sPage" data-sf="pageMode">
        <option value="a4l" ${st.pageMode === 'a4l' ? 'selected' : ''}>A4 οριζόντια (αυτοκόλλητο φύλλο)</option>
        <option value="a4p" ${st.pageMode === 'a4p' ? 'selected' : ''}>A4 κάθετη (αυτοκόλλητο φύλλο)</option>
        <option value="roll" ${roll ? 'selected' : ''}>Ρολό ετικετών / θερμικός εκτυπωτής</option></select></label>
      <label class="fld"><span>Ύψος ετικέτας (mm)</span><input id="sH" data-sf="labelH" type="number" inputmode="decimal" step="0.5" min="6" max="40" value="${st.labelH}"></label>
      <label class="fld"><span>Πλάτος μονάδας (mm)</span><input id="sU" data-sf="unitMM" type="number" inputmode="decimal" step="0.1" min="10" max="30" value="${st.unitMM}"></label>
      ${roll ? `<label class="fld"><span>Μέγιστο μήκος ετικέτας (mm)</span><input id="sRoll" data-sf="rollMax" type="number" inputmode="numeric" min="40" max="2000" value="${st.rollMax}"></label>` : ''}
    </div>
    <div class="grid2">
      <label class="check"><input type="checkbox" id="sFill" data-pf2="fillEmpty" ${p.fillEmpty ? 'checked' : ''}>Κενές θέσεις μέχρι το τέλος της σειράς</label>
      <label class="check"><input type="checkbox" id="sSym" data-sf="showSymbols" ${st.showSymbols ? 'checked' : ''}>Σύμβολα στις ετικέτες</label>
      ${!roll ? `<label class="check"><input type="checkbox" id="sCap" data-sf="showCaptions" ${st.showCaptions ? 'checked' : ''}>Τίτλος πάνω από κάθε λωρίδα</label>` : ''}
    </div>
    <div class="stat-line" id="printStats"></div>
    <div class="btn-row">
      <button class="btn primary" data-act="pdfLabels"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6zM14 2v6h6M9 14h6M9 18h4"/></svg>Δημιουργία PDF</button>
      <button class="btn" data-act="printLabels"><svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 17H3v-8h18v8h-3M6 14h12v7H6z"/></svg>Εκτύπωση</button>
      <button class="btn ghost" data-act="pdfCalib">Σελίδα δοκιμής διαστάσεων</button>
    </div>
    <p class="hint">Το κουμπί «Εκτύπωση» φτιάχνει το PDF και το ανοίγει για εκτύπωση: στο κινητό από το μενού κοινοποίησης («Εκτύπωση»), στον υπολογιστή σε νέα καρτέλα. Επιλέξτε κλίμακα <b>100%</b> / «Πραγματικό μέγεθος», όχι «Προσαρμογή στη σελίδα». Στην πρώτη χρήση τυπώστε τη σελίδα δοκιμής και μετρήστε με χάρακα. Η προεπισκόπηση στην οθόνη δεν αρκεί για έλεγχο διαστάσεων.${roll ? ' Για θερμικό εκτυπωτή: κάθε λωρίδα γίνεται ξεχωριστή σελίδα PDF στο ακριβές μέγεθός της. Ανοίξτε το PDF από την εφαρμογή του εκτυπωτή.' : ''}</p>
  </section>
  <section class="preview" id="preview" aria-label="Προεπισκόπηση σελίδων"><p class="hint">Φόρτωση προεπισκόπησης…</p></section>
  <section class="panel">
    <h2>Αυτοκόλλητο ηλεκτρολόγου</h2>
    <p class="hint">Τυπώνεται χωριστά από τις ετικέτες του πίνακα. Τα στοιχεία αλλάζουν στην καρτέλα «Στοιχεία».</p>
    <div class="grid2">
      <label class="fld"><span>Αντίτυπα</span><input id="sCopies" data-sf="stickerCopies" type="number" inputmode="numeric" min="1" max="200" value="${st.stickerCopies}"></label>
      <div class="fld"><span>Μέγεθος</span><span class="measure" style="min-height:48px;display:flex;align-items:center">${fmtMM(st.stickerW)} × ${fmtMM(st.stickerH)} mm</span></div>
    </div>
    <div class="btn-row">
      <button class="btn" data-act="pdfSticker">PDF αυτοκόλλητου</button>
      <button class="btn" data-act="printSticker">Εκτύπωση αυτοκόλλητου</button>
    </div>
  </section>`;
}

function schedulePreview(delay) {
  clearTimeout(UI.previewTimer);
  UI.previewTimer = setTimeout(renderPreview, delay == null ? 250 : delay);
}
function renderCtx(logo) { return { settings: S(), electrician: D().electrician, logo }; }

async function renderPreview() {
  const box = $('#preview');
  const p = currentProject();
  if (!box || !p) return;
  const st = S();
  const pages = layoutLabelPages(p, st);
  const stats = { overflow: 0 };
  const width = Math.max(240, box.clientWidth - 28);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const frag = document.createDocumentFragment();
  let totalStrips = 0;
  pages.forEach((pg, i) => {
    totalStrips += pg.els.filter(e => e.t === 'strip').length;
    let dpi = (width * dpr) / (pg.w / MM_PER_IN);
    if (st.pageMode === 'roll') dpi = Math.min(dpi, 220 * dpr);
    const cv = renderPage(pg, Math.min(dpi, 300), renderCtx(null), stats);
    if (st.pageMode === 'roll') { cv.classList.add('roll'); cv.style.width = Math.min(width, pg.w / MM_PER_IN * 96 * 1.4) + 'px'; }
    const cap = document.createElement('div');
    cap.className = 'pcap';
    cap.textContent = st.pageMode === 'roll' ? `Ετικέτα ${i + 1}/${pages.length} · ${fmtMM(pg.w)} × ${fmtMM(pg.h)} mm` : `Σελίδα ${i + 1}/${pages.length} · A4 ${st.pageMode === 'a4p' ? 'κάθετη' : 'οριζόντια'}`;
    frag.appendChild(cap);
    frag.appendChild(cv);
  });
  box.innerHTML = '';
  box.appendChild(frag);
  const statEl = $('#printStats');
  if (statEl) {
    statEl.innerHTML = `<span>Σελίδες: <b>${pages.length}</b></span><span>Λωρίδες: <b>${totalStrips}</b></span>
      <span>Μονάδα: <b>${fmtMM(+st.unitMM)} mm</b></span><span>Ύψος: <b>${fmtMM(+st.labelH)} mm</b></span>
      ${stats.overflow ? `<span style="color:var(--danger)"><b>${stats.overflow}</b> περιγραφές δεν χωρούν ολόκληρες. Μικρύνετε το κείμενο ή μεγαλώστε το ύψος.</span>` : ''}`;
  }
}

async function withBusy(label, fn) {
  if (UI.busy) return;
  UI.busy = true;
  toast(label);
  try { await fn(); }
  catch (e) { console.error(e); toast('Κάτι πήγε στραβά: ' + (e && e.message ? e.message : e), true); }
  finally { UI.busy = false; }
}

async function makePdf(pages, filename, needLogo) {
  const logo = needLogo ? await loadImage(D().electrician.logo) : null;
  const ctx = renderCtx(logo);
  const blob = await buildPdf(pages, async pg => renderPage(pg, 300, ctx, null));
  await deliverFile(blob, filename);
  toast('Το PDF δημιουργήθηκε');
}

/* Εκτύπωση: φτιάχνει το ίδιο PDF με το κουμπί PDF (ίδιες διαστάσεις, ίδια εμφάνιση).
 * Κινητό: ανοίγει το μενού κοινοποίησης, όπου υπάρχει «Εκτύπωση».
 * Υπολογιστής: ανοίγει το PDF σε νέα καρτέλα, για εκτύπωση από εκεί σε «Πραγματικό μέγεθος».
 * Δεν χρησιμοποιείται window.print(), που στα κινητά συχνά δεν ανοίγει ή παγώνει την εφαρμογή. */
function openPrintWindow() {
  if (isTouch()) return null;
  let w = null;
  try { w = window.open('', '_blank'); } catch (e) { w = null; }
  if (w) {
    try {
      w.document.title = 'PanelLabels — εκτύπωση';
      w.document.body.style.cssText = 'font:16px system-ui,sans-serif;padding:24px;color:#333';
      w.document.body.textContent = 'Ετοιμάζεται το PDF για εκτύπωση…';
    } catch (e) { }
  }
  return w;
}
async function printPdf(pages, filename, needLogo, win) {
  const logo = needLogo ? await loadImage(D().electrician.logo) : null;
  const ctx = renderCtx(logo);
  let blob;
  try { blob = await buildPdf(pages, async pg => renderPage(pg, 300, ctx, null)); }
  catch (e) { if (win) try { win.close(); } catch (x) { } throw e; }
  if (win && !win.closed) {
    const url = URL.createObjectURL(blob);
    win.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60000);
    toast('Το PDF άνοιξε σε νέα καρτέλα. Τυπώστε σε «Πραγματικό μέγεθος» / 100%.');
    return;
  }
  const res = await deliverFile(blob, filename, 'Στο μενού που θα ανοίξει επιλέξτε «Εκτύπωση».');
  if (res === 'shared') toast('Επιλέξτε «Εκτύπωση» στο μενού κοινοποίησης');
  else if (res === 'downloaded') toast('Το PDF κατέβηκε. Ανοίξτε το και τυπώστε σε 100%.');
}

/* ================= Οθόνη: Στοιχεία ηλεκτρολόγου ================= */
function viewInfo() {
  const e = D().electrician, st = S();
  return `<div class="view-head"><div><div class="eyebrow">Στοιχεία</div><h1>Ο ηλεκτρολόγος</h1></div></div>
  <p class="lead">Αποθηκεύονται μία φορά και χρησιμοποιούνται σε όλα τα έργα, στο αυτοκόλλητο που κολλάτε στον πίνακα.</p>
  <section class="panel">
    <div class="grid2">
      <label class="fld"><span>Ονοματεπώνυμο ή επωνυμία</span><input id="eName" data-ef="name" value="${esc(e.name)}" autocomplete="organization"></label>
      <label class="fld"><span>Τηλέφωνο</span><input id="ePhone" data-ef="phone" value="${esc(e.phone)}" inputmode="tel" autocomplete="tel"></label>
      <label class="fld"><span>Email</span><input id="eEmail" data-ef="email" value="${esc(e.email)}" inputmode="email" autocomplete="email"></label>
    </div>
    <label class="fld"><span>Άλλα στοιχεία (προαιρετικά)</span><textarea id="eExtra" data-ef="extra" rows="2" placeholder="π.χ. Αρ. άδειας, ιστοσελίδα, διεύθυνση">${esc(e.extra)}</textarea></label>
    <div class="fld"><span>Λογότυπο επιχείρησης</span>
      <div class="logo-box">
        <div class="logo-thumb">${e.logo ? `<img src="${e.logo}" alt="Λογότυπο">` : 'Χωρίς'}</div>
        <label class="btn file-btn">${e.logo ? 'Αλλαγή εικόνας' : 'Επιλογή εικόνας'}<input type="file" id="eLogo" accept="image/*"></label>
        ${e.logo ? '<button class="btn ghost danger" data-act="delLogo">Αφαίρεση</button>' : ''}
      </div></div>
  </section>
  <section class="panel">
    <h2>Αυτοκόλλητο</h2>
    <div class="grid2">
      <label class="fld"><span>Πλάτος (mm)</span><input id="eW" data-sf="stickerW" type="number" inputmode="decimal" min="20" max="200" value="${st.stickerW}"></label>
      <label class="fld"><span>Ύψος (mm)</span><input id="eH" data-sf="stickerH" type="number" inputmode="decimal" min="10" max="150" value="${st.stickerH}"></label>
    </div>
    ${colorPicker('sticker', 'bg', e.bg, BG_SWATCH, 'Φόντο αυτοκόλλητου')}
    <div class="preview" id="stickerPreview"></div>
    <div class="btn-row"><button class="btn primary" data-act="pdfSticker">PDF αυτοκόλλητου</button><button class="btn" data-act="printSticker">Εκτύπωση αυτοκόλλητου</button></div>
  </section>`;
}

let stickerTimer = 0;
function renderStickerPreview(delay) {
  clearTimeout(stickerTimer);
  stickerTimer = setTimeout(async () => {
    const box = $('#stickerPreview');
    if (!box) return;
    const st = S();
    const logo = await loadImage(D().electrician.logo);
    const pg = { w: +st.stickerW, h: +st.stickerH, els: [{ t: 'sticker', x: 0, y: 0, w: +st.stickerW, h: +st.stickerH }] };
    const width = Math.min(box.clientWidth - 28, 520);
    const dpi = Math.min(300, (width * (window.devicePixelRatio || 1)) / (pg.w / MM_PER_IN));
    const cv = renderPage(pg, dpi, renderCtx(logo), null);
    cv.style.width = width + 'px';
    box.innerHTML = '';
    box.appendChild(cv);
  }, delay || 0);
}

function readLogo(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Επιλέξτε αρχείο εικόνας (PNG ή JPG).'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Η εικόνα δεν διαβάστηκε.'));
    fr.onload = async () => {
      const im = await loadImage(fr.result);
      if (!im) return reject(new Error('Η εικόνα δεν αναγνωρίστηκε.'));
      const max = 600;
      const k = Math.min(1, max / Math.max(im.width, im.height));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(im.width * k));
      cv.height = Math.max(1, Math.round(im.height * k));
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL('image/png'));
    };
    fr.readAsDataURL(file);
  });
}

/* ================= Οθόνη: Αντίγραφα ================= */
function viewBackup() {
  const d = D();
  let used = 0;
  try { used = (localStorage.getItem(STORE_KEY) || '').length * 2; } catch (e) { }
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `<div class="view-head"><div><div class="eyebrow">Αντίγραφα ασφαλείας</div><h1>Τα δεδομένα σας</h1></div></div>
  <div class="notice err"><p><b>Σημαντικό:</b> Τα έργα αποθηκεύονται μόνο σε αυτή τη συσκευή, μέσα στον browser. Αν διαγράψετε τα δεδομένα του browser (ιστορικό, cookies, δεδομένα ιστοτόπων) ή απεγκαταστήσετε την εφαρμογή, τα έργα χάνονται, εκτός αν έχετε αντίγραφο ασφαλείας.</p></div>
  <section class="panel">
    <h2>Εξαγωγή</h2>
    <p class="hint">Δημιουργεί ένα αρχείο με όλα τα έργα, τα στοιχεία ηλεκτρολόγου και τις ρυθμίσεις. Κρατήστε το σε email, Google Drive, iCloud ή υπολογιστή.</p>
    <dl class="kv"><dt>Έργα</dt><dd>${d.projects.length}</dd><dt>Τελευταίο αντίγραφο</dt><dd>${fmtDate(d.lastBackup)}</dd><dt>Χώρος σε χρήση</dt><dd>${(used / 1024).toFixed(0)} KB</dd></dl>
    <div class="btn-row"><button class="btn primary" data-act="exportBackup"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 17v4h16v-4"/></svg>Εξαγωγή αντιγράφου</button></div>
  </section>
  <section class="panel">
    <h2>Επαναφορά</h2>
    <p class="hint">Επιλέξτε αρχείο αντιγράφου PanelLabels (.json). Θα ερωτηθείτε αν θα προστεθεί στα υπάρχοντα έργα ή θα τα αντικαταστήσει.</p>
    <div class="btn-row"><label class="btn file-btn">Επιλογή αρχείου αντιγράφου<input type="file" id="importFile" accept=".json,application/json"></label></div>
  </section>
  <section class="panel">
    <h2>Εικονίδιο στην αρχική οθόνη</h2>
    ${installed ? '<p class="hint">Η εφαρμογή είναι ήδη εγκατεστημένη σε αυτή τη συσκευή.</p>' : `
    ${UI.installEvt ? '<div class="btn-row"><button class="btn primary" data-act="install">Εγκατάσταση εφαρμογής</button></div>' : ''}
    <ol class="steps">
      <li><b>iPhone (Safari):</b> πατήστε το κουμπί Κοινοποίηση και μετά «Προσθήκη στην οθόνη Αφετηρίας».</li>
      <li><b>Android (Chrome):</b> πατήστε τις τρεις τελείες πάνω δεξιά και μετά «Εγκατάσταση εφαρμογής» ή «Προσθήκη στην αρχική οθόνη».</li>
      <li><b>Υπολογιστής (Chrome/Edge):</b> πατήστε το εικονίδιο εγκατάστασης στη γραμμή διευθύνσεων.</li>
    </ol>`}
    <p class="hint">Μετά την εγκατάσταση η εφαρμογή ανοίγει με το λογότυπο και δουλεύει και χωρίς internet.</p>
  </section>
  <p class="hint">PanelLabels έκδοση ${APP_VERSION}</p>`;
}

function exportBackup() {
  const d = D();
  const payload = { app: 'PanelLabels', schema: 1, version: APP_VERSION, exportedAt: new Date().toISOString(),
    data: { projects: d.projects, electrician: d.electrician, settings: d.settings } };
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
  const day = new Date().toISOString().slice(0, 10);
  d.lastBackup = Date.now();
  commit({ noTouch: true });
  deliverFile(blob, `PanelLabels-αντίγραφο-${day}.json`).then(() => { toast('Το αντίγραφο δημιουργήθηκε'); if (UI.view === 'backup' || UI.view === 'projects') render(); });
}

async function importBackup(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); }
  catch (e) { return toast('Το αρχείο δεν είναι έγκυρο αντίγραφο PanelLabels.', true); }
  const src = obj && obj.app === 'PanelLabels' && obj.data ? obj.data : (obj && Array.isArray(obj.projects) ? obj : null);
  if (!src) return toast('Το αρχείο δεν είναι αντίγραφο PanelLabels.', true);
  const incoming = normalize(src);
  const choice = await dialog({
    title: 'Επαναφορά αντιγράφου',
    text: `Το αρχείο περιέχει ${incoming.projects.length} έργα. Τι θέλετε να γίνει με τα ${D().projects.length} έργα της συσκευής;`,
    choices: [{ label: 'Άκυρο', cls: 'ghost' }, { label: 'Αντικατάσταση όλων', cls: 'danger' }, { label: 'Προσθήκη', cls: 'primary' }]
  });
  if (choice == null || choice === 0) return;
  const d = D();
  if (choice === 1) {
    const ok = await dialog({ title: 'Αντικατάσταση όλων;', text: 'Τα τωρινά έργα της συσκευής θα διαγραφούν και θα μπουν αυτά του αρχείου.', ok: 'Αντικατάσταση', danger: true });
    if (!ok) return;
    d.projects = incoming.projects;
    d.electrician = incoming.electrician;
    d.settings = incoming.settings;
    d.lastProjectId = d.projects[0] ? d.projects[0].id : null;
  } else {
    let added = 0, updated = 0;
    incoming.projects.forEach(ip => {
      const ex = d.projects.findIndex(p => p.id === ip.id);
      if (ex < 0) { d.projects.push(ip); added++; }
      else if (ip.updatedAt > d.projects[ex].updatedAt) { d.projects[ex] = ip; updated++; }
    });
    if (!d.electrician.name && incoming.electrician.name) d.electrician = incoming.electrician;
    toast(`Προστέθηκαν ${added} έργα${updated ? `, ενημερώθηκαν ${updated}` : ''}`);
  }
  commit({ noTouch: true });
  if (choice === 1) toast('Η επαναφορά ολοκληρώθηκε');
  go('projects');
}

/* ================= Ενέργειες ================= */
async function newProject() {
  const n = D().projects.filter(p => !p.sample).length + 1;
  const name = await dialog({ title: 'Νέο έργο', input: { label: 'Όνομα έργου', value: `Πίνακας ${n}` }, ok: 'Δημιουργία' });
  if (name == null) return;
  const p = normProject({ name: name || `Πίνακας ${n}`, modulesPerRow: 12, rows: [{ name: '' }] });
  D().projects.push(p);
  D().lastProjectId = p.id;
  commit();
  go('editor');
}

const actions = {
  newProject,
  openProject: el => { D().lastProjectId = el.dataset.id; commit({ noTouch: true }); go('editor'); },
  dupProject: el => {
    const src = D().projects.find(p => p.id === el.dataset.id);
    if (!src) return;
    const copy = normProject(JSON.parse(JSON.stringify(src)));
    copy.id = uid(); copy.name = src.name + ' (αντίγραφο)'; copy.sample = false; copy.createdAt = copy.updatedAt = Date.now();
    copy.rows.forEach(r => { r.id = uid(); r.items.forEach(i => { i.id = uid(); }); });
    D().projects.push(copy);
    commit({ noTouch: true });
    render();
    toast('Το έργο αντιγράφηκε');
  },
  delProject: async el => {
    const p = D().projects.find(x => x.id === el.dataset.id);
    if (!p) return;
    const ok = await dialog({ title: 'Διαγραφή έργου;', text: `Το έργο «${p.name}» θα διαγραφεί οριστικά από αυτή τη συσκευή.`, ok: 'Διαγραφή', danger: true });
    if (!ok) return;
    D().projects = D().projects.filter(x => x.id !== p.id);
    if (D().lastProjectId === p.id) D().lastProjectId = null;
    commit({ noTouch: true });
    render();
    toast('Το έργο διαγράφηκε');
  },
  saveNow: () => { commit(); toast('Αποθηκεύτηκε'); },
  addRow: () => {
    const p = currentProject();
    p.rows.push(normRow({ name: '' }));
    commit();
    rerenderRows();
    const cards = document.querySelectorAll('.row-card');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
  },
  rowUp: el => moveRow(el.dataset.row, -1),
  rowDown: el => moveRow(el.dataset.row, 1),
  rowDel: async el => {
    const p = currentProject();
    const ri = p.rows.findIndex(r => r.id === el.dataset.row);
    if (ri < 0) return;
    const r = p.rows[ri];
    if (r.items.length) {
      const ok = await dialog({ title: `Διαγραφή σειράς ${ri + 1};`, text: `Η σειρά έχει ${r.items.length} στοιχεία που θα διαγραφούν.`, ok: 'Διαγραφή', danger: true });
      if (!ok) return;
    }
    p.rows.splice(ri, 1);
    commit();
    rerenderRows();
  },
  addItem: el => {
    const p = currentProject();
    const r = p.rows.find(x => x.id === el.dataset.row);
    if (!r) return;
    if (rowFree(p, r) < 1) return toast(fullMsg(p, r), true);
    const it = normItem({ w: 1 });
    r.items.push(it);
    commit();
    openSheet(it.id, true);
  },
  editItem: el => openSheet(el.dataset.id, false),
  closeSheet: () => closeSheet(),
  suggest: el => {
    const c = sheetCtx(); if (!c) return;
    c.f.item.text = el.dataset.text;
    if (!c.f.item.sym && SUGGEST_SYM[el.dataset.text]) c.f.item.sym = SUGGEST_SYM[el.dataset.text];
    commit();
    reopenSheet();
  },
  setW: el => {
    const c = sheetCtx(); if (!c) return;
    const w = +el.dataset.w;
    if (w > rowFree(c.p, c.f.row, c.f.item)) return toast(fullMsg(c.p, c.f.row), true);
    c.f.item.w = w;
    commit();
    reopenSheet();
    return;
    document.querySelectorAll('#wChips .chip').forEach(b => b.classList.toggle('on', +b.dataset.w === c.f.item.w));
    $('#wMM').textContent = fmtMM(c.f.item.w * S().unitMM) + ' mm';
    rerenderRows();
  },
  setSym: el => {
    const c = sheetCtx(); if (!c) return;
    c.f.item.sym = el.dataset.sym;
    commit();
    document.querySelectorAll('#symGrid .sym-btn').forEach(b => b.classList.toggle('on', b.dataset.sym === c.f.item.sym));
    rerenderRows();
  },
  pickColor: el => applyColor(el.dataset.g, el.dataset.k, el.dataset.c),
  colorsReset: () => {
    const p = currentProject(); if (!p) return;
    p.colors = normColors(null);
    commit();
    render();
    toast('Επαναφορά σε λευκό φόντο και μαύρα στοιχεία');
  },
  mvLeft: () => moveItem(-1), mvRight: () => moveItem(1),
  mvUpRow: () => moveItemRow(-1), mvDownRow: () => moveItemRow(1),
  dupItem: () => {
    const c = sheetCtx(); if (!c) return;
    if (rowFree(c.p, c.f.row) < c.f.item.w) return toast(fullMsg(c.p, c.f.row), true);
    const copy = normItem(Object.assign({}, c.f.item, { id: uid() }));
    c.f.row.items.splice(c.f.ii + 1, 0, copy);
    commit();
    openSheet(copy.id, false);
    toast('Δημιουργήθηκε διπλότυπο');
  },
  delItem: async () => {
    const c = sheetCtx(); if (!c) return;
    const label = c.f.item.text.trim() ? `«${c.f.item.text.trim()}»` : 'το στοιχείο';
    const ok = await dialog({ title: 'Διαγραφή στοιχείου;', text: `Θα διαγραφεί ${label}.`, ok: 'Διαγραφή', danger: true });
    if (!ok) return;
    c.f.row.items.splice(c.f.ii, 1);
    commit();
    closeSheet();
  },
  pdfLabels: () => withBusy('Δημιουργία PDF…', () => {
    const p = currentProject();
    return makePdf(layoutLabelPages(p, S()), `${safeName(p.name)}-ετικέτες.pdf`, false);
  }),
  printLabels: () => {
    if (UI.busy) return;
    const win = openPrintWindow();
    const p = currentProject();
    return withBusy('Προετοιμασία εκτύπωσης…', () => printPdf(layoutLabelPages(p, S()), `${safeName(p.name)}-ετικέτες.pdf`, false, win));
  },
  pdfCalib: () => withBusy('Δημιουργία σελίδας δοκιμής…', () => makePdf(layoutCalibration(S()), 'PanelLabels-δοκιμή-διαστάσεων.pdf', false)),
  pdfSticker: () => withBusy('Δημιουργία PDF…', () => makePdf(layoutStickerPages(S()), 'PanelLabels-αυτοκόλλητο.pdf', true)),
  printSticker: () => {
    if (UI.busy) return;
    const win = openPrintWindow();
    return withBusy('Προετοιμασία εκτύπωσης…', () => printPdf(layoutStickerPages(S()), 'PanelLabels-αυτοκόλλητο.pdf', true, win));
  },
  delLogo: () => { D().electrician.logo = ''; commit({ noTouch: true }); render(); },
  exportBackup,
  install: async () => {
    if (!UI.installEvt) return;
    UI.installEvt.prompt();
    try { await UI.installEvt.userChoice; } catch (e) { }
    UI.installEvt = null;
    render();
  }
};

function moveRow(rowId, dir) {
  const p = currentProject();
  const i = p.rows.findIndex(r => r.id === rowId), j = i + dir;
  if (i < 0 || j < 0 || j >= p.rows.length) return;
  [p.rows[i], p.rows[j]] = [p.rows[j], p.rows[i]];
  commit();
  rerenderRows();
}
function moveItem(dir) {
  const c = sheetCtx(); if (!c) return;
  const items = c.f.row.items, i = c.f.ii, j = i + dir;
  if (j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  commit();
  reopenSheet();
}
function moveItemRow(dir) {
  const c = sheetCtx(); if (!c) return;
  const target = c.p.rows[c.f.ri + dir];
  if (!target) return;
  if (rowFree(c.p, target) < c.f.item.w) return toast(fullMsg(c.p, target), true);
  c.f.row.items.splice(c.f.ii, 1);
  target.items.push(c.f.item);
  commit();
  reopenSheet();
}

/* ================= Συμβάντα ================= */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el); }
});

$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden && $('#modal').hidden) closeSheet(); });

document.addEventListener('input', e => {
  const t = e.target;
  const p = currentProject();
  if (t.id === 'itText' || t.id === 'itRating') {
    const c = sheetCtx(); if (!c) return;
    if (t.id === 'itText') c.f.item.text = t.value; else c.f.item.rating = t.value;
    commit({ debounce: true });
    rerenderRows();
    return;
  }
  if (t.dataset.pickg) {
    if (isHex(t.value)) applyColor(t.dataset.pickg, t.dataset.pickk, t.value.toLowerCase(), t);
    return;
  }
  if (t.dataset.pf && p) {
    if (t.dataset.pf === 'modulesPerRow') return; // εφαρμόζεται στο change
    p[t.dataset.pf] = t.value;
    if (t.dataset.pf === 'name') $('#topProject').textContent = t.value || 'Χωρίς όνομα';
    if (p.sample && t.dataset.pf === 'name') p.sample = false;
    commit({ debounce: true });
    return;
  }
  if (t.dataset.rf && p) {
    const r = p.rows.find(x => x.id === t.dataset.row);
    if (r) { r.name = t.value; commit({ debounce: true }); }
    return;
  }
  if (t.dataset.ef) {
    D().electrician[t.dataset.ef] = t.value;
    commit({ debounce: true, noTouch: true });
    renderStickerPreview(200);
  }
});

document.addEventListener('change', async e => {
  const t = e.target;
  const p = currentProject();
  if (t.dataset.pf === 'modulesPerRow' && p) {
    const want = clamp(Math.round(num(t.value, 0)), 0, 96);
    const bad = want ? p.rows.findIndex(r => rowUnits(r) > want) : -1;
    if (bad >= 0) {
      t.value = p.modulesPerRow;
      return toast(`Η σειρά ${bad + 1} έχει ήδη ${fmtUnits(rowUnits(p.rows[bad]))} μονάδες. Αφαιρέστε ή μικρύνετε στοιχεία πριν μειώσετε τις θέσεις σε ${want}.`, true);
    }
    p.modulesPerRow = want;
    t.value = p.modulesPerRow;
    commit();
    rerenderRows();
    return;
  }
  if (t.dataset.pf === 'name' && p && !t.value.trim()) { p.name = 'Χωρίς όνομα'; t.value = p.name; commit(); }
  if (t.dataset.pf2 === 'fillEmpty' && p) { p.fillEmpty = t.checked; commit(); schedulePreview(); return; }
  if (t.dataset.sf) {
    const st = S(), k = t.dataset.sf;
    if (t.type === 'checkbox') st[k] = t.checked;
    else if (k === 'pageMode') st[k] = t.value;
    else st[k] = num(t.value, DEFAULT_SETTINGS[k]);
    Store.data = normalize(Store.data); // επιβολή ορίων
    t.type !== 'checkbox' && k !== 'pageMode' && (t.value = S()[k]);
    commit({ noTouch: true });
    if (UI.view === 'print') { if (k === 'pageMode') render(); else schedulePreview(); }
    if (UI.view === 'info') renderStickerPreview();
    return;
  }
  if (t.id === 'eLogo' && t.files && t.files[0]) {
    try { D().electrician.logo = await readLogo(t.files[0]); commit({ noTouch: true }); render(); toast('Το λογότυπο αποθηκεύτηκε'); }
    catch (err) { toast(err.message, true); }
    return;
  }
  if (t.id === 'importFile' && t.files && t.files[0]) { await importBackup(t.files[0]); t.value = ''; }
});

window.addEventListener('hashchange', route);
window.addEventListener('resize', () => { if (UI.view === 'print') schedulePreview(300); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); UI.installEvt = e; if (UI.view === 'backup') render(); });
window.addEventListener('pagehide', () => { clearTimeout(saveTimer); Store.save(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Store.save(); });

/* ================= Εκκίνηση ================= */
(function init() {
  Store.load();
  const d = D();
  if (!d.initialized) {
    if (!d.projects.length) { const sp = sampleProject(); d.projects.push(sp); d.lastProjectId = sp.id; }
    d.initialized = true;
    Store.save();
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
  route();
})();
