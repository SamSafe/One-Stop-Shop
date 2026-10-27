import { revealCatalogFilters } from './catalog-helpers';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('the full source library supports keyboard discovery, pagination, search and recovery', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  const library = page.locator('.source-library'),
    summary = library.locator('summary');
  await expect(summary).toContainText('official sources');
  expect(await library.getByRole('link', { includeHidden: true }).count()).toBeLessThanOrEqual(12);
  await summary.focus();
  await summary.press('Enter');
  const search = library.getByRole('searchbox', { name: 'Search sources' }),
    links = library.getByRole('link');
  await expect(search).toBeVisible();
  await expect(links).toHaveCount(12);
  const first = await links.first().getAttribute('href');
  await library.getByRole('button', { name: 'Next sources', exact: true }).click();
  await expect(library.getByRole('navigation', { name: 'Source pages' })).toContainText(
    'Page 2 of',
  );
  expect(await links.first().getAttribute('href')).not.toBe(first);
  await search.fill('Porsche Canadian model-year menu');
  await expect(links).toHaveCount(1);
  await expect(links).toHaveAttribute('href', 'https://www.porsche.com/canada/en/models/');
  await expect(
    library.getByRole('button', { name: 'Previous sources', exact: true }),
  ).toBeDisabled();
  await summary.click();
  await expect(search).not.toBeVisible();
  await summary.click();
  await expect(search).toHaveValue('Porsche Canadian model-year menu');
  await search.fill('no-such-source-oss');
  await expect(library.getByRole('status')).toHaveText('No sources match that search.');
  await expect(links).toHaveCount(0);
  await expect(library.getByRole('button', { name: 'Next sources', exact: true })).toBeDisabled();
  await search.fill('');
  await expect(links).toHaveCount(12);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
