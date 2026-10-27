import type { Page } from '@playwright/test';
// Detailed filtering and ranking are available in one expandable panel.
export async function revealCatalogFilters(page: Page, afterComparison = false) {
  if (
    new URL(page.url()).pathname !== '/' ||
    (new URL(page.url()).searchParams.has('compare') && !afterComparison)
  )
    return;
  await page.getByRole('searchbox', { name: 'Search cars' }).waitFor();
  const toggle = page.getByRole('button', { name: /^(Filters & priorities|Hide filters)$/ });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}
