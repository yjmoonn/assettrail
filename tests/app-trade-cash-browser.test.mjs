import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = process.cwd();
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/firebase-config.js') { res.setHeader('content-type','text/javascript'); return res.end('window.firebaseConfig = {};'); }
    if (pathname === '/prices.json') { res.setHeader('content-type','application/json'); return res.end(JSON.stringify({ generatedAt:new Date().toISOString(), prices:{KRX:{'005930':{close:15000,date:'2026-11-06',name:'테스트 주식'}},US:{}}, fx:{USDKRW:{rate:1300,date:'2026-11-06'}}, errors:[] })); }
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/json');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true });
const evidenceDir = process.env.EVIDENCE_DIR || '/tmp/assettrail-trade-cash-ui';
await mkdir(evidenceDir,{recursive:true});
try {
  for (const width of [1440,1280,430,390]) {
    const context = await browser.newContext({viewport:{width,height:1000},timezoneId:'Asia/Seoul'});
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addInitScript(() => {
      if (localStorage.getItem('finance-ledger-retirement-v1')) return;
      localStorage.setItem('finance-ledger-retirement-v1',JSON.stringify({schemaVersion:4,assets:[{id:'stock-test',type:'KRX',name:'테스트 주식',ticker:'005930',account:'테스트증권',quantity:10,averagePrice:10000}],snapshots:[],meta:{lastSavedAt:'2026-08-01T00:00:00.000Z'}}));
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { errors.push(dialog.message()); await dialog.dismiss(); });
    await page.goto(origin);
    await page.getByRole('button',{name:'자산',exact:true}).click();
    await page.getByRole('button',{name:'테스트 주식 매도 기록',exact:true}).click();
    await page.getByRole('textbox',{name:'매도수량',exact:true}).fill('2');
    await page.getByRole('textbox',{name:'매도가',exact:true}).fill('15000');
    await page.getByRole('textbox',{name:'수수료',exact:true}).fill('100');
    await page.getByRole('textbox',{name:'세금',exact:true}).fill('50');
    await page.getByRole('button',{name:'매도 기록 저장',exact:true}).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('finance-ledger-retirement-v1')).assets.some(a=>a.type==='CASH'&&a.amount===29850));
    await page.getByRole('button',{name:'테스트 주식 추가매수',exact:true}).click();
    await page.getByRole('textbox',{name:'추가수량',exact:true}).fill('5');
    await page.getByRole('textbox',{name:'매수가',exact:true}).fill('12000');
    await page.getByRole('textbox',{name:'수수료',exact:true}).fill('100');
    await page.screenshot({path:`${evidenceDir}/buy-${width}.png`,fullPage:false});
    await page.getByRole('button',{name:'추가매수 저장',exact:true}).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('finance-ledger-retirement-v1')).assets.some(a=>a.type==='CASH'&&a.amount===-30250));
    await page.reload();
    await page.getByRole('button',{name:'자산',exact:true}).click();
    const stored = await page.evaluate(()=>JSON.parse(localStorage.getItem('finance-ledger-retirement-v1')));
    assert.equal(stored.assets.find(a=>a.id==='stock-test').quantity,13);
    assert.equal(stored.assets.filter(a=>a.type==='CASH').length,1);
    assert.equal(stored.assets.find(a=>a.type==='CASH').cashBalanceKnown,false);
    assert.equal(stored.events.some(e=>e.type==='DEPOSIT'),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
    assert.deepEqual(errors,[],`browser errors at ${width}`);
    await page.screenshot({path:`${evidenceDir}/saved-${width}.png`,fullPage:false});
    await context.close();
    console.log(`trade cash browser ${width}px passed`);
  }
} finally { await browser.close(); server.close(); }
