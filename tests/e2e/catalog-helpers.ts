import type { Page } from '@playwright/test';
// Filter journeys explicitly reveal the compact mobile filter panel.
export async function revealCatalogFilters(page: Page, afterComparison = false) {
  if (
    new URL(page.url()).pathname !== '/' ||
    (new URL(page.url()).searchParams.has('compare') && !afterComparison)
  )
    return;
  await page.getByRole('searchbox', { name: 'Search cars' }).waitFor();
  const toggle = page.getByRole('button', { name: 'Filters & priorities', exact: true });
  if (await toggle.isVisible()) await toggle.click();
  const advanced = page.locator('.advanced-filters');
  if (!(await advanced.evaluate((e) => (e as HTMLDetailsElement).open)))
    await advanced.locator('summary').click();
}
