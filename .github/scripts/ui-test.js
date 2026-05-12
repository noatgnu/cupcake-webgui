'use strict';

const { chromium } = require('playwright');

const TIMEOUT = parseInt(process.env.UI_TIMEOUT || '30000');
const LOGIN_TIMEOUT = parseInt(process.env.LOGIN_TIMEOUT || '60000');
let passed = 0;
let failed = 0;

async function testFrontend(name, url, postLoginCheck) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const jsErrors = [];
  const failedRequests = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('requestfailed', r => failedRequests.push(`${r.method()} ${r.url()}`));

  console.log(`\n--- ${name} ---`);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: TIMEOUT });
    await page.waitForURL(/\/login/, { timeout: TIMEOUT });
    console.log('PASS: redirected to /login');

    await page.waitForSelector('app-root', { timeout: TIMEOUT });
    console.log('PASS: Angular app bootstrapped');

    await page.waitForSelector('#username', { timeout: TIMEOUT });
    await page.waitForSelector('#password', { timeout: TIMEOUT });
    console.log('PASS: login form visible');

    await page.fill('#username', 'admin');
    await page.fill('#password', 'cupcake');
    await page.click('button[type="submit"]');
    console.log('PASS: credentials submitted');

    await page.waitForURL(u => !u.toString().includes('/login'), { timeout: LOGIN_TIMEOUT })
      .catch(async () => {
        const errorAlert = await page.locator('.alert-danger').first().textContent().catch(() => null);
        const networkErrs = failedRequests.join(', ') || 'none';
        throw new Error(
          `Post-login navigation timeout (${LOGIN_TIMEOUT}ms). ` +
          `URL: ${page.url()}. ` +
          `Error alert: "${errorAlert ?? 'none'}". ` +
          `Failed requests: ${networkErrs}`
        );
      });
    console.log('PASS: navigated after login');

    await postLoginCheck(page);

    if (jsErrors.length > 0)
      console.warn(`WARN: ${jsErrors.length} JS error(s): ${jsErrors[0]}`);
    if (failedRequests.length > 0)
      console.warn(`WARN: failed requests: ${failedRequests.join(', ')}`);

    passed++;
    console.log(`PASS: ${name} OK`);
  } catch (e) {
    failed++;
    console.error(`FAIL: ${name}: ${e.message}`);
    await page.screenshot({ path: `screenshot-${name}.png`, fullPage: true });
  } finally {
    await context.close();
    await browser.close();
  }
}

(async () => {
  await testFrontend('webgui', 'https://cupcake.local/', async page => {
    await page.waitForSelector('app-sidebar', { timeout: TIMEOUT });
    console.log('PASS: sidebar rendered');
    const body = await page.locator('body').textContent();
    if (!body.includes('Dashboard')) throw new Error('Dashboard text not found');
    console.log('PASS: Dashboard visible');
  });

  await testFrontend('vanilla-ng', 'https://vanilla.local/', async page => {
    await page.waitForSelector('app-navbar', { timeout: TIMEOUT });
    console.log('PASS: navbar rendered');
  });

  console.log(`\n=== UI smoke test: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
})();
