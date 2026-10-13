// Run inside Firestore Emulator; never contacts a production Firebase project.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { resolve } from 'node:path';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { manifest, syntheticState, syntheticUser } from './delayed-fx-fixture.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore Emulator is required');
const projectId = 'demo-assettrail-fx';
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
assert.ok(['127.0.0.1', 'localhost'].includes(host));
const env = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') } });
const server = createServer((req, res) => {
 const upstream = httpRequest({ hostname: host, port: Number(port), path: req.url, method: req.method, headers: req.headers }, incoming => {
  res.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(res);
 });
 upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
 res.on('close', () => upstream.destroy());
 req.pipe(upstream);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
let response = manifest();
const context = await browser.newContext({ timezoneId: 'Asia/Seoul' });
const errors = [], dialogs = [], external = [];
const timeout = setTimeout(() => { console.error('Browser integration timed out'); process.exit(1); }, 90000);
const bootstrap = `
import * as app from '/sdk/firebase-app.js';
import * as firestore from '/sdk/firebase-firestore.js';
window.firebaseConfig = { apiKey: 'test-only', projectId: '${projectId}', authDomain: 'localhost', appId: 'test-only' };
window.assetTrailCloudPushDelayMs = 10;
window.assetTrailFirebaseModules = {
 app, functions: {},
 firestore: { ...firestore, getFirestore(app) {
   const db = firestore.getFirestore(app);
   firestore.connectFirestoreEmulator(db, '127.0.0.1', ${server.address().port}, { mockUserToken: { sub: '${syntheticUser}', email: 'synthetic@example.invalid' } });
   return db;
 } },
 auth: { getAuth: () => ({}), GoogleAuthProvider: class {},
   getRedirectResult: async () => null,
   onAuthStateChanged: (_auth, callback) => { setTimeout(() => callback({ uid: '${syntheticUser}', email: 'synthetic@example.invalid' }), 0); }
 }
};`;
const routeHandler = async route => {
 const url = new URL(route.request().url());
 if (url.hostname === host && Number(url.port) === Number(port)) return route.continue();
 if (url.origin !== origin) { external.push(url.origin); return route.abort(); }
 const path = url.pathname;
 if (path.startsWith('/google.firestore.') || path.startsWith('/v1/')) return route.continue();
 if (path === '/symbols.json') return route.fulfill({ json: { generatedAt: response.generatedAt, symbols: { KRX: {}, US: {} } } });
 if (path === '/prices.json') { await new Promise(resolve => setTimeout(resolve, 100)); return route.fulfill({ json: response }); }
 if (path === '/firebase-config.js') return route.fulfill({ body: '', contentType: 'text/javascript' });
 if (path === '/__bootstrap.js') return route.fulfill({ body: bootstrap, contentType: 'text/javascript' });
 let file = path === '/' ? 'index.html' : path.slice(1);
 if (path.startsWith('/sdk/')) file = `node_modules/firebase/${path.split('/').at(-1)}`;
 try {
  let body = readFileSync(resolve(file));
  if (file.endsWith('.js')) {
   body = body.toString().replaceAll('https://www.gstatic.com/firebasejs/12.13.0/', '/sdk/');
   if (file === 'app.js') body = `await import('/__bootstrap.js');\n${body}\nwindow.browserFx = {
     ready: () => Boolean(cloud.docRef && historyStorage.ready && priceBook.loaded && !cloudPushInFlight),
     snapshots: () => JSON.parse(JSON.stringify(state.snapshots)), events: () => JSON.stringify(state.events),
     total: () => totalAssets(), load: () => initPrices(),
     remote: async () => (await readCloudStateConsistently(captureCloudContext())).data,
     flush: () => flushCloudPush(), busy: () => snapshotSaveInFlight,
     history: () => { setActiveView('JOURNAL'); renderHistory(); }
   };`;
  }
  return route.fulfill({ body, contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html' });
 } catch { console.log('test missing asset', path); return route.fulfill({ status: 404, body: '' }); }
};
await context.route('**/*', routeHandler);
await context.addInitScript(({ seed, user }) => {
 const RealDate = Date;
 window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-07-30T01:00:00Z'])); } static now() { return new RealDate('2026-07-30T01:00:00Z').getTime(); } };
 const key = `finance-ledger-retirement-v1:user:${user}`;
 if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed));
}, { seed: syntheticState, user: syntheticUser });
try {
 await env.clearFirestore();
 const page = await context.newPage();
 page.on('pageerror', e => { errors.push(String(e)); console.log('page error', String(e)); });
 page.on('console', m => { if (m.type() === 'error') console.log('browser error', m.text()); });
 page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
 await page.goto(origin);
 await page.waitForFunction(() => window.browserFx?.ready());
 await page.evaluate(() => browserFx.flush());
 const before = await page.evaluate(() => ({ snapshots: browserFx.snapshots(), events: browserFx.events() }));
 for (const width of [1440, 1280, 390, 430]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const view of ['DASHBOARD', 'ASSETS', 'JOURNAL', 'GOALS', 'SETTINGS']) {
   await page.locator(`[data-nav-view=${view}]`).first().click();
   assert.equal(await page.locator('#fxValuationNotice').isVisible(), false);
   assert.equal(await page.locator('#priceAlert').isVisible(), false);
   assert.doesNotMatch(await page.locator('body').innerText(), /잠정 평가 중입니다|이 금액과 환율 기준일|새 환율은 현재 평가에만/);
  }
  assert.equal(await page.locator('#currentFxDetails').getAttribute('open'), null);
  await page.locator('#currentFxDetails summary').click();
  assert.match(await page.locator('#currentFxEvidence').innerText(), /2026-07-29[\s\S]*yfinance KRW=X[\s\S]*조회 시각[\s\S]*환율 지연 · 잠정 평가/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `/tmp/assettrail-fx-details-${width}.png`, fullPage: true });
  await page.locator('#currentFxDetails summary').click();
 }

 await page.locator('[data-nav-view=ASSETS]').first().click();
 await page.locator('#snapshotBtn').click();
 await page.locator('#snapshotBtn').dispatchEvent('click');
 await page.waitForFunction(() => !browserFx.busy());
 await page.evaluate(() => browserFx.flush());
 assert.doesNotMatch(await page.locator('#appNotice').innerText(), /환율|잠정/);
 const remote = await page.evaluate(() => browserFx.remote());
 assert.equal(remote.schemaVersion, 10);
 assert.equal(remote.snapshots.length, 2);
 const saved = remote.snapshots.find(s => s.id !== 'prior-synthetic');
 assert.equal(saved.total, 260000);
 assert.equal(saved.valuation.fx.USDKRW.date, '2026-07-29');
 assert.equal(saved.valuation.fx.USDKRW.provisional, true);
 assert.equal(saved.valuation.fx.USDKRW.source, 'yfinance KRW=X');
 assert.equal(saved.valuation.fx.USDKRW.retrievedAt, '2026-07-30T00:00:01.000Z');
 assert.deepEqual(remote.snapshots.find(s => s.id === 'prior-synthetic'), before.snapshots[0]);
 // A new browser has no cached primary or IndexedDB. It must reload Firestore history chunks.
 const freshContext = await browser.newContext({ timezoneId: 'Asia/Seoul' });
 await freshContext.route('**/*', routeHandler);
 await freshContext.addInitScript(() => { const RealDate = Date; window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-07-30T01:00:00Z'])); } static now() { return new RealDate('2026-07-30T01:00:00Z').getTime(); } }; });
 const fresh = await freshContext.newPage();
 await fresh.goto(origin);
 await fresh.waitForFunction(() => window.browserFx?.ready());
 await fresh.waitForFunction(() => browserFx.snapshots().length === 2);
 assert.deepEqual(await fresh.evaluate(() => browserFx.snapshots()), remote.snapshots);
 response = manifest({ actual: '2026-07-30', rate: 1400, delayed: false });
 await page.evaluate(() => browserFx.load());
 assert.equal(await page.evaluate(() => browserFx.total()), 280000);
 assert.deepEqual(await page.evaluate(() => browserFx.snapshots()), remote.snapshots);
 assert.equal(await page.evaluate(() => browserFx.events()), before.events);
 await page.evaluate(() => browserFx.history());
 for (const width of [1440, 1280, 390, 430]) {
  await page.setViewportSize({ width, height: 1000 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
  assert.match(await page.locator('#historyRows').innerText(), /환율 지연.*잠정 평가[\s\S]*2026-07-29/);
  await page.locator('.snapshot-fx-evidence summary').click();
  assert.match(await page.locator('.snapshot-fx-evidence').innerText(), /yfinance KRW=X/);
  await page.screenshot({ path: `/tmp/assettrail-fx-history-${width}.png`, fullPage: true });
  await page.locator('.snapshot-fx-evidence summary').click();
 }
 const primaryPath = `users/${syntheticUser}/financeData/primary`;
 const ownerDb = env.authenticatedContext(syntheticUser).firestore();
 const primary = (await getDoc(doc(ownerDb, primaryPath))).data();
 const historyId = primary.historyMeta.activeHistoryId;
 const { getDocs, collection } = await import('firebase/firestore');
 const chunks = await getDocs(collection(ownerDb, `${primaryPath}/histories/${historyId}/chunks`));
 const chunk = chunks.docs.find(d => d.data().kind === 'SNAPSHOT');
 for (const db of [env.authenticatedContext('unauthorized-test-user').firestore(), env.unauthenticatedContext().firestore()]) {
  await assertFails(setDoc(doc(db, primaryPath), primary));
  await assertFails(setDoc(doc(db, chunk.ref.path), chunk.data()));
  await assertFails(getDoc(doc(db, chunk.ref.path)));
 }
 assert.deepEqual(dialogs, []);
 assert.deepEqual(errors, []);
 assert.deepEqual(external.filter(x => !x.includes('fonts.googleapis.com') && !x.includes('fonts.gstatic.com') && !x.includes('cdn.jsdelivr.net')), []);
 console.log('PASS: Chromium click → IndexedDB → real Firestore Rules/chunks → app readback; duplicate click, FX provenance, recovery, historical immutability, 4 widths, no global/asset FX delay banners or repeated success notices, accessible current FX details, unauthorized/guest denial.');
} finally {
 clearTimeout(timeout); await browser.close(); await env.cleanup(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
