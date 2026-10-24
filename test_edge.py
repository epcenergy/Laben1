"""PanelLabels — ακραίες περιπτώσεις: στενές οθόνες, σκοτεινό θέμα, άδειο έργο/αυτοκόλλητο, ειδικοί χαρακτήρες, offline, ταχύτητα.
Τρέξιμο: `python3 -m http.server 8765` στον φάκελο της εφαρμογής και μετά `python3 tests/test_edge.py`"""
import os, sys, time, tempfile
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
URL = os.environ.get('PL_URL', 'http://localhost:8765/')
OUT = tempfile.mkdtemp(prefix='pl-edge-') + '/'
errs = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: errs.append(m)
VIEWS = ['projects', 'editor', 'colors', 'print', 'info', 'backup']
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ('light', 'dark'):
        for w in (320, 390, 768, 1280):
            ctx = b.new_context(viewport={'width': w, 'height': 800}, color_scheme=scheme, service_workers='block')
            pg = ctx.new_page(); logs = []; pg.on('pageerror', lambda e: logs.append(str(e)))
            pg.goto(URL); pg.wait_for_selector('#app')
            bad = []
            for v in VIEWS:
                pg.goto(URL + '#' + v); pg.wait_for_timeout(250)
                sw = pg.evaluate('document.documentElement.scrollWidth'); cw = pg.evaluate('document.documentElement.clientWidth')
                if sw > cw + 1: bad.append(f'{v}:{sw}>{cw}')
            check(not bad and not logs, f'[{scheme} {w}px] no sideways scrolling or errors in any tab {bad} {logs}')
            if w == 320 and scheme == 'dark':
                pg.goto(URL + '#editor'); pg.wait_for_timeout(200); pg.screenshot(path=OUT + 'dark-320-editor.png')
                pg.goto(URL + '#colors'); pg.wait_for_timeout(200); pg.screenshot(path=OUT + 'dark-320-colors.png')
            ctx.close()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', accept_downloads=True)
    pg = ctx.new_page(); logs = []; pg.on('pageerror', lambda e: logs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('#app')
    # άδειο έργο με περίεργο όνομα
    pg.goto(URL + '#projects'); pg.click('.view-head [data-act=newProject]')
    weird = 'Πίνακας <b>"Α/Β"</b> & Γ: πολύ μεγάλο όνομα έργου για έλεγχο κεφαλίδας και ονόματος αρχείου *?'
    pg.fill('#dlgInput', weird); pg.click('[data-choice=ok]'); pg.wait_for_selector('.row-card')
    check(pg.input_value('#pName') == weird and pg.locator('#app b', has_text='Α/Β').count() == 0 and weird in pg.text_content('#topProject'), 'special characters in project name are shown as text (no HTML injection)')
    pg.goto(URL + '#print'); pg.wait_for_selector('#preview canvas')
    with pg.expect_download() as dl: pg.click('[data-act=pdfLabels]')
    fn = dl.value.suggested_filename; dl.value.save_as(OUT + 'empty.pdf')
    check(not any(c in fn for c in '<>:"/\\|?*') and fn.endswith('.pdf'), f'safe PDF file name: {fn}')
    check(len(PdfReader(OUT + 'empty.pdf').pages) == 1, 'empty project produces a valid 1-page PDF')
    # άδειο αυτοκόλλητο
    with pg.expect_download() as dl: pg.locator('[data-act=pdfSticker]').first.click()
    dl.value.save_as(OUT + 'st.pdf'); check(len(PdfReader(OUT + 'st.pdf').pages) == 1, 'sticker PDF works with no details filled')
    # 40 αντίτυπα αυτοκόλλητου → πολλές σελίδες A4
    pg.fill('#sCopies', '40'); pg.locator('#sCopies').dispatch_event('change')
    with pg.expect_download() as dl: pg.locator('[data-act=pdfSticker]').first.click()
    dl.value.save_as(OUT + 'st40.pdf'); n = len(PdfReader(OUT + 'st40.pdf').pages)
    check(n == 4, f'40 stickers 80×40 mm = 12 per A4 (2×6) → 4 pages (got {n})')
    # σελίδα δοκιμής
    with pg.expect_download() as dl: pg.click('[data-act=pdfCalib]')
    dl.value.save_as(OUT + 'cal.pdf'); check(len(PdfReader(OUT + 'cal.pdf').pages) == 1, 'calibration page PDF works')
    # ταχύτητα: μεγάλος πίνακας (20 σειρές × 24)
    pg.goto(URL + 'manifest.webmanifest')
    rows = [{'id': f'r{r}', 'name': '', 'items': [{'id': f'i{r}_{k}', 'w': 1, 'text': f'Κύκλωμα {r}.{k}', 'sym': 'socket', 'rating': '16A'} for k in range(24)]} for r in range(20)]
    pg.evaluate('(d) => localStorage.setItem("panellabels.v1", JSON.stringify(d))', {'schema': 1, 'initialized': True, 'lastProjectId': 'x', 'projects': [{'id': 'x', 'name': 'Μεγάλος', 'modulesPerRow': 24, 'rows': rows}]})
    t0 = time.time(); pg.goto(URL + '#editor'); pg.wait_for_selector('.row-card'); t_ed = time.time() - t0
    check(pg.locator('.cell.item').count() == 480 and t_ed < 3, f'editor with 480 items opens in {t_ed:.2f}s')
    pg.goto(URL + '#print'); pg.wait_for_selector('#preview canvas')
    t0 = time.time()
    with pg.expect_download(timeout=60000) as dl: pg.click('[data-act=pdfLabels]')
    dl.value.save_as(OUT + 'big.pdf'); t_pdf = time.time() - t0
    check(t_pdf < 20, f'PDF of 20×24 panel ({len(PdfReader(OUT + "big.pdf").pages)} pages) in {t_pdf:.1f}s, {os.path.getsize(OUT + "big.pdf") // 1024} KB')
    check(not logs, 'no page errors ' + str(logs))
    ctx.close()
    # offline (με service worker)
    ctx = b.new_context(); pg = ctx.new_page()
    pg.goto(URL); pg.wait_for_selector('#app')
    pg.wait_for_function('navigator.serviceWorker.ready.then(() => true)', timeout=15000)
    pg.reload(); pg.wait_for_function('!!navigator.serviceWorker.controller', timeout=15000)
    ctx.set_offline(True)
    ok = True
    for v in VIEWS:
        pg.goto(URL + '#' + v)
        try: pg.wait_for_selector('#app > *', timeout=8000)
        except Exception: ok = False
    pg.reload(); pg.wait_for_selector('#app > *', timeout=8000)
    check(ok, 'all tabs work offline after first visit')
    ctx.close(); b.close()
print('\nOutput folder:', OUT)
print('FAILED:', errs if errs else 'none')
sys.exit(1 if errs else 0)
