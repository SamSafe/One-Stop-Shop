import { test, expect } from '@playwright/test';

const catalogAsset = /\/assets\/catalog-[^/]+\.json$/;
test('shows loading feedback while the validated catalog arrives, then opens the complete catalog', async ({
  page,
}) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(catalogAsset, async (route) => {
    await waiting;
    await route.continue();
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status')).toContainText('Loading Canadian vehicles');
    await expect(page.getByRole('article')).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByRole('searchbox', { name: 'Search cars' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(30);
  await expect(page.getByRole('heading', { name: 'Loading Canadian vehicles…' })).toHaveCount(0);
});

test('catalog delivery failure offers recovery without erasing saved data or showing a misleading empty catalog', async ({
  page,
}) => {
  const saved = JSON.stringify({ version: 2, ids: ['future-car'], note: 'Keep my shortlist' });
  await page.addInitScript((value) => localStorage.setItem('oss-shortlist-v1', value), saved);
  await page.route(catalogAsset, (route) =>
    route.fulfill({ status: 503, contentType: 'text/plain', body: 'Temporarily unavailable' }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Something took a wrong turn.' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('oss-shortlist-v1'))).toBe(saved);
  await page.unroute(catalogAsset);
  await page.getByRole('link', { name: 'Reload OSS' }).click();
  await expect(page.getByRole('searchbox', { name: 'Search cars' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(30);
  expect(await page.evaluate(() => localStorage.getItem('oss-shortlist-v1'))).toBe(saved);
});
