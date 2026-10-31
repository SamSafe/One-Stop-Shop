import { revealCatalogFilters } from './catalog-helpers';
import { test, expect } from '@playwright/test';
test('Land Rover shows visible Canadian derivatives while keeping unknown model years and base price basis clear', async ({
  page,
}) => {
  await page.goto('/?trims=all');
  await revealCatalogFilters(page);
  await page.getByLabel('Make', { exact: true }).selectOption('Land Rover');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await expect(page.getByRole('article')).toHaveCount(27);
  const octa = page.locator(
    'article[aria-labelledby="title-land-rover-ca-l663-a-sv1-p635-110-2027"]',
  );
  await expect(octa.locator('.price-row')).toContainText('$179,400');
  await octa.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(octa).toContainText('Configured summary and RETAIL totals are excluded');
  await expect(octa.getByRole('link', { name: 'Add to your garage →' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'My garage', exact: true })).toHaveAttribute(
    'href',
    '/garage',
  );
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByLabel('Model year', { exact: true }).selectOption('unverified');
  await expect(page.getByRole('article')).toHaveCount(13);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
