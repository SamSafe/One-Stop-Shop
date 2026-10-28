import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { revealCatalogFilters } from './catalog-helpers';

test('energy estimates separate fuel and electricity and keep per-distance costs independent of annual distance', async ({
  page,
}) => {
  await page.goto('/?compare=nrcan-29063,nrcan-29292');
  const dialog = page.getByRole('dialog');
  const costs = dialog.getByRole('row', { name: /^Estimated energy \/100 km/ });
  const ev = costs.getByRole('cell').nth(0);
  const plugIn = costs.getByRole('cell').nth(1);
  await expect(ev).toContainText('$2.16');
  await expect(ev).toContainText('Electricity: 14.4 kWh · $2.16');
  await expect(ev).not.toContainText('Fuel:');
  await dialog.getByLabel('Plug-in electric-mode driving · %', { exact: true }).fill('100');
  await expect(plugIn).toContainText('Fuel: 6.1 L · $9.76');
  await expect(plugIn).toContainText('Electricity: 49.7 kWh · $7.46');
  await expect(plugIn.locator('strong')).toHaveText('$17.22');
  const annual = dialog.getByRole('row', { name: /^Estimated annual energy/ });
  await dialog.getByLabel('Annual kilometres', { exact: true }).fill('0');
  await expect(annual.getByRole('cell').nth(0)).toHaveText('$0');
  await expect(annual.getByRole('cell').nth(1)).toHaveText('$0');
  await expect(ev.locator('strong')).toHaveText('$2.16');
  await dialog.getByLabel('Annual kilometres', { exact: true }).fill('');
  await expect(annual).toContainText('Not available');
  await expect(plugIn.locator('strong')).toHaveText('$17.22');
  await dialog.getByLabel('Gas price / fuel price · CAD / litre', { exact: true }).fill('');
  await expect(plugIn).toContainText('Enter a fuel price from $0.01 to $5 per litre.');
  await expect(plugIn.locator('strong')).toHaveText('Not available');
  await expect(plugIn).not.toContainText('Fuel:');
  await expect(ev.locator('strong')).toHaveText('$2.16');
});

test('inapplicable energy fields stay distinct from missing facts and exact source links remain available', async ({
  page,
}) => {
  await page.goto('/?compare=honda-cr-v-2026-lx-fwd,nrcan-29063');
  const dialog = page.getByRole('dialog');
  const fuel = dialog.getByRole('row', { name: /^Combined consumption/ });
  await expect(fuel.getByRole('cell').nth(1)).toContainText('Not applicable');
  const electricity = dialog.getByRole('row', { name: /^Electric consumption/ });
  await expect(electricity.getByRole('cell').nth(0)).toContainText('Not applicable');
  await expect(electricity.getByRole('link')).toHaveAttribute('href', /VehicleReport\/29063$/);
  await dialog.getByLabel('Show source notes', { exact: true }).check();
  await expect(fuel).toContainText('Battery-electric propulsion does not use liquid fuel.');
  await dialog.getByLabel('Show source notes', { exact: true }).uncheck();
  await dialog.getByLabel('Hide matching specs', { exact: true }).check();
  await expect(electricity).toBeVisible();
  await expect(
    dialog.getByRole('row', { name: /^Fuel used in plug-in electric mode/ }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto('/?compare=subaru-ca-1606,subaru-ca-1608');
  await dialog.getByLabel('Hide matching specs', { exact: true }).check();
  await expect(dialog.getByRole('row', { name: /^Combined consumption/ })).toHaveCount(0);
  await expect(electricity).toContainText('Not verified');
  await expect(electricity.getByRole('link').first()).toHaveAttribute('href', /subaru\.ca/);
  await expect(dialog.getByRole('row', { name: /^Estimated energy \/100 km/ })).toContainText(
    'Electric consumption (kWh/100 km) has not been verified.',
  );
});

test('catalog cards expose energy cost and missing consumption before opening specifications', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  const search = page.getByRole('searchbox', { name: 'Search cars', exact: true });
  await search.fill('2026 Honda CR-V LX FWD');
  await expect(page.getByRole('article')).toHaveCount(1);
  const cost = page.getByRole('article').locator('.card-energy-cost');
  await expect(cost).toContainText('Estimated energy · CAD /100 km');
  await expect(cost).toContainText('$12.48');
  await page.getByLabel('Fuel unit price for ranking · CAD / litre', { exact: true }).fill('3.2');
  await expect(cost).toContainText('$24.96');
  await page.getByLabel('Annual distance for ranking · km', { exact: true }).fill('');
  await expect(cost).toContainText('$24.96');
  await search.fill('2027 Subaru Uncharted FWD');
  const first = page.getByRole('article').filter({ has: page.locator('#title-subaru-ca-1606') });
  await expect(first.locator('.card-energy-cost')).toContainText(
    'Electric consumption (kWh/100 km) has not been verified.',
  );
  await first.getByRole('button', { name: 'Specs & sources', exact: true }).click();
  await expect(first.getByRole('link', { name: /^Combined consumption:/ })).toHaveCount(0);
  await expect(first.locator('.expanded-specs')).toContainText('Not applicable');
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
