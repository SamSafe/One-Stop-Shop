import { revealCatalogFilters } from './catalog-helpers';
import { expect, test } from '@playwright/test';

test('McLaren Canadian factory years stay distinct from unknown prices and unresolved stock and special models', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Make', { exact: true }).selectOption('McLaren');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await expect(page.getByRole('article')).toHaveCount(5);
  const artura = page.locator('article[aria-labelledby="title-mclaren-ca-artura-2027"]');
  await expect(artura.locator('.car-make')).toHaveText('2027 McLaren');
  await expect(artura.locator('.price-row')).toContainText('Not verified');
  await artura.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(artura).toContainText('explicitly disables price display');
  await expect(artura.getByRole('link', { name: 'Manufacturer specifications' })).toHaveAttribute(
    'href',
    'https://configurator.mclaren.com/mclaren-ui/?model/artura',
  );
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await expect(page.getByRole('article')).toHaveCount(5);
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('75000');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.goto('/?compare=mclaren-ca-artura-2027,mclaren-ca-gts-2027');
  await revealCatalogFilters(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('columnheader').nth(1)).toContainText('2027');
  const price = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Base MSRP', exact: true }) });
  await expect(price.getByRole('cell').nth(0)).toContainText('Not verified');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
