import { revealCatalogFilters } from './catalog-helpers';
import { expect, test } from '@playwright/test';

test('older Canadian Sprinter stock retains its own bare-model price and unknown seating', async ({
  page,
}) => {
  await page.goto('/?compare=mercedes-ca-2025-2p144s,mercedes-ca-2026-dpvs2s');
  await revealCatalogFilters(page);
  const dialog = page.getByRole('dialog');
  const prices = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Base MSRP', exact: true }) });
  await expect(prices).toContainText('$80,200');
  await expect(prices).toContainText('$78,380');
  const seats = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Seats', exact: true }) });
  await expect(seats).toContainText('Not verified');
  await expect(seats).toContainText('12');
  await dialog.getByRole('button', { name: 'Close comparison' }).click();
  await revealCatalogFilters(page, true);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Mercedes-Benz');
  await page.getByLabel('Model year', { exact: true }).selectOption('2025');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Sprinter');
  await expect(page.getByRole('article')).toHaveCount(5);
  const high = page.locator('article[aria-labelledby="title-mercedes-ca-2025-2cv144h"]');
  const standard = page.locator('article[aria-labelledby="title-mercedes-ca-2025-2cv144s"]');
  await expect(high.locator('.price-row')).toContainText('$74,640');
  await expect(high).toContainText('High Output');
  await expect(standard.locator('.price-row')).toContainText('$70,660');
  await expect(standard).toContainText('Standard Output');
  await high.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    high.getByRole('link', { name: /Base MSRP: .*Source: Mercedes-Benz Canada/ }),
  ).toHaveAttribute(
    'href',
    'https://nafta-service.mbvans.com/api/byo/publish/en_ca/build/content/byo?brand=mb&year=2025&class=SPRINTER&model=2CV144H',
  );
  await expect(high).toContainText(
    'Confirm the selected equipment and dealer price for an individual stock vehicle',
  );
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('75000');
  await expect(page.getByRole('article')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Mercedes base comparisons retain exact Canadian prices, passenger seats and source links', async ({
  page,
}) => {
  await page.goto('/?compare=mercedes-ca-2027-glc300w4,mercedes-ca-2026-dpvh2l');
  await revealCatalogFilters(page);
  const dialog = page.getByRole('dialog');
  const prices = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Base MSRP', exact: true }) });
  await expect(prices).toContainText('$61,000');
  await expect(prices).toContainText('$92,310');
  const seats = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Seats', exact: true }) });
  await expect(seats).toContainText('5');
  await expect(seats).toContainText('15');
  await page.reload();
  await revealCatalogFilters(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close comparison' }).click();
  await revealCatalogFilters(page, true);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Mercedes-Benz');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Sprinter');
  await expect(page.getByRole('article')).toHaveCount(11);
  const van = page.locator('article[aria-labelledby="title-mercedes-ca-2026-dpvh2s"]');
  await expect(van.locator('.price-row')).toContainText('$82,420');
  await van.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    van.getByRole('link', { name: /Base MSRP: .*Source: Mercedes-Benz Canada/ }),
  ).toHaveAttribute(
    'href',
    'https://www.mercedes-benz-vans.ca/en/vehicles/build/sprinter/passenger-van/dpvh2s',
  );
  await expect(van).toContainText('12-Passenger');
  await expect(
    page.locator('article[aria-labelledby="title-mercedes-ca-2026-dcvs2s"]'),
  ).toContainText('Not verified');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Mercedes price conflicts remain visible and cannot pass a known-price budget filter', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page.getByLabel('Make', { exact: true }).selectOption('Mercedes-Benz');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('C 300 4MATIC');
  await expect(page.getByRole('article')).toHaveCount(1);
  const car = page.locator('article[aria-labelledby="title-mercedes-ca-2026-c300w4"]');
  await expect(car.locator('.price-row')).toContainText('Not verified');
  await car.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(car).toContainText('Canadian source conflict');
  await expect(car).toContainText('51650 CAD');
  await expect(car).toContainText('62250 CAD');
  await expect(
    car.getByRole('link', { name: /Base MSRP: .*Source: Mercedes-Benz Canada/ }),
  ).toHaveAttribute('href', 'https://www.mercedes-benz.ca/en/vehicles/build/c-class/sedan/c300w4');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('150000');
  await expect(page.getByRole('article')).toHaveCount(0);
});
