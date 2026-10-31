import { revealCatalogFilters } from './catalog-helpers';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Porsche rear seats and manual/PDK choices retain distinct identities and native MSRP', async ({
  page,
}) => {
  await page.goto(
    '/?compare=porsche-ca-9921b2-2027-g1f-base,porsche-ca-9921b2-2027-g1f-rear,porsche-ca-982120-2025-250-base,porsche-ca-982120-2025-480-base',
  );
  await revealCatalogFilters(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const seats = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Seats', exact: true }) });
  await expect(
    seats
      .getByRole('cell')
      .nth(0)
      .getByRole('link', { name: /^Seats: 2 people\./ }),
  ).toBeVisible();
  await expect(
    seats
      .getByRole('cell')
      .nth(1)
      .getByRole('link', { name: /^Seats: 4 people\./ }),
  ).toBeVisible();
  const prices = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Base MSRP', exact: true }) });
  await expect(prices).toContainText('$144,900');
  await expect(prices).toContainText('$79,500');
  await expect(dialog.getByRole('columnheader').nth(3)).toContainText('PDK');
  await expect(dialog.getByRole('columnheader').nth(4)).toContainText('manual');
  await page.reload();
  await revealCatalogFilters(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close comparison' }).click();
  await revealCatalogFilters(page, true);
  await page.getByLabel('Make', { exact: true }).selectOption('Porsche');
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Model year', { exact: true }).selectOption('2025');
  await page
    .getByRole('searchbox', { name: 'Search cars' })
    .fill('"2025 Porsche 718 Boxster 6-speed"');
  await expect(page.getByRole('article')).toHaveCount(1);
  const manual = page.locator('article[aria-labelledby="title-porsche-ca-982320-2025-480-base"]');
  await expect(manual.locator('.price-row')).toContainText('$81,900');
  await manual.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    manual.getByRole('link', { name: /Base MSRP: .*Source: Porsche Canada/ }),
  ).toHaveAttribute('href', /optionAdded=480/);
  await expect(manual).toContainText('Destination, dealer fees');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Porsche powertrain filters preserve qualified power and the menu-only allocation gap', async ({
  page,
}) => {
  await page.goto('/?trims=all');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page.getByLabel('Make', { exact: true }).selectOption('Porsche');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Electric');
  await expect(page.getByRole('article')).toHaveCount(17);
  const macan = page.locator('article[aria-labelledby="title-porsche-ca-xabbb1-2027-g1z-base"]');
  await expect(macan.locator('.price-row')).toContainText('$105,900');
  await macan.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(macan).toContainText('382 hp');
  await expect(macan).toContainText('non-overboost');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Plug-in hybrid');
  await expect(page.getByRole('article')).toHaveCount(10);
  const panamera = page.locator('article[aria-labelledby="title-porsche-ca-yaabe1-2027-g1g-base"]');
  await panamera.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(panamera).toContainText('463 hp');
  await expect(panamera).toContainText('Combined system output');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('all');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('911 GT3 90 F. A. Porsche');
  await expect(page.getByRole('article')).toHaveCount(1);
  const special = page.locator('article[aria-labelledby="title-porsche-ca-992902-2027-menu"]');
  await expect(special.locator('.price-row')).toContainText('Not verified');
  await special.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(special).toContainText('current allocation');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('150000');
  await expect(page.getByRole('article')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Porsche menu-only specifications and source qualifications remain accessible', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page.getByLabel('Make', { exact: true }).selectOption('Porsche');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('911 GT3 90 F. A. Porsche');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('article').getByRole('button', { name: 'Specs & sources' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
