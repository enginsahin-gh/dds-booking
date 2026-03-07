import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const URL = 'https://booking.bellure.nl/salon-amara';
const outDir = '/root/.openclaw/workspace-zyro/exports/booking-proof';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.screenshot({ path: path.join(outDir, 'step-0-initial.png'), fullPage: true });
// Open first category if needed
await page.waitForSelector('.bellure-category-header', { timeout: 20000 });
await page.locator('.bellure-category-header').first().click();

await page.waitForSelector('.bellure-service-card', { timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, 'step-1-services.png'), fullPage: true });

// Select first service
await page.locator('.bellure-service-card').first().click();
await page.waitForSelector('.bellure-selection-footer .bellure-btn-primary', { timeout: 10000 });
await page.locator('.bellure-selection-footer .bellure-btn-primary').click();

// Step 2: staff
await page.waitForSelector('.bellure-staff-grid', { timeout: 15000 });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, 'step-2-staff.png'), fullPage: true });

// Select first staff (not no-preference)
const staffCards = page.locator('.bellure-staff-card:not(.bellure-no-preference)');
if (await staffCards.count() > 0) {
  await staffCards.first().click();
} else {
  await page.locator('.bellure-staff-card').first().click();
}

// Step 3: date/time
await page.waitForSelector('.bellure-slots', { timeout: 15000 });
await page.waitForTimeout(800);

// Select first available slot
const slot = page.locator('.bellure-slot');
if (await slot.count() > 0) {
  await slot.first().click();
}
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, 'step-3-time.png'), fullPage: true });

// Go to step 4
const nextBtn = page.locator('button.bellure-btn-primary', { hasText: 'Verder' });
if (await nextBtn.count() > 0) {
  await nextBtn.first().click();
}

// Step 4: customer data
await page.waitForSelector('.bellure-form-input', { timeout: 15000 });
await page.fill('input[placeholder="Je volledige naam"]', 'Test Klant');
await page.fill('input[placeholder="06 12345678"]', '0612345678');
await page.fill('input[placeholder="je@email.nl"]', 'testklant@bellure.nl');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, 'step-4-details.png'), fullPage: true });

await browser.close();
console.log(`Saved booking proof to ${outDir}`);
