import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const baseUrl = process.env.CAPTURE_BASE_URL || 'http://127.0.0.1:4173/';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const screenshotDir = path.join(rootDir, 'docs', 'preview');
const publicDir = path.join(rootDir, 'public');

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.getByText('Exact product verified').waitFor({ state: 'visible' });
await page.screenshot({
  path: path.join(screenshotDir, 'app-screenshot.png'),
  fullPage: true,
});
await page.screenshot({
  path: path.join(publicDir, 'social-preview.png'),
  clip: {
    x: 0,
    y: 0,
    width: 1280,
    height: 640,
  },
});

await browser.close();
console.log(`Captured preview assets from ${baseUrl}`);
