import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const snapshot = JSON.parse(readFileSync('packages/car-catalog/data/nrcan.json', 'utf8')) as {
  records: { Make: string; Year: number; VehicleTypeId: string }[];
};

test('full catalog is paged, retains a shortlist across pages, and supports make/year/powertrain filters', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('article')).toHaveCount(30);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.locator('.results-caption')).toContainText('records for your consideration');
  const save = page.getByRole('button', { name: /^Save / }).first();
  const name = await save.getAttribute('aria-label');
  await save.click();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Result pages' })).toContainText('Page 2');
  await expect(page.getByRole('article')).toHaveCount(30);
  await page.getByLabel('Only my shortlist').check();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: name!.replace(/^Save /, 'Unsave '), exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByLabel('Make', { exact: true }).selectOption('Tesla');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Electric');
  const expected = snapshot.records.filter(
    (car) => car.Make === 'Tesla' && car.Year === 2027 && car.VehicleTypeId === 'BEV',
  );
  expect(expected.length).toBeGreaterThan(0);
  await expect(page.getByRole('article')).toHaveCount(Math.min(30, expected.length));
  await expect(page.getByRole('article').first()).toContainText('retail trim not checked');
  await expect(page.getByRole('article').first()).toContainText('kWh/100 km');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('price limits exclude unverified prices without hiding them by default', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('50000');
  await expect(page.locator('.price-row').filter({ hasText: 'Not verified' })).toHaveCount(0);
  const pricedCount = Number(
    (await page.locator('.results-caption').innerText()).match(/^\d+/)?.[0],
  );
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('all');
  await expect
    .poll(async () =>
      Number((await page.locator('.results-caption').innerText()).match(/^\d+/)?.[0]),
    )
    .toBeGreaterThanOrEqual(snapshot.records.length);
  const fullCount = Number((await page.locator('.results-caption').innerText()).match(/^\d+/)?.[0]);
  expect(fullCount).toBeGreaterThan(pricedCount);
});

test('EV and plug-in comparisons show electricity and electric-mode fuel costs with exact source links', async ({
  page,
}) => {
  await page.goto('/?compare=nrcan-29063,nrcan-29292');
  await expect(page.getByRole('dialog')).toBeVisible();
  const row = page.getByRole('row', { name: /Estimated annual energy/ });
  await expect(row).toContainText('$324');
  await expect(row).toContainText('$3,679');
  await page.getByLabel('Plug-in electric-mode driving · %', { exact: true }).fill('100');
  await expect(row).toContainText('$2,582');
  await page.getByLabel('Electricity · CAD / kWh', { exact: true }).fill('0.30');
  await expect(row).toContainText('$648');
  await expect(
    page.getByRole('link', { name: /Fuel used in plug-in electric mode: 6.1/ }),
  ).toHaveAttribute('href', 'https://fcr-ccc.nrcan-rncan.gc.ca/en/VehicleReport/29292');
  await expect(page.getByRole('row', { name: 'Record and availability' })).toContainText(
    'current availability',
  );
});

test('manufacturer-listed Toyota packages retain their own MSRP and published specifications', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Make', { exact: true }).selectOption('Toyota');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Corolla LE CVT');
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('article').filter({ hasText: 'Standard Package' })).toContainText(
    '$26,200',
  );
  await expect(page.getByRole('article').filter({ hasText: 'LE Upgrade' })).toContainText(
    '$28,319',
  );
  await expect(page.getByRole('article').first()).toContainText('6.7');
  await page.getByRole('button', { name: 'Specs & sources' }).first().click();
  await expect(
    page.getByRole('link', { name: /Base MSRP: .*Source: Toyota Canada/ }),
  ).toHaveAttribute('href', /^https:\/\/www\.toyota\.ca\/graphql\/execute/);
});
