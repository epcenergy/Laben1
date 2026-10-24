"""PanelLabels — κουμπί Εκτύπωση σε υπολογιστή και κινητό (χωρίς window.print, χωρίς πάγωμα)
Τρέξιμο: `python3 -m http.server 8765` στον φάκελο της εφαρμογής και μετά `python3 tests/test_print_button.py`"""
import os, sys, tempfile
URL=os.environ.get('PL_URL','http://localhost:8765/')
import base64
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
O=tempfile.mkdtemp(prefix='pl-btn-')+'/'
errs=[]
def check(c,m):
    print(('PASS ' if c else 'FAIL ')+m)
    if not c: errs.append(m)
SHARE_MOCK = """() => {
  window.__shares = [];
  navigator.canShare = () => true;
  window.__denyOnce = %s;
  navigator.share = async (d) => {
    if (window.__denyOnce) { window.__denyOnce = false; const e = new Error('no gesture'); e.name='NotAllowedError'; throw e; }
    const f = d.files[0]; const buf = new Uint8Array(await f.arrayBuffer());
    let bin=''; for (let i=0;i<buf.length;i+=8192) bin += String.fromCharCode.apply(null, buf.subarray(i,i+8192));
    window.__shares.push({name:f.name, type:f.type, b64: btoa(bin)});
  };
}"""
with sync_playwright() as p:
    b=p.chromium.launch()
    # ---- Desktop: new tab with PDF
    c=b.new_context(viewport={'width':1280,'height':900},service_workers='block'); pg=c.new_page()
    logs=[]; pg.on('pageerror',lambda e: logs.append(str(e)))
    pg.goto(''+URL+'#print'); pg.wait_for_selector('#preview canvas')
    pg.evaluate("() => { const o = window.open; window.__wins=[]; window.open = (...a) => { const w = o.apply(window, a); const fake = { closed:false, document: w.document, close(){ w.close(); }, location: { set href(u){ window.__pdfUrl = u; } } }; window.__wins.push(fake); return fake; }; }")
    with c.expect_page() as newp: pg.click('[data-act=printLabels]')
    np=newp.value
    pg.wait_for_function('!!window.__pdfUrl', timeout=20000)
    url=pg.evaluate('window.__pdfUrl')
    check(url.startswith('blob:') and 'Ετοιμάζεται' in np.inner_text('body'),'desktop: print opens a new tab (shows waiting text) and sends it the PDF')
    blob=pg.evaluate("async (u) => { const r = await fetch(u); const b = new Uint8Array(await r.arrayBuffer()); let s=''; for (let i=0;i<b.length;i+=8192) s+=String.fromCharCode.apply(null,b.subarray(i,i+8192)); return btoa(s); }", url)
    open(O+'pr-desktop.pdf','wb').write(base64.b64decode(blob))
    r=PdfReader(O+'pr-desktop.pdf'); dims=[(round(float(x.mediabox.width)*25.4/72,1),round(float(x.mediabox.height)*25.4/72,1)) for x in r.pages]
    check(dims==[(297.0,210.0)],'desktop print PDF = A4 landscape like the PDF button '+str(dims))
    check(pg.evaluate("UI.busy")==False,'app not stuck busy after desktop print')
    # sticker print desktop
    pg.evaluate('window.__pdfUrl=null')
    with c.expect_page() as newp2: pg.click('[data-act=printSticker]')
    pg.wait_for_function('!!window.__pdfUrl', timeout=20000); check(True,'desktop: sticker print opens PDF tab')
    # popup blocked -> download fallback
    pg.evaluate("() => { window.open = () => null; }")
    with pg.expect_download() as dl: pg.click('[data-act=printLabels]')
    check(dl.value.suggested_filename.endswith('.pdf'),'desktop: if pop-ups are blocked, the PDF downloads instead')
    check(not logs,'no page errors desktop '+str(logs))
    c.close()
    # ---- Mobile: share sheet
    for deny in (False, True):
        c=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,service_workers='block'); pg=c.new_page()
        logs=[]; pg.on('pageerror',lambda e: logs.append(str(e)))
        popups=[]; c.on('page',lambda x: popups.append(x))
        pg.goto(''+URL+'#print'); pg.wait_for_selector('#preview canvas')
        pg.evaluate(SHARE_MOCK % ('true' if deny else 'false'))
        pg.tap('[data-act=printLabels]')
        if deny:
            pg.wait_for_selector('#modal .dialog', timeout=20000)
            check('Άνοιγμα για εκτύπωση' in pg.inner_text('#modal'),'mobile: when share is refused, a tap-again button appears')
            pg.tap('[data-choice=ok]')
        pg.wait_for_function("window.__shares.length===1", timeout=20000)
        sh=pg.evaluate("window.__shares[0]")
        open(O+'pr-mobile.pdf','wb').write(base64.b64decode(sh['b64']))
        r=PdfReader(O+'pr-mobile.pdf')
        check(sh['type']=='application/pdf' and len(r.pages)==1,f'mobile (deny={deny}): print opens share sheet with the PDF')
        check(not popups,'mobile: no extra window opened')
        pg.wait_for_timeout(300)
        check(pg.evaluate("UI.busy")==False,'mobile: app not stuck after print')
        t=pg.inner_text('#toast') if pg.is_visible('#toast') else ''
        print('   toast:',t)
        check(not logs,'no page errors mobile '+str(logs))
        c.close()
    b.close()
print('FAILED:',errs or 'none'); sys.exit(1 if errs else 0)
