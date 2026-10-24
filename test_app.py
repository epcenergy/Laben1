"""PanelLabels — ροή εφαρμογής: έργα, στοιχεία, αποθήκευση, αντίγραφα, PDF
Τρέξιμο: `python3 -m http.server 8765` στον φάκελο της εφαρμογής και μετά `python3 tests/test_app.py`"""
import os, sys, tempfile
URL=os.environ.get('PL_URL','http://localhost:8765/')
import json
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
OUT=tempfile.mkdtemp(prefix='pl-app-')+'/'
errs=[]
def check(cond,msg):
    print(('PASS ' if cond else 'FAIL ')+msg)
    if not cond: errs.append(msg)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,accept_downloads=True)
    pg=ctx.new_page()
    logs=[]
    pg.on('console',lambda m: logs.append(m.type+': '+m.text) if m.type in('error','warning') else None)
    pg.on('pageerror',lambda e: logs.append('PAGEERR '+str(e)))
    pg.goto(URL)
    pg.wait_for_selector('.row-card')
    check(pg.locator('.row-card').count()==2,'sample project with 2 rows opens in editor')
    pg.screenshot(path=OUT+'1-editor.png',full_page=True)
    # add item to row 2
    pg.locator('.row-card').nth(1).locator('[data-act=addItem]').click()
    pg.wait_for_selector('#itText')
    pg.fill('#itText','Πρίζες γραφείου')
    pg.click('[data-act=setW][data-w="1.5"]')
    pg.click('[data-act=setSym][data-sym=socket]')
    pg.fill('#itRating','16A')
    pg.screenshot(path=OUT+'2-sheet.png')
    pg.click('[data-act=mvLeft]')
    pg.click('[data-act=closeSheet]')
    pg.wait_for_timeout(600)
    txt=pg.locator('.row-card').nth(1).inner_text()
    check('Πρίζες γραφείου' in txt,'new item text shown in strip')
    check('8,5 / 12' in txt,'capacity counts 1.5 width (8,5/12)')
    # reload persistence
    pg.reload(); pg.wait_for_selector('.row-card')
    data=pg.evaluate("JSON.parse(localStorage.getItem('panellabels.v1'))")
    items=data['projects'][0]['rows'][1]['items']
    check(any(i['text']=='Πρίζες γραφείου' and i['w']==1.5 and i['sym']=='socket' for i in items),'item persisted after reload')
    check(items[-2]['text']=='Πρίζες γραφείου','move left persisted')
    # add row, rename
    pg.click('[data-act=addRow]')
    pg.locator('.row-name').nth(2).fill('Κλιματισμός')
    pg.wait_for_timeout(600)
    pg.reload(); pg.wait_for_selector('.row-card')
    check(pg.locator('.row-card').count()==3 and pg.locator('.row-name').nth(2).input_value()=='Κλιματισμός','new row + name persisted')
    # over capacity warning
    pg.fill('#pMod','8'); pg.locator('#pMod').dispatch_event('change')
    check(pg.input_value('#pMod')=='12','positions cannot be lowered below what a row already uses')
    # delete row with confirm modal
    pg.locator('[data-act=rowDel]').nth(2).click()
    check(pg.locator('.row-card').count()==2,'empty row deletes without confirm')
    # projects: new project
    pg.goto(''+URL+'#projects'); pg.wait_for_selector('.pcard')
    pg.click('.view-head [data-act=newProject]')
    pg.fill('#dlgInput','Οικία Παπαδόπουλου')
    pg.click('[data-choice=ok]')
    pg.wait_for_selector('.row-card')
    check(pg.input_value('#pName')=='Οικία Παπαδόπουλου','new project created and opened')
    pg.goto(''+URL+'#projects'); pg.wait_for_selector('.pcard')
    check(pg.locator('.pcard').count()==2,'two projects listed')
    pg.screenshot(path=OUT+'3-projects.png',full_page=True)
    # delete with confirm cancel then ok
    pg.locator('[data-act=delProject]').first.click(); pg.click('[data-choice=cancel]')
    check(pg.locator('.pcard').count()==2,'delete cancelled keeps project')
    # open sample again
    pg.locator('.pcard .open').filter(has_text='Παράδειγμα').click(); pg.wait_for_selector('.row-card')
    # electrician
    pg.goto(''+URL+'#info'); pg.wait_for_selector('#eName')
    pg.fill('#eName','Ηλεκτρολογικές Εγκαταστάσεις Κ. Ιωάννου'); pg.fill('#ePhone','6941234567'); pg.fill('#eEmail','info@example.gr')
    pg.set_input_files('#eLogo','/mnt/user-data/attachments/7dc84a20-0050-5b4d-abe6-51fac395fa36/47d0a179-image.png')
    pg.wait_for_selector('.logo-thumb img')
    pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+'4-info.png',full_page=True)
    # print view
    pg.goto(''+URL+'#print'); pg.wait_for_selector('#preview canvas')
    pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+'5-print.png',full_page=True)
    with pg.expect_download() as dl: pg.click('[data-act=pdfLabels]')
    dl.value.save_as(OUT+'labels.pdf')
    with pg.expect_download() as dl: pg.click('[data-act=pdfCalib]')
    dl.value.save_as(OUT+'calib.pdf')
    with pg.expect_download() as dl: pg.locator('[data-act=pdfSticker]').first.click()
    dl.value.save_as(OUT+'sticker.pdf')
    pg.select_option('#sPage','roll'); pg.wait_for_timeout(600)
    pg.screenshot(path=OUT+'6-roll.png',full_page=True)
    with pg.expect_download() as dl: pg.click('[data-act=pdfLabels]')
    dl.value.save_as(OUT+'roll.pdf')
    pg.select_option('#sPage','a4l')
    # backup export/import
    pg.goto(''+URL+'#backup'); pg.wait_for_selector('[data-act=exportBackup]')
    with pg.expect_download() as dl: pg.locator('[data-act=exportBackup]').first.click()
    dl.value.save_as(OUT+'backup.json')
    bk=json.load(open(OUT+'backup.json'))
    check(bk['app']=='PanelLabels' and len(bk['data']['projects'])==2,'backup contains 2 projects')
    pg.screenshot(path=OUT+'7-backup.png',full_page=True)
    # wipe storage and import -> replace
    pg.evaluate("localStorage.clear()")
    ctx2=b.new_context(viewport={'width':1280,'height':900},accept_downloads=True)
    p2=ctx2.new_page(); p2.on('pageerror',lambda e: logs.append('PAGEERR2 '+str(e)))
    p2.goto(''+URL+'#backup'); p2.wait_for_selector('#importFile')
    p2.set_input_files('#importFile',OUT+'backup.json')
    p2.click('[data-choice="1"]'); p2.click('[data-choice=ok]')
    p2.wait_for_selector('.pcard')
    check(p2.locator('.pcard').count()==2,'import replace restores 2 projects on new device')
    d2=p2.evaluate("JSON.parse(localStorage.getItem('panellabels.v1'))")
    check(d2['electrician']['name'].startswith('Ηλεκτρολογικές') and d2['electrician']['logo'].startswith('data:image/png'),'electrician + logo restored')
    p2.locator('.pcard .open').filter(has_text='Παράδειγμα').click(); p2.wait_for_selector('.row-card')
    p2.screenshot(path=OUT+'8-desktop-editor.png',full_page=True)
    p2.goto(''+URL+'#print'); p2.wait_for_selector('#preview canvas'); p2.wait_for_timeout(400)
    p2.screenshot(path=OUT+'9-desktop-print.png',full_page=True)
    print('LOGS',logs)
    b.close()
def sizes(f):
    r=PdfReader(f); return [(round(float(pg.mediabox.width)*25.4/72,2),round(float(pg.mediabox.height)*25.4/72,2)) for pg in r.pages]
L=sizes(OUT+'labels.pdf'); print('labels',L); check(L and L[0]==(297.0,210.0),'labels PDF page is A4 landscape 297x210 mm')
C=sizes(OUT+'calib.pdf'); print('calib',C); check(C==[(210.0,297.0)],'calibration PDF A4 portrait')
Sz=sizes(OUT+'sticker.pdf'); print('sticker',Sz); check(Sz==[(210.0,297.0)],'sticker PDF A4')
R=sizes(OUT+'roll.pdf'); print('roll',R)
check(R[0]==(210.0,12.0) and R[1]==(210.0,12.0),'roll: row1 12 units (with fill) = 210 x 12 mm per strip')
print('\nFAILED:',errs if errs else 'none'); sys.exit(1 if errs else 0)
