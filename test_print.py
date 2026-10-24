"""PanelLabels — αυτόματες δοκιμές εκτύπωσης/PDF.
Τρέξιμο: από τον φάκελο της εφαρμογής  `python3 -m http.server 8765`  και μετά  `python3 tests/test_print.py`
Χρειάζεται: playwright (chromium), pypdf, pypdfium2.
"""
import base64, json, sys, os, tempfile
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
import pypdfium2 as pdfium

URL = os.environ.get('PL_URL', 'http://localhost:8765/')
OUT = tempfile.mkdtemp(prefix='pl-print-')
DPI = 300
MM = DPI / 25.4
errs = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: errs.append(m)

SYMS = ['main','rcd','light','socket','heater','ac','washer','cooker','motor','ev','outdoor','bell']
WIDTHS = [1,1.5,2,3,4,5,6]
LONG = 'Πολύ μεγάλη περιγραφή κυκλώματος για να ελεγχθεί η αναδίπλωση κειμένου στην ετικέτα'

def make_project(name, cap, rows_spec):
    rows = []
    for ri, items in enumerate(rows_spec):
        rows.append({'id': f'r{ri}', 'name': f'Σειρά δοκιμής {ri+1}', 'items': [
            {'id': f'i{ri}_{k}', 'w': w, 'text': t, 'sym': s, 'rating': rt} for k, (w, t, s, rt) in enumerate(items)]})
    return {'id': name, 'name': name, 'address': 'Δοκιμή', 'modulesPerRow': cap, 'fillEmpty': True, 'rows': rows}

def big_rows(n_rows, cap):
    spec = []
    for r in range(n_rows):
        items, used, k = [], 0, 0
        while True:
            w = WIDTHS[(r + k) % len(WIDTHS)]
            if used + w > cap: break
            t = LONG if k % 5 == 0 else f'Κύκλωμα {r+1}.{k+1}'
            items.append((w, t, SYMS[(r + k) % len(SYMS)] if k % 3 else '', f'{10 + k}A' if k % 2 else ''))
            used += w; k += 1
        spec.append(items)
    return spec

PROJECTS = {
    'small': make_project('small', 12, [[(2, 'Γενικός διακόπτης', 'main', '40A'), (1, 'Φωτισμός', 'light', '10A'), (1.5, 'Πρίζες', 'socket', '16A')]]),
    'big': make_project('big', 24, big_rows(14, 24)),
    'nolimit': make_project('nolimit', 0, [[(1, f'Θέση {k+1}', SYMS[k % 12], '16A') for k in range(40)]]),
}

def pdf_from_page(pg, act):
    with pg.expect_download() as dl:
        pg.click(f'[data-act={act}]')
    path = os.path.join(OUT, dl.value.suggested_filename)
    dl.value.save_as(path)
    return path

def page_dims(path):
    return [(round(float(p.mediabox.width) * 25.4 / 72, 2), round(float(p.mediabox.height) * 25.4 / 72, 2)) for p in PdfReader(path).pages]

def raster(path, i):
    doc = pdfium.PdfDocument(path)
    img = doc[i].render(scale=DPI / 72).to_pil().convert('L')
    return img

def dark_runs(img, y):
    """x θέσεις σκοτεινών pixel σε μια γραμμή"""
    w = img.width
    px = img.load()
    return [x for x in range(w) if px[x, y] < 100]

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, service_workers='block', accept_downloads=True)
    pg = ctx.new_page()
    logs = []
    pg.on('pageerror', lambda e: logs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_selector('#app')
    for key, proj in PROJECTS.items():
        for mode in ('a4l', 'a4p', 'roll'):
            data = {'schema': 1, 'initialized': True, 'projects': [proj], 'lastProjectId': proj['id'],
                    'settings': {'pageMode': mode, 'unitMM': 17.5, 'labelH': 12, 'showSymbols': True, 'showCaptions': True, 'rollMax': 250}}
            # φόρτωση δεδομένων από σελίδα του ίδιου origin που δεν είναι η εφαρμογή (αλλιώς η εφαρμογή τα ξαναγράφει κλείνοντας)
            pg.goto(URL + 'manifest.webmanifest')
            pg.evaluate('(d) => localStorage.setItem("panellabels.v1", JSON.stringify(d))', data)
            pg.goto(URL + '#print')
            pg.wait_for_selector('#preview canvas')
            pg.wait_for_timeout(200)
            tag = f'[{key}/{mode}]'
            layout = pg.evaluate('() => layoutLabelPages(currentProject(), S()).map(p => ({w:p.w,h:p.h,els:p.els.map(e => ({t:e.t,x:e.x,y:e.y,h:e.h,n:e.cells?e.cells.length:0,cells:e.cells?e.cells.map(c=>({w:c.w,blank:!!c.blank,text:c.text||""})):null}))}))')
            n_prev = pg.locator('#preview canvas').count()
            path = pdf_from_page(pg, 'pdfLabels')
            dims = page_dims(path)
            check(n_prev == len(dims) == len(layout), f'{tag} preview pages ({n_prev}) = PDF pages ({len(dims)}) = layout ({len(layout)})')
            # όλα τα στοιχεία εμφανίζονται ακριβώς μία φορά, με τη σωστή σειρά
            printed = [c['text'] for pgl in layout for e in pgl['els'] if e['t'] == 'strip' for c in e['cells'] if not c['blank']]
            expected = [it['text'] for r in proj['rows'] for it in r['items']]
            check(printed == expected, f'{tag} every item printed once, in order ({len(printed)}/{len(expected)})')
            # τίποτα έξω από τη σελίδα / περιθώρια
            inside = True
            unit = 17.5
            for pgl in layout:
                for e in pgl['els']:
                    if e['t'] == 'strip':
                        wmm = sum(c['w'] for c in e['cells']) * unit
                        if mode == 'roll':
                            inside &= abs(wmm - pgl['w']) < 0.01 and abs(e['h'] - pgl['h']) < 0.01
                        else:
                            inside &= e['x'] >= 9.99 and e['x'] + wmm <= pgl['w'] - 9.99 and e['y'] + e['h'] <= pgl['h'] - 9.99
            check(inside, f'{tag} all strips inside page margins (no cut labels)')
            if mode == 'a4l': check(all(d == (297.0, 210.0) for d in dims), f'{tag} PDF pages are A4 landscape 297×210 mm')
            if mode == 'a4p': check(all(d == (210.0, 297.0) for d in dims), f'{tag} PDF pages are A4 portrait 210×297 mm')
            # μέτρηση πάνω στο PDF: πρώτη λωρίδα, σε pixel 300 dpi
            first = next(e for e in layout[0]['els'] if e['t'] == 'strip')
            wmm = sum(c['w'] for c in first['cells']) * unit
            img = raster(path, 0)
            yline = int((first['y'] + first['h'] / 2) * MM)
            xs = dark_runs(img, yline)
            # κέντρα των γραμμών περιγράμματος (η γραμμή 0,25 mm είναι κεντραρισμένη στο όριο)
            lcl = [x for x in xs if x - min(xs) < MM]; rcl = [x for x in xs if max(xs) - x < MM]
            left_px, right_px = sum(lcl) / len(lcl), sum(rcl) / len(rcl)
            meas_w = (right_px - left_px) / MM
            col = int((first['x'] + 3) * MM)
            ys = [y for y in range(img.height) if img.load()[col, y] < 100 and abs(y / MM - first['y'] - first['h'] / 2) < first['h'] / 2 + 1]
            tcl = [y for y in ys if y - min(ys) < MM]; bcl = [y for y in ys if max(ys) - y < MM]
            meas_h = (sum(bcl) / len(bcl) - sum(tcl) / len(tcl)) / MM
            check(abs(meas_w - wmm) < 0.3 and abs(left_px / MM - first['x']) < 0.3,
                  f'{tag} measured strip width {meas_w:.2f} mm (expected {wmm:.2f}), left edge {left_px / MM:.2f} mm (expected {first["x"]:.2f})')
            check(abs(meas_h - 12) < 0.3, f'{tag} measured strip height {meas_h:.2f} mm (expected 12.00)')
            # διαχωριστικό μετά το πρώτο στοιχείο στη σωστή θέση
            div_mm = first['x'] + first['cells'][0]['w'] * unit
            near = [x for x in xs if abs(x / MM - div_mm) < 0.5]
            check(bool(near), f'{tag} first divider at {div_mm:.2f} mm found in PDF')
            # προεπισκόπηση = PDF: ίδιες γραμμές κειμένου και ίδιο μέγεθος γραμμάτων σε κάθε κελί,
            # στην ανάλυση της οθόνης (όπως η προεπισκόπηση) και στα 300 dpi του PDF
            cmp = pg.evaluate('''() => { const pages = layoutLabelPages(currentProject(), S()); const out = [];
                for (const dpi of [72, 110, 160, 300]) { const st = {overflow:0, lines:[]}; pages.forEach(pg => renderPage(pg, dpi, renderCtx(null), st)); out.push(st.lines); }
                return out; }''')
            same = all(x == cmp[-1] for x in cmp)
            diffs = [(i, a, b2) for i, (a, b2) in enumerate(zip(cmp[1], cmp[-1])) if a != b2][:3]
            check(same and len(cmp[-1]) > 0, f'{tag} preview text layout identical to PDF at all screen resolutions ({len(cmp[-1])} cells) {diffs}')
    check(not logs, 'no page errors ' + str(logs))
    b.close()

print('\nOutput folder:', OUT)
print('FAILED:', errs if errs else 'none')
sys.exit(1 if errs else 0)
