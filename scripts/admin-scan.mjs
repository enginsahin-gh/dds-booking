import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://mijn.bellure.nl';
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD');
  process.exit(1);
}

const outDir = '/root/.openclaw/workspace-zyro/exports/admin-scan';
await fs.mkdir(outDir, { recursive: true });

const pages = [
  { name: 'dashboard', url: `${BASE_URL}/admin` },
  { name: 'bookings', url: `${BASE_URL}/admin/bookings` },
  { name: 'communicatie', url: `${BASE_URL}/admin/communicatie` },
  { name: 'services', url: `${BASE_URL}/admin/services` },
  { name: 'staff', url: `${BASE_URL}/admin/staff` },
  { name: 'customers', url: `${BASE_URL}/admin/customers` },
  { name: 'waitlist', url: `${BASE_URL}/admin/waitlist` },
  { name: 'stats', url: `${BASE_URL}/admin/stats` },
  { name: 'settings', url: `${BASE_URL}/admin/settings` },
  { name: 'users', url: `${BASE_URL}/admin/users` },
];

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    errors.push({ type: 'console', text: msg.text() });
  }
});
page.on('pageerror', (err) => {
  errors.push({ type: 'pageerror', text: err.message });
});

// Login
await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL('**/admin', { timeout: 20000 });

// Scan pages
for (const item of pages) {
  await page.goto(item.url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const filename = path.join(outDir, `${item.name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
}

await browser.close();

const reportPath = path.join(outDir, 'report.json');
await fs.writeFile(reportPath, JSON.stringify({ errors, pages: pages.map(p => p.name) }, null, 2));

console.log(`Saved screenshots to ${outDir}`);
console.log(`Errors captured: ${errors.length}`);
