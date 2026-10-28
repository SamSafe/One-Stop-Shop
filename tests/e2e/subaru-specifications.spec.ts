import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { revealCatalogFilters } from './catalog-helpers';

test('new BRZ factory trim retains base MSRP and distinct reviewed manual/automatic ratings', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page.getByRole('searchbox', { name: 'Search cars', exact: true }).fill('2027 Subaru BRZ');
  await expect(page.getByRole('article')).toHaveCount(4);
  const special = page.getByRole('article').filter({ hasText: 'Kagayaki Edition' });
  await expect(special).toContainText('$39,995');
  await expect(special.locator('.fit-score > strong')).not.toContainText('—');
  await special.getByRole('button', { name: 'Specs & sources', exact: true }).click();
  await expect(special.getByRole('link', { name: /^Base MSRP:/ })).toHaveAttribute(
    'href',
    /CarID=1625/,
  );
  await expect(special.getByRole('link', { name: /^Combined consumption:/ })).toHaveAttribute(
    'href',
    /VehicleReport\/31326$/,
  );
  await special.getByRole('checkbox', { name: /^Compare / }).check();
  await page
    .getByRole('article')
    .filter({ hasText: 'Sport-tech (AT)' })
    .getByRole('checkbox', { name: /^Compare / })
    .check();
  await page.getByRole('button', { name: 'Compare 2 cars', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Compare specifications', exact: true });
  await expect(dialog.getByRole('row', { name: /^Combined consumption/ })).toContainText('10.5');
  await expect(dialog.getByRole('row', { name: /^Combined consumption/ })).toContainText('9.6');
  await expect(dialog.getByRole('link', { name: /^Combined consumption: 9.6/ })).toHaveAttribute(
    'href',
    /VehicleReport\/31325$/,
  );
  await page.goto('/?compare=subaru-ca-1625,nrcan-31326');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('row', { name: /^Combined consumption/ })).toContainText('10.5');
  expect(new URL(page.url()).searchParams.get('compare')).toBe('subaru-ca-1625,nrcan-31326');
});

test('Subaru EVs show bounded range and peak power while missing consumption remains unscored', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByRole('searchbox', { name: 'Search cars', exact: true })
    .fill('2027 Subaru Uncharted');
  await expect(page.getByRole('article')).toHaveCount(4);
  const selected = page.getByRole('article').filter({ has: page.locator('#title-subaru-ca-1606') });
  await selected.getByRole('button', { name: 'Specs & sources', exact: true }).click();
  await expect(
    selected.getByRole('link', { name: /^Electric driving range: Up to 399 km/ }),
  ).toBeVisible();
  await expect(selected.getByRole('link', { name: /^Power: 165 hp/ })).toBeVisible();
  await expect(selected.locator('.fit-score > strong')).toContainText('—');
  await expect(selected).toContainText('no kWh/100 km consumption');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/?compare=subaru-ca-1606,subaru-ca-1608');
  const dialog = page.getByRole('dialog', { name: 'Compare specifications', exact: true });
  await expect(dialog.getByLabel('Show source notes', { exact: true })).not.toBeChecked();
  await expect(dialog.getByRole('row', { name: /^Electric driving range/ })).toContainText(
    'Up to 399 km',
  );
  await dialog.getByLabel('Hide matching specs', { exact: true }).check();
  await expect(dialog.getByRole('row', { name: /^Electric driving range/ })).toBeVisible();
});

test('conflicting WRX fuel units and incomplete Outback cylinder evidence stay explicit', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  const search = page.getByRole('searchbox', { name: 'Search cars', exact: true });
  await search.fill('2026 Subaru WRX GT');
  await expect(page.getByRole('article')).toHaveCount(1);
  let car = page.getByRole('article');
  await car.getByRole('button', { name: 'Specs & sources', exact: true }).click();
  await expect(car).toContainText('Source conflict');
  await expect(car.locator('.fit-score > strong')).toContainText('—');
  await expect(
    car.getByRole('link', { name: /^Highway consumption: Not verified/ }),
  ).toHaveAttribute('href', /subaru\.ca/);
  await search.fill('2026 Subaru Outback Touring');
  await expect(page.getByRole('article')).toHaveCount(1);
  car = page.getByRole('article');
  await expect(car.locator('.fit-score > strong')).toContainText('—');
  await car.getByRole('button', { name: 'Specs & sources', exact: true }).click();
  await expect(
    car.getByRole('link', { name: /^Combined consumption: Not verified/ }),
  ).toHaveAttribute('href', /subaru\.ca/);
});
