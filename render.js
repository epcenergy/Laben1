/* PanelLabels — render.js
 * Σχεδίαση ετικετών σε πραγματικά χιλιοστά (canvas) και δημιουργία PDF χωρίς εξωτερικές βιβλιοθήκες.
 * Όλες οι διαστάσεις είναι σε mm. Το s = pixels ανά mm για το συγκεκριμένο render.
 */
'use strict';

const LABEL_FONT = 'Arial, "Helvetica Neue", Helvetica, Roboto, "Segoe UI", sans-serif';
const MM_PER_IN = 25.4;

/* Σύμβολα: διαδρομές SVG σε πλαίσιο 24x24, σχεδιασμένες με γραμμή (stroke). */
const SYMBOLS = {
  main:   { name: 'Γενικός διακόπτης', d: 'M12 2.5v6M12 15.5v6M12 15.5L7 7.5M9.6 5.2h4.8M8 21.5h8' },
  rcd:    { name: 'Ρελέ διαρροής', d: 'M12 4.5l7.5 13h-15zM4 21h16M12 9.5v4.5' },
  light:  { name: 'Φωτισμός', d: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1V17h5v-1.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z' },
  socket: { name: 'Πρίζα', d: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM8.2 12h.1M15.7 12h.1M12 4.5v2M12 17.5v2' },
  heater: { name: 'Θερμοσίφωνας', d: 'M8 2.5h8a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5H8A2.5 2.5 0 0 1 5.5 19V5A2.5 2.5 0 0 1 8 2.5zM9 10c1-1 2-1 3 0s2 1 3 0M9 14.5c1-1 2-1 3 0s2 1 3 0' },
  ac:     { name: 'Κλιματιστικό', d: 'M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.3 4.2L12 6l2.7-1.8M9.3 19.8L12 18l2.7 1.8' },
  washer: { name: 'Πλυντήριο', d: 'M5.5 2.5h13a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1zM12 8.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9zM7.5 5.5h1M10.5 5.5h1' },
  cooker: { name: 'Κουζίνα / φούρνος', d: 'M4.5 3h15v18h-15zM4.5 12h15M7.5 7.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0zM13.5 7.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0zM8 15.5h8' },
  motor:  { name: 'Μοτέρ / αντλία', d: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17zM8.5 15.5v-7l3.5 4 3.5-4v7' },
  ev:     { name: 'Φορτιστής οχήματος', d: 'M13 2.5L6 13.5h5.5L10.5 21.5 18 10h-5.5z' },
  outdoor:{ name: 'Εξωτερικός χώρος', d: 'M3 11.5L12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5h4v5' },
  bell:   { name: 'Κουδούνι / θυροτηλέφωνο', d: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 21h4' }
};

const _pathCache = {};
function symPath(key) {
  if (!SYMBOLS[key]) return null;
  if (!_pathCache[key]) _pathCache[key] = new Path2D(SYMBOLS[key].d);
  return _pathCache[key];
}
function symSvg(key, cls) {
  if (!SYMBOLS[key]) return '';
  return `<svg class="${cls || 'sym'}" viewBox="0 0 24 24" aria-hidden="true"><path d="${SYMBOLS[key].d}"/></svg>`;
}

/* ---------- Κείμενο ---------- */
function wrapText(ctx, text, maxPx) {
  const out = [];
  String(text).split(/\n/).forEach(par => {
    const words = par.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); return; }
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxPx) { line = test; continue; }
      if (line) out.push(line);
      if (ctx.measureText(word).width <= maxPx) { line = word; continue; }
      // λέξη μεγαλύτερη από το πλάτος: σπάσιμο ανά χαρακτήρα
      let part = '';
      for (const ch of word) {
        if (ctx.measureText(part + ch).width > maxPx && part) { out.push(part); part = ch; }
        else part += ch;
      }
      line = part;
    }
    out.push(line);
  });
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out;
}

/* Βρίσκει το μεγαλύτερο μέγεθος γραμματοσειράς (mm) που χωράει σε maxW x maxH (mm). */
/* Όλες οι μετρήσεις κειμένου γίνονται σε σταθερή κλίμακα (REF_S pixel/mm) σε ξεχωριστό canvas,
 * ώστε η αναδίπλωση και το μέγεθος να είναι ίδια σε προεπισκόπηση, PDF και εκτύπωση, όποια κι αν είναι η ανάλυση. */
const REF_S = 24;
let _mctx = null;
function measureCtx() {
  if (!_mctx) _mctx = document.createElement('canvas').getContext('2d');
  return _mctx;
}
const _fitCache = new Map();
function fitText(ctx, s, text, maxW, maxH, maxF, minF, weight) {
  weight = weight || 700;
  const key = [text, maxW.toFixed(3), maxH.toFixed(3), maxF.toFixed(2), minF.toFixed(2), weight].join('\u0001');
  const hit = _fitCache.get(key);
  if (hit) return hit;
  const m = measureCtx();
  let res = null;
  for (let f = maxF; f >= minF - 1e-6; f -= 0.1) {
    m.font = `${weight} ${(f * REF_S).toFixed(2)}px ${LABEL_FONT}`;
    const lines = wrapText(m, text, maxW * REF_S);
    const lh = f * 1.13;
    if (lines.length * lh <= maxH + 1e-6) { res = { f, lines, lh, overflow: false }; break; }
  }
  if (!res) {
    m.font = `${weight} ${(minF * REF_S).toFixed(2)}px ${LABEL_FONT}`;
    const lh = minF * 1.13;
    const maxLines = Math.max(1, Math.floor(maxH / lh));
    let lines = wrapText(m, text, maxW * REF_S);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1];
      while (last.length && m.measureText(last + '…').width > maxW * REF_S) last = last.slice(0, -1);
      lines[maxLines - 1] = last + '…';
    }
    res = { f: minF, lines, lh, overflow: true };
  }
  if (_fitCache.size > 4000) _fitCache.clear();
  _fitCache.set(key, res);
  return res;
}
/* Αναδίπλωση σε σταθερή κλίμακα για ελεύθερο κείμενο (αυτοκόλλητο). */
function wrapFixed(text, fontMM, weight, maxW) {
  const m = measureCtx();
  m.font = `${weight} ${(fontMM * REF_S).toFixed(2)}px ${LABEL_FONT}`;
  return wrapText(m, text, maxW * REF_S);
}

function drawLines(ctx, s, fit, cx, top, weight) {
  ctx.font = `${weight || 700} ${(fit.f * s).toFixed(2)}px ${LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fit.lines.forEach((ln, i) => ctx.fillText(ln, cx * s, (top + fit.lh * (i + 0.5)) * s));
}

/* ---------- Κελί ετικέτας ---------- */
function drawCell(ctx, s, x, y, w, h, c, stats, capF, measureOnly) {
  const pad = Math.min(1, w * 0.06);
  const iw = w - pad * 2;
  let top = y + pad, bottom = y + h - pad;
  const cx = x + w / 2;
  const fg = c.fg || '#000', sc = c.sc || '#000';
  ctx.fillStyle = fg;
  ctx.strokeStyle = sc;

  if (c.rating) {
    const fr = fitText(ctx, s, c.rating, iw, Math.min(2.4, h * 0.18), Math.max(1.2, Math.min(2.2, h * 0.17, capF && capF < 99 ? capF : 99)), 1.2, 700);
    const rh = fr.lh * fr.lines.length;
    if (!measureOnly) { ctx.fillStyle = fg; drawLines(ctx, s, fr, cx, bottom - rh, 700); }
    bottom -= rh + 0.3;
  }

  const hasText = c.text && c.text.trim();
  const sym = c.sym && symPath(c.sym);
  if (sym) {
    const ss = Math.max(2, Math.min(hasText ? Math.min((bottom - top) * 0.36, 5) : (bottom - top), iw, 8));
    const sy = hasText ? top : top + ((bottom - top) - ss) / 2;
    if (!measureOnly) {
    ctx.save();
    ctx.translate((cx - ss / 2) * s, sy * s);
    ctx.scale((ss * s) / 24, (ss * s) / 24);
    ctx.lineWidth = 1.9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = sc;
    ctx.stroke(sym);
    ctx.restore();
    }
    top = sy + ss + 0.3;
  }

  if (hasText) {
    const avail = bottom - top;
    if (avail < 1) { if (stats && !measureOnly) stats.overflow++; return measureOnly ? 1.2 : undefined; }
    const fit = fitText(ctx, s, c.text, iw, avail, Math.min(capF || 99, 4.2, h * 0.3), 1.2, 700);
    if (measureOnly) return fit.f;
    if (fit.overflow && stats) stats.overflow++;
    const th = fit.lh * fit.lines.length;
    if (stats && stats.lines) stats.lines.push(fit.lines.join('|') + '@' + fit.f.toFixed(1));
    ctx.fillStyle = fg;
    drawLines(ctx, s, fit, cx, top + (avail - th) / 2, 700);
  }
}

/* ---------- Λωρίδα (μία σειρά ή τμήμα σειράς) ---------- */
function stripWidth(cells, unit) { return cells.reduce((a, c) => a + c.w * unit, 0); }

function drawStrip(ctx, s, x, y, cells, h, unit, stats) {
  const total = stripWidth(cells, unit);
  // ενιαίο μέγεθος γραμμάτων σε όλη τη λωρίδα (το μικρότερο που χωράει παντού)
  let capF = 99;
  let mx = x;
  cells.forEach(c => {
    if (!c.blank && c.text && c.text.trim()) { const f = drawCell(ctx, s, mx, y, c.w * unit, h, c, null, 99, true); if (f) capF = Math.min(capF, f); }
    mx += c.w * unit;
  });
  // 1. φόντα
  // κάτω όριο: ένα κελί με πολύ κείμενο δεν μικραίνει όλη τη λωρίδα (μικραίνει μόνο το ίδιο)
  capF = Math.max(capF, Math.min(2.0, h * 0.17));
  let cx = x;
  cells.forEach(c => {
    const cw = c.w * unit;
    if (!c.blank && c.bg && c.bg !== '#ffffff') { ctx.fillStyle = c.bg; ctx.fillRect(cx * s, y * s, cw * s, h * s); }
    cx += cw;
  });
  // 2. διαχωριστικά: ανάμεσα σε κενές θέσεις γκρι, αλλιώς στο χρώμα περιγράμματος
  const bcol = (cells.find(c => !c.blank) || {}).bc || '#000';
  cx = x;
  ctx.lineWidth = Math.max(1, 0.18 * s);
  cells.forEach((c, i) => {
    cx += c.w * unit;
    if (i === cells.length - 1) return;
    ctx.strokeStyle = (c.blank && cells[i + 1].blank) ? '#b5b5b5' : bcol;
    ctx.beginPath(); ctx.moveTo(cx * s, y * s); ctx.lineTo(cx * s, (y + h) * s); ctx.stroke();
  });
  // 3. εξωτερικό περίγραμμα (γραμμή κοπής)
  ctx.strokeStyle = bcol;
  ctx.lineWidth = Math.max(1, 0.25 * s);
  ctx.strokeRect(x * s, y * s, total * s, h * s);
  // 4. περιεχόμενο
  cx = x;
  cells.forEach(c => {
    const cw = c.w * unit;
    if (!c.blank) drawCell(ctx, s, cx, y, cw, h, c, stats, capF);
    cx += cw;
  });
}

/* ---------- Δεδομένα έργου → κελιά ---------- */
function rowUnits(row) { return row.items.reduce((a, i) => a + i.w, 0); }

function buildRows(project, settings) {
  const col = project.colors || { bg: '#ffffff', fg: '#000000', sc: '#000000', bc: '#000000' };
  return project.rows.map((r, ri) => {
    const cells = r.items.map(i => ({
      w: i.w, text: i.text, rating: i.rating,
      sym: settings.showSymbols ? i.sym : '',
      bg: col.bg, fg: col.fg, sc: col.sc, bc: col.bc
    }));
    const cap = +project.modulesPerRow || 0;
    if (project.fillEmpty && cap > 0) {
      let rem = Math.round((cap - rowUnits(r)) * 2) / 2;
      while (rem >= 1) { cells.push({ w: 1, blank: true }); rem -= 1; }
      if (rem > 0) cells.push({ w: rem, blank: true });
    }
    return { title: r.name || `Σειρά ${ri + 1}`, cells };
  }).filter(r => r.cells.length);
}

function splitCells(cells, unit, maxW) {
  const segs = [];
  let cur = [], w = 0;
  for (const c of cells) {
    const cw = c.w * unit;
    if (cur.length && w + cw > maxW + 0.001) { segs.push(cur); cur = []; w = 0; }
    cur.push(c); w += cw;
  }
  if (cur.length) segs.push(cur);
  return segs;
}

function fmtMM(v) { return (Math.round(v * 10) / 10).toString().replace('.', ','); }
function fmtUnits(v) { return v.toString().replace('.', ','); }

/* Διάταξη σελίδων ετικετών. Επιστρέφει [{w,h,els:[...]}] σε mm. */
function layoutLabelPages(project, st) {
  const unit = +st.unitMM, H = +st.labelH;
  const rows = buildRows(project, st);
  const pages = [];
  if (st.pageMode === 'roll') {
    const maxL = Math.max(unit * 6, +st.rollMax || 250);
    rows.forEach(r => splitCells(r.cells, unit, maxL).forEach(seg => {
      const w = stripWidth(seg, unit);
      pages.push({ w, h: H, color: true, els: [{ t: 'strip', x: 0, y: 0, cells: seg, h: H }] });
    }));
    return pages;
  }
  const [PW, PH] = st.pageMode === 'a4p' ? [210, 297] : [297, 210];
  const M = 10, headH = 8, capH = st.showCaptions ? 4 : 0, gap = 4;
  const maxW = PW - 2 * M;
  let page = null, y = 0;
  const newPage = () => { page = { w: PW, h: PH, color: true, els: [] }; pages.push(page); y = M + headH; };
  newPage();
  rows.forEach(r => {
    const segs = splitCells(r.cells, unit, maxW);
    segs.forEach((seg, si) => {
      const need = capH + H;
      if (y + need > PH - M && page.els.length) newPage();
      if (capH) {
        const units = seg.reduce((a, c) => a + c.w, 0);
        let cap = r.title;
        if (segs.length > 1) cap += `  ·  τμήμα ${si + 1}/${segs.length}`;
        cap += `  ·  ${fmtUnits(units)} μον.  ·  ${fmtMM(stripWidth(seg, unit))} mm`;
        page.els.push({ t: 'caption', x: M, y: y, text: cap });
      }
      page.els.push({ t: 'strip', x: M, y: y + capH, cells: seg, h: H });
      y += need + gap;
    });
  });
  const n = pages.length;
  const date = new Date().toLocaleDateString('el-GR');
  pages.forEach((p, i) => p.els.unshift({
    t: 'header', x: M, y: M, w: PW - 2 * M,
    left: project.name + (project.address ? '  —  ' + project.address : ''),
    right: `Μονάδα ${fmtMM(unit)} mm · ύψος ${fmtMM(H)} mm · ${date} · σελ. ${i + 1}/${n}`
  }));
  if (!rows.length) pages[0].els.push({ t: 'note', x: M, y: M + headH + 4, text: 'Το έργο δεν έχει ακόμη στοιχεία.' });
  return pages;
}

/* Διάταξη αυτοκόλλητου ηλεκτρολόγου. */
function layoutStickerPages(st) {
  const w = +st.stickerW, h = +st.stickerH, copies = Math.max(1, Math.min(200, +st.stickerCopies || 1));
  if (st.pageMode === 'roll') {
    return Array.from({ length: copies }, () => ({ w, h, color: true, els: [{ t: 'sticker', x: 0, y: 0, w, h }] }));
  }
  const PW = 210, PH = 297, M = 10, g = 4;
  const cols = Math.max(1, Math.floor((PW - 2 * M + g) / (w + g)));
  const rowsN = Math.max(1, Math.floor((PH - 2 * M + g) / (h + g)));
  const per = cols * rowsN;
  const pages = [];
  for (let k = 0; k < copies; k++) {
    if (k % per === 0) pages.push({ w: PW, h: PH, color: true, els: [] });
    const idx = k % per;
    const c = idx % cols, r = Math.floor(idx / cols);
    pages[pages.length - 1].els.push({ t: 'sticker', x: M + c * (w + g), y: M + r * (h + g), w, h });
  }
  return pages;
}

/* Σελίδα βαθμονόμησης: χάρακες 100 mm και λωρίδα 10 μονάδων. */
function layoutCalibration(st) {
  return [{ w: 210, h: 297, color: false, els: [{ t: 'calib' }] }];
}

/* ---------- Αυτοκόλλητο ---------- */
function drawSticker(ctx, s, x, y, w, h, e, logoImg, stats) {
  const r = Math.min(3, h * 0.1);
  ctx.save();
  ctx.lineWidth = Math.max(1, 0.25 * s);
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x * s, y * s, w * s, h * s, r * s);
  else ctx.rect(x * s, y * s, w * s, h * s);
  ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(e.bg || '') ? e.bg : '#ffffff';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  const ink = textOn(e.bg);

  const pad = Math.min(3, h * 0.1);
  let tx = x + pad, tw = w - 2 * pad;
  if (logoImg) {
    const box = Math.min(h - 2 * pad, w * 0.38);
    const k = Math.min(box / logoImg.width, box / logoImg.height);
    const lw = logoImg.width * k, lh = logoImg.height * k;
    ctx.drawImage(logoImg, (x + pad + (box - lw) / 2) * s, (y + (h - lh) / 2) * s, lw * s, lh * s);
    tx += box + pad;
    tw -= box + pad;
  }
  const lines = [];
  if (e.name) lines.push({ text: e.name, k: 1.45, wt: 700 });
  if (e.phone) lines.push({ text: 'Τηλ. ' + e.phone, k: 1, wt: 700 });
  if (e.email) lines.push({ text: e.email, k: 0.9, wt: 400 });
  if (e.extra) lines.push({ text: e.extra, k: 0.85, wt: 400 });
  if (!lines.length) lines.push({ text: 'Συμπληρώστε τα στοιχεία σας', k: 1, wt: 400 });
  const availH = h - 2 * pad;
  ctx.fillStyle = ink;
  for (let f = Math.min(5, h * 0.16); f >= 1.2; f -= 0.1) {
    let total = 0;
    const laid = lines.map(L => {
      const fs = f * L.k;
      const ls = wrapFixed(L.text, fs, L.wt, tw);
      const lh = fs * 1.18;
      total += ls.length * lh;
      return { ls, fs, lh, wt: L.wt };
    });
    total += (laid.length - 1) * f * 0.25;
    if (total <= availH || f <= 1.25) {
      if (total > availH && stats) stats.overflow++;
      let cy = y + (h - Math.min(total, availH)) / 2;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      laid.forEach(L => {
        ctx.font = `${L.wt} ${(L.fs * s).toFixed(2)}px ${LABEL_FONT}`;
        L.ls.forEach(ln => { ctx.fillText(ln, tx * s, (cy + L.lh / 2) * s); cy += L.lh; });
        cy += f * 0.25;
      });
      break;
    }
  }
}

/* Μαύρα ή λευκά γράμματα, ανάλογα με το πόσο σκούρο είναι το φόντο */
function textOn(bg) {
  if (!/^#[0-9a-f]{6}$/i.test(bg || '')) return '#000';
  const n = parseInt(bg.slice(1), 16), R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255;
  const lum = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
  return lum < 0.5 ? '#fff' : '#000';
}

/* ---------- Βαθμονόμηση ---------- */
function drawCalibration(ctx, s, st) {
  const unit = +st.unitMM, H = +st.labelH;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${6 * s}px ${LABEL_FONT}`;
  ctx.fillText('PanelLabels — Δοκιμή διαστάσεων', 15 * s, 22 * s);
  ctx.font = `400 ${3.6 * s}px ${LABEL_FONT}`;
  [
    'Εκτυπώστε σε κλίμακα 100% («Πραγματικό μέγεθος»), όχι «Προσαρμογή στη σελίδα».',
    'Μετρήστε με χάρακα: οι δύο γραμμές παρακάτω πρέπει να είναι ακριβώς 100 mm.',
    `Η λωρίδα πρέπει να είναι ${fmtMM(unit * 10)} mm (10 × ${fmtMM(unit)} mm) και ύψος ${fmtMM(H)} mm.`,
    'Αν η λωρίδα δεν ταιριάζει με τα στοιχεία του πίνακα, αλλάξτε «Πλάτος μονάδας» στις ρυθμίσεις εκτύπωσης.'
  ].forEach((t, i) => ctx.fillText(t, 15 * s, (32 + i * 6) * s));

  const ruler = (x0, y0, horizontal) => {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(1, 0.2 * s);
    ctx.beginPath();
    for (let mm = 0; mm <= 100; mm++) {
      const len = mm % 10 === 0 ? 6 : mm % 5 === 0 ? 4 : 2.5;
      if (horizontal) { ctx.moveTo((x0 + mm) * s, y0 * s); ctx.lineTo((x0 + mm) * s, (y0 + len) * s); }
      else { ctx.moveTo(x0 * s, (y0 + mm) * s); ctx.lineTo((x0 + len) * s, (y0 + mm) * s); }
    }
    if (horizontal) { ctx.moveTo(x0 * s, y0 * s); ctx.lineTo((x0 + 100) * s, y0 * s); }
    else { ctx.moveTo(x0 * s, y0 * s); ctx.lineTo(x0 * s, (y0 + 100) * s); }
    ctx.stroke();
    ctx.font = `400 ${2.6 * s}px ${LABEL_FONT}`;
    ctx.textAlign = 'center';
    for (let cm = 0; cm <= 10; cm++) {
      if (horizontal) ctx.fillText(String(cm * 10), (x0 + cm * 10) * s, (y0 + 9.5) * s);
      else { ctx.textAlign = 'left'; ctx.fillText(String(cm * 10), (x0 + 8) * s, (y0 + cm * 10 + 1) * s); }
    }
    ctx.textAlign = 'left';
  };
  ruler(15, 64, true);
  ctx.font = `700 ${3.4 * s}px ${LABEL_FONT}`;
  ctx.fillText('100 mm οριζόντια', 15 * s, 82 * s);
  ruler(160, 64, false);
  ctx.save();
  ctx.translate(156 * s, 175 * s);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('100 mm κάθετα', 0, 0);
  ctx.restore();

  const cells = [
    { w: 2, text: 'Γενικός διακόπτης', sym: 'main', rating: '40A' },
    { w: 1, text: 'Φωτισμός', sym: 'light', rating: '10A' },
    { w: 1.5, text: 'Πρίζες κουζίνας', sym: 'socket', rating: '16A' },
    { w: 1, text: 'Θερμοσίφωνας' }, { w: 1, text: '' }, { w: 1, text: '' },
    { w: 1, text: '' }, { w: 1, text: '' }, { w: 0.5, text: '' }
  ];
  ctx.font = `700 ${3.4 * s}px ${LABEL_FONT}`;
  ctx.fillText(`Λωρίδα 10 μονάδων = ${fmtMM(unit * 10)} mm`, 15 * s, 190 * s);
  drawStrip(ctx, s, 15, 194, cells, H, unit);
  // σημάδια μονάδων
  ctx.lineWidth = Math.max(1, 0.15 * s);
  ctx.beginPath();
  for (let k = 0; k <= 10; k++) {
    ctx.moveTo((15 + k * unit) * s, (196 + H) * s);
    ctx.lineTo((15 + k * unit) * s, (199 + H) * s);
  }
  ctx.stroke();
  ctx.font = `400 ${3 * s}px ${LABEL_FONT}`;
  ctx.fillText('Τοποθετήστε τη λωρίδα πάνω στα στοιχεία της ράγας για έλεγχο.', 15 * s, (206 + H) * s);
}

/* ---------- Render σελίδας σε canvas ---------- */
function loadImage(src) {
  return new Promise(res => {
    if (!src) return res(null);
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

function renderPage(page, dpi, ctxData, stats) {
  const s = dpi / MM_PER_IN;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(page.w * s));
  cv.height = Math.max(1, Math.round(page.h * s));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const st = ctxData.settings;
  page.els.forEach(el => {
    ctx.fillStyle = '#000';
    if (el.t === 'strip') drawStrip(ctx, s, el.x, el.y, el.cells, el.h, +st.unitMM, stats);
    else if (el.t === 'caption') {
      ctx.font = `400 ${2.6 * s}px ${LABEL_FONT}`;
      ctx.fillStyle = '#444';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(el.text, el.x * s, (el.y + 3) * s);
    } else if (el.t === 'header') {
      ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${3.4 * s}px ${LABEL_FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(el.left, el.x * s, (el.y + 3.4) * s);
      ctx.font = `400 ${2.4 * s}px ${LABEL_FONT}`;
      ctx.fillStyle = '#555';
      ctx.textAlign = 'right';
      ctx.fillText(el.right, (el.x + el.w) * s, (el.y + 3.4) * s);
    } else if (el.t === 'note') {
      ctx.font = `400 ${3.4 * s}px ${LABEL_FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(el.text, el.x * s, el.y * s);
    } else if (el.t === 'sticker') drawSticker(ctx, s, el.x, el.y, el.w, el.h, ctxData.electrician, ctxData.logo, stats);
    else if (el.t === 'calib') drawCalibration(ctx, s, st);
  });
  return cv;
}

/* ---------- PDF ---------- */
async function deflateBytes(u8) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (e) { return null; }
}

async function canvasToPdfImage(cv, color) {
  const w = cv.width, h = cv.height;
  const px = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const n = color ? 3 : 1;
  const raw = new Uint8Array(w * h * n);
  if (color) {
    for (let i = 0, j = 0; i < px.length; i += 4) { raw[j++] = px[i]; raw[j++] = px[i + 1]; raw[j++] = px[i + 2]; }
  } else {
    for (let i = 0, j = 0; i < px.length; i += 4) raw[j++] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000 | 0;
  }
  const z = await deflateBytes(raw);
  if (z) return { w, h, filter: '/FlateDecode', cs: color ? '/DeviceRGB' : '/DeviceGray', data: z };
  const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95));
  return { w, h, filter: '/DCTDecode', cs: '/DeviceRGB', data: new Uint8Array(await blob.arrayBuffer()) };
}

/* pages: [{w,h,color,...}], renderFn(page) → canvas. Δημιουργεί PDF με ακριβές μέγεθος σελίδας σε mm. */
async function buildPdf(pages, renderFn) {
  const enc = new TextEncoder();
  const parts = [];
  const offs = [];
  let len = 0;
  const add = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const pt = mm => +(mm * 72 / MM_PER_IN).toFixed(3);

  add('%PDF-1.4\n');
  add(new Uint8Array([37, 226, 227, 207, 211, 10]));
  offs[1] = len; add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const kids = pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ');
  offs[2] = len; add(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const cv = await renderFn(p);
    const img = await canvasToPdfImage(cv, p.color);
    cv.width = cv.height = 1; // αποδέσμευση μνήμης
    const W = pt(p.w), H = pt(p.h), pn = 3 + 3 * i;
    offs[pn] = len;
    add(`${pn} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${pn + 2} 0 R >> >> /Contents ${pn + 1} 0 R >>\nendobj\n`);
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    offs[pn + 1] = len;
    add(`${pn + 1} 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`);
    offs[pn + 2] = len;
    add(`${pn + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace ${img.cs} /BitsPerComponent 8 /Filter ${img.filter} /Length ${img.data.length} >>\nstream\n`);
    add(img.data);
    add('\nendstream\nendobj\n');
  }
  const total = 3 + 3 * pages.length;
  const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
  add(x);
  add(`trailer\n<< /Size ${total} /Root 1 0 R /Info << /Producer (PanelLabels) >> >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
