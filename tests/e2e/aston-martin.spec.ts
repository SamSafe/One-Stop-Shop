import { revealCatalogFilters } from './catalog-helpers';
import { expect, test } from '@playwright/test';

test('Aston Martin listings preserve unknown years and prices and withhold stock-only and future products', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Make', { exact: true }).selectOption('Aston Martin');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await expect(page.getByRole('article')).toHaveCount(9);
  await expect(page.getByRole('article').filter({ hasText: 'Valen' })).toHaveCount(0);
  await expect(page.getByRole('article').filter({ hasText: 'DBX707' })).toHaveCount(0);
  const vantage = page.locator('article[aria-labelledby="title-aston-martin-ca-am662"]');
  await expect(vantage.locator('.car-make')).toHaveText('Year not verified Aston Martin');
  await expect(vantage.locator('.price-row')).toContainText('Not verified');
  await vantage.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(vantage).toContainText('671 bhp');
  await expect(vantage).toContainText('No Canadian currency or price');
  await expect(
    vantage.getByRole('link', { name: /Power: .*Source: Aston Martin/ }),
  ).toHaveAttribute(
    'href',
    'https://configurator.astonmartin.com/static/assets/translations/en.json',
  );
  await page.getByLabel('Model year', { exact: true }).selectOption('unverified');
  await expect(page.getByRole('article')).toHaveCount(9);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByLabel('Record type', { exact: true }).selectOption('manufacturer-offer');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('75000');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.goto('/?compare=aston-martin-ca-am662,aston-martin-ca-am003a');
  await revealCatalogFilters(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('columnheader').nth(1)).toContainText('Year not verified');
  await expect(dialog).toContainText('Manufacturer offer; model year not verified.');
  const price = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Base MSRP', exact: true }) });
  await expect(price.getByRole('cell').nth(0)).toContainText('Not verified');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
