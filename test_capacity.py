"""PanelLabels — όριο θέσεων ανά σειρά και κύλιση λωρίδας
Τρέξιμο: `python3 -m http.server 8765` στον φάκελο της εφαρμογής και μετά `python3 tests/test_capacity.py`"""
import os, sys, tempfile
URL=os.environ.get('PL_URL','http://localhost:8765/')
import base64, json
from playwright.sync_api import sync_playwright
O=tempfile.mkdtemp(prefix='pl-cap-')+'/'
errs=[]
def check(c,m):
    print(('PASS ' if c else 'FAIL ')+m)
    if not c: errs.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,service_workers='block',accept_downloads=True); pg=ctx.new_page()
    logs=[]; pg.on('pageerror',lambda e: logs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('.row-card')
    row2=pg.locator('.row-card').nth(1)
    # row2 has 7 units, cap 12. add 5 items -> full
    for k in range(5):
        row2.locator('[data-act=addItem]').click(); pg.wait_for_selector('#itText')
        pg.fill('#itText',f'Κύκλωμα {k+1}')
        sl=pg.evaluate("document.querySelectorAll('.strip-wrap')[1].scrollLeft")
        pg.click('[data-act=closeSheet]'); pg.wait_for_timeout(150)
        sl2=pg.evaluate("document.querySelectorAll('.strip-wrap')[1].scrollLeft")
        if k==4: check(sl>0 and abs(sl2-sl)<2, f'strip stays scrolled after edit/close (scrollLeft {sl} -> {sl2})')
    check(row2.locator('[data-act=addItem]').count()==0,'add button disappears when row is 12/12')
    check('12 / 12' in row2.inner_text() and 'γεμάτη' in row2.inner_text(),'row shows full 12/12')
    # try width change beyond capacity
    row2.locator('.cell.item').last.click(); pg.wait_for_selector('#itText')
    check(pg.locator('[data-act=setW][data-w="2"]').is_disabled() and not pg.locator('[data-act=setW][data-w="1"]').is_disabled(),'wider widths disabled when row full')
    check(pg.locator('[data-act=dupItem]').is_disabled(),'duplicate disabled when row full')
    pg.click('[data-act=closeSheet]'); pg.wait_for_timeout(200)
    # lower capacity blocked
    pg.fill('#pMod','10'); pg.locator('#pMod').dispatch_event('change')
    check(pg.input_value('#pMod')=='12' and 'Αφαιρέστε' in pg.inner_text('#toast'),'cannot lower positions below used')
    # move item to full row blocked: row1 has 8.5; move from row1 to row2 (full)
    pg.locator('.row-card').nth(0).locator('.cell.item').first.click(); pg.wait_for_selector('#itText')
    check(pg.locator('[data-act=mvDownRow]').is_disabled(),'moving into full row disabled')
    pg.click('[data-act=closeSheet]')
    print('LOGS',logs); b.close()
print('FAILED:',errs or 'none'); sys.exit(1 if errs else 0)
