import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('VinFast price cards distinguish year-unverified offers from year-qualified retail profiles', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Make', { exact: true }).selectOption('VinFast');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await expect(page.getByRole('article')).toHaveCount(4);
  const eco = page.locator('article[aria-labelledby="title-vinfast-ca-vf8-eco"]');
  await expect(eco.locator('.car-make')).toHaveText('Year not verified VinFast');
  await expect(eco.locator('.price-row')).toContainText('$54,490');
  await expect(eco).toContainText('Manufacturer offer · model year unverified');
  await eco.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(eco).toContainText('not assigned to any particular model year');
  await expect(
    eco.getByRole('link', { name: /Base MSRP: .*Source: VinFast Canada/ }),
  ).toHaveAttribute('href', 'https://vinfastauto.ca/en/vehicles/vf-8');
  await page.getByLabel('Model year', { exact: true }).selectOption('unverified');
  await expect(page.getByRole('article')).toHaveCount(3);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByLabel('Model year', { exact: true }).selectOption('all');
  await expect(page.getByRole('article')).toHaveCount(1);
  const known = page.locator('article[aria-labelledby="title-vinfast-ca-vf9-eco"]');
  await expect(known.locator('.car-make')).toHaveText('2024 VinFast');
  await expect(known.locator('.price-row')).toContainText('$74,890');
  await page.getByLabel('Record type', { exact: true }).selectOption('manufacturer-offer');
  await expect(page.getByRole('article')).toHaveCount(3);
  await page.getByLabel('Record type', { exact: true }).selectOption('all');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('75000');
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(known).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('year-unverified offers retain their labels, unknown facts and stable links through comparisons and shortlists', async ({
  page,
}) => {
  await page.goto('/?compare=vinfast-ca-vf8-plus,vinfast-ca-vf9-eco');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('columnheader').nth(1)).toContainText('Year not verified');
  await expect(dialog.getByRole('columnheader').nth(2)).toContainText('2024');
  const prices = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Base MSRP', exact: true }) });
  await expect(prices).toContainText('$61,490');
  await expect(prices).toContainText('$74,890');
  const seats = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Seats', exact: true }) });
  await expect(seats.getByRole('cell').nth(0)).toContainText('Not verified');
  await expect(dialog).toContainText('Manufacturer offer; model year not verified.');
  await page.reload();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('columnheader').nth(1)).toContainText('Year not verified');
  await dialog.getByRole('button', { name: 'Close comparison' }).click();
  await page.getByLabel('Make', { exact: true }).selectOption('VinFast');
  await page.getByLabel('Record type', { exact: true }).selectOption('manufacturer-offer');
  const plus = page.locator('article[aria-labelledby="title-vinfast-ca-vf8-plus"]');
  await plus.getByRole('button', { name: /^Save / }).click();
  await page.reload();
  await page.getByRole('dialog').getByRole('button', { name: 'Close comparison' }).click();
  await page.getByLabel('Only my shortlist').check();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(plus.locator('.car-make')).toHaveText('Year not verified VinFast');
  await expect(plus.getByRole('button', { name: /^Unsave / })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
