"""PanelLabels — δοκιμές «Χρώματα ετικετών» και φόντου αυτοκόλλητου (οθόνη, PDF, αποθήκευση, ανεξαρτησία).
Τρέξιμο: `python3 -m http.server 8765` στον φάκελο της εφαρμογής και μετά `python3 tests/test_colors.py`"""
import os, sys, json, tempfile, base64
from playwright.sync_api import sync_playwright
import pypdfium2 as pdfium

URL = os.environ.get('PL_URL', 'http://localhost:8765/')
OUT = tempfile.mkdtemp(prefix='pl-colors-')
MM = 300 / 25.4
errs = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: errs.append(m)
def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def close(a, b, tol=40): return all(abs(x - y) <= tol for x, y in zip(a, b))

def save_pdf(pg, act, name):
    with pg.expect_download() as dl:
        pg.locator(f'[data-act={act}]').first.click()
    path = os.path.join(OUT, name); dl.value.save_as(path); return path
def raster(path, i=0): return pdfium.PdfDocument(path)[i].render(scale=300 / 72).to_pil().convert('RGB')
def count_color(img, box, rgb, tol=40):
    x0, y0, x1, y1 = [int(v * MM) for v in box]
    px = img.load(); n = 0
    for y in range(y0, y1, 2):
        for x in range(x0, x1, 2):
            if close(px[x, y], rgb, tol): n += 1
    return n

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, service_workers='block', accept_downloads=True)
    pg = ctx.new_page()
    logs = []; pg.on('pageerror', lambda e: logs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('.row-card')
    # 1. Η επεξεργασία στοιχείου δεν έχει πια χρώματα
    pg.locator('.cell.item').first.click(); pg.wait_for_selector('#itText')
    sheet = pg.inner_text('#sheet')
    check('Χρώματα' not in sheet and pg.locator('#sheet .sw').count() == 0, 'item editor has no colour controls')
    pg.click('[data-act=closeSheet]')
    # 2. Καρτέλα Χρώματα
    pg.click('.tabbar a[data-tab=colors]'); pg.wait_for_selector('#colorPreview canvas')
    check('Χρώματα ετικετών' in pg.text_content('#app'), 'separate "Χρώματα ετικετών" tab exists')
    labels = pg.inner_text('#app')
    check(all(x in labels for x in ['Φόντο ετικέτας', 'Γραμματοσειρά', 'Σύμβολο', 'Περίγραμμα']), 'tab has background, font, symbol, border colours')
    d = pg.evaluate('JSON.parse(localStorage.getItem("panellabels.v1"))')
    check(d['projects'][0]['colors'] == {'bg': '#ffffff', 'fg': '#000000', 'sc': '#000000', 'bc': '#000000'}, 'default: white background, black elements')
    pg.screenshot(path=OUT + '/colors-tab.png', full_page=True)
    BG, FG, BC = '#ffd43b', '#1971c2', '#e03131'
    SC = '#0b7285'
    before = pg.evaluate("document.querySelector('#colorPreview canvas').toDataURL()")
    pg.click(f'[data-act=pickColor][data-g=label][data-k=bg][data-c="{BG}"]')
    pg.wait_for_timeout(150)
    after = pg.evaluate("document.querySelector('#colorPreview canvas').toDataURL()")
    check(before != after, 'preview updates immediately when a colour is picked')
    pg.click(f'[data-act=pickColor][data-g=label][data-k=fg][data-c="{FG}"]')
    pg.click(f'[data-act=pickColor][data-g=label][data-k=bc][data-c="{BC}"]')
    pg.evaluate(f"() => {{ const i = document.getElementById('cp-label-sc'); i.value = '{SC}'; i.dispatchEvent(new Event('input', {{bubbles:true}})); }}")
    pg.wait_for_timeout(600)
    pg.screenshot(path=OUT + '/colors-picked.png', full_page=True)
    d = pg.evaluate('JSON.parse(localStorage.getItem("panellabels.v1"))')
    check(d['projects'][0]['colors'] == {'bg': BG, 'fg': FG, 'sc': SC, 'bc': BC}, 'colours saved with the project: ' + str(d['projects'][0]['colors']))
    check(pg.locator('[data-sws="label-sc"] .sw.custom.on').count() == 1, 'custom colour shown as selected')
    # 3. Μένουν μετά από επαναφόρτωση
    pg.reload(); pg.wait_for_selector('#colorPreview canvas')
    check(pg.locator(f'[data-sws="label-bg"] [data-c="{BG}"].on').count() == 1, 'colours kept after reload')
    # 4. Οθόνη επεξεργασίας παίρνει τα χρώματα
    pg.click('.tabbar a[data-tab=editor]'); pg.wait_for_selector('.cell.item')
    bgcss = pg.evaluate("getComputedStyle(document.querySelector('.cell.item')).backgroundColor")
    check(bgcss == 'rgb(255, 212, 59)', 'editor cells use the label background (' + bgcss + ')')
    # 5. PDF: φόντο, γράμματα, σύμβολο, περίγραμμα
    pg.click('.tabbar a[data-tab=print]'); pg.wait_for_selector('#preview canvas')
    pdf = save_pdf(pg, 'pdfLabels', 'labels.pdf')
    img = raster(pdf)
    lay = pg.evaluate("() => layoutLabelPages(currentProject(), S())[0].els.filter(e => e.t === 'strip').map(e => ({x:e.x,y:e.y,h:e.h,w:e.cells.reduce((a,c)=>a+c.w,0)*17.5, c0:e.cells[0].w*17.5}))")
    s0 = lay[0]
    cell = (s0['x'] + 0.6, s0['y'] + 0.6, s0['x'] + s0['c0'] - 0.6, s0['y'] + s0['h'] - 0.6)
    check(count_color(img, cell, hexrgb(BG), 12) > 500, 'PDF: label background printed in chosen colour')
    check(count_color(img, cell, hexrgb(FG), 60) > 15, 'PDF: text printed in chosen font colour')
    check(count_color(img, cell, hexrgb(SC), 60) > 10, 'PDF: symbol printed in chosen symbol colour')
    edge = (s0['x'] - 0.3, s0['y'] + 2, s0['x'] + 0.3, s0['y'] + s0['h'] - 2)
    check(count_color(img, edge, hexrgb(BC), 70) > 5, 'PDF: border printed in chosen border colour')
    check(count_color(img, cell, (0, 0, 0), 30) < 5, 'PDF: no leftover black text/symbols in the cell')
    # 6. Δεύτερο έργο έχει τα δικά του (προεπιλεγμένα) χρώματα
    pg.goto(URL + '#projects'); pg.wait_for_selector('.view-head [data-act=newProject]')
    pg.click('.view-head [data-act=newProject]'); pg.fill('#dlgInput', 'Δεύτερο'); pg.click('[data-choice=ok]'); pg.wait_for_selector('.row-card')
    pg.click('.tabbar a[data-tab=colors]'); pg.wait_for_selector('#colorPreview canvas')
    d = pg.evaluate('JSON.parse(localStorage.getItem("panellabels.v1"))')
    p2 = next(x for x in d['projects'] if x['name'] == 'Δεύτερο')
    p1 = next(x for x in d['projects'] if x['name'] != 'Δεύτερο')
    check(p2['colors']['bg'] == '#ffffff' and p1['colors']['bg'] == BG, 'each project keeps its own colours')
    # 7. Φόντο αυτοκόλλητου: ανεξάρτητο
    pg.click('.tabbar a[data-tab=info]'); pg.wait_for_selector('#eName')
    pg.fill('#eName', 'Ηλεκτρολογικές Εγκαταστάσεις'); pg.fill('#ePhone', '6940000000')
    check(pg.locator('[data-sws="sticker-bg"] [data-c="#ffffff"].on').count() == 1, 'sticker background defaults to white')
    STK = '#212529'
    pg.click(f'[data-act=pickColor][data-g=sticker][data-k=bg][data-c="{STK}"]'); pg.wait_for_timeout(400)
    pg.screenshot(path=OUT + '/sticker.png', full_page=True)
    d = pg.evaluate('JSON.parse(localStorage.getItem("panellabels.v1"))')
    check(d['electrician']['bg'] == STK, 'sticker background saved')
    check(next(x for x in d['projects'] if x['name'] == 'Δεύτερο')['colors']['bg'] == '#ffffff' and next(x for x in d['projects'] if x['name'] != 'Δεύτερο')['colors']['bg'] == BG,
          'sticker background does not change label backgrounds')
    pdf2 = save_pdf(pg, 'pdfSticker', 'sticker.pdf')
    simg = raster(pdf2)
    st = pg.evaluate('S()')
    box = (12, 12, 10 + st['stickerW'] - 2, 10 + st['stickerH'] - 2)
    check(count_color(simg, box, hexrgb(STK), 12) > 1000, 'PDF: sticker background printed in its own colour')
    check(count_color(simg, box, (255, 255, 255), 20) > 30, 'PDF: sticker text switches to white on a dark background')
    # αλλαγή φόντου ετικετών δεν αλλάζει αυτοκόλλητο
    pg.click('.tabbar a[data-tab=colors]'); pg.wait_for_selector('#colorPreview canvas')
    pg.click('[data-act=pickColor][data-g=label][data-k=bg][data-c="#d3f9d8"]'); pg.wait_for_timeout(200)
    d = pg.evaluate('JSON.parse(localStorage.getItem("panellabels.v1"))')
    check(d['electrician']['bg'] == STK, 'label background does not change the sticker background')
    # 8. Αντίγραφο ασφαλείας περιέχει τα χρώματα
    pg.click('.tabbar a[data-tab=backup]'); pg.wait_for_selector('[data-act=exportBackup]')
    with pg.expect_download() as dl: pg.locator('[data-act=exportBackup]').first.click()
    bk = json.load(open(dl.value.path()))
    check(bk['data']['electrician']['bg'] == STK and all('colors' in x for x in bk['data']['projects']), 'backup includes label colours and sticker background')
    # 9. Μετάβαση από έκδοση 1.1 (χρώματα ανά στοιχείο)
    pg.goto(URL + 'manifest.webmanifest')
    old = {'schema': 1, 'initialized': True, 'lastProjectId': 'o', 'projects': [{'id': 'o', 'name': 'Παλιό', 'modulesPerRow': 12, 'rows': [{'id': 'r', 'items': [
        {'id': 'a', 'w': 1, 'text': 'Α', 'bg': '#ffe3e3', 'fg': '#e03131', 'sc': '#e03131', 'bc': '#e03131'}]}]}]}
    pg.evaluate('(d) => localStorage.setItem("panellabels.v1", JSON.stringify(d))', old)
    pg.goto(URL + '#colors'); pg.wait_for_selector('#colorPreview canvas')
    pg.wait_for_timeout(300)
    d = pg.evaluate('(() => { Store.save(); return JSON.parse(localStorage.getItem("panellabels.v1")); })()')
    check(d['projects'][0]['colors'] == {'bg': '#ffe3e3', 'fg': '#e03131', 'sc': '#e03131', 'bc': '#e03131'}, 'colours from version 1.1 carried over to the project')
    # 10. Επαναφορά
    pg.click('[data-act=colorsReset]'); pg.wait_for_timeout(200)
    d = pg.evaluate('JSON.parse(localStorage.getItem("panellabels.v1"))')
    check(d['projects'][0]['colors']['bg'] == '#ffffff', 'reset returns to white/black')
    check(not logs, 'no page errors ' + str(logs))
    b.close()
print('\nOutput folder:', OUT)
print('FAILED:', errs if errs else 'none')
sys.exit(1 if errs else 0)
