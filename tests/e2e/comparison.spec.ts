import { revealCatalogFilters } from './catalog-helpers';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const honda = '2026 Honda CR-V LX FWD';
const hybrid = '2026 Honda CR-V Sport Hybrid AWD';

async function findHondas(page: Page) {
  await page.getByRole('searchbox', { name: 'Search cars', exact: true }).fill('2026 Honda CR-V');
}

async function openRetailCatalog(page: Page) {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
}

test('preserves a newer shortlist format until the user explicitly clears it', async ({ page }) => {
  const payload = JSON.stringify({ version: 2, ids: ['future-car'], note: 'Keep my data' });
  await page.addInitScript((raw) => localStorage.setItem('oss-shortlist-v1', raw), payload);
  await openRetailCatalog(page);
  await expect(page.getByRole('article')).toHaveCount(30);
  expect(await page.evaluate(() => localStorage.getItem('oss-shortlist-v1'))).toBe(payload);
  await findHondas(page);
  await page.getByRole('button', { name: `Save ${honda}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Unsave ${honda}`, exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('oss-shortlist-v1'))).toBe(payload);
  await page.getByText('How your data works', { exact: true }).click();
  await page.getByRole('button', { name: 'Clear my shortlist' }).click();
  expect(await page.evaluate(() => localStorage.getItem('oss-shortlist-v1'))).toBeNull();
  await findHondas(page);
  await page.getByRole('button', { name: `Save ${honda}`, exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('oss-shortlist-v1')!));
  expect(saved).toEqual({ version: 1, ids: ['honda-cr-v-2026-lx-fwd'] });
});

test('keeps comparisons usable when the browser refuses address-bar updates', async ({ page }) => {
  await page.addInitScript(() => {
    history.replaceState = () => {
      throw new DOMException('History unavailable', 'SecurityError');
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Denied')) },
    });
  });
  await openRetailCatalog(page);
  await expect(page.getByRole('article')).toHaveCount(30);
  await findHondas(page);
  await page.getByRole('checkbox', { name: `Compare ${honda}`, exact: true }).check();
  await expect(page.getByRole('article')).toHaveCount(7);
  await page.getByRole('checkbox', { name: `Compare ${hybrid}`, exact: true }).check();
  await page.getByRole('button', { name: 'Compare 2 cars' }).click();
  await page.getByRole('button', { name: 'Copy comparison link' }).click();
  await expect(page.getByLabel('Comparison link', { exact: true })).toHaveValue(
    /compare=honda-cr-v/,
  );
});

test('browse, filter, empty state and reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openRetailCatalog(page);
  await expect(page.getByRole('article')).toHaveCount(30);
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Hybrid');
  await expect(page.getByRole('article').first()).toContainText('Hybrid');
  await page.getByLabel('Drivetrain', { exact: true }).selectOption('FWD');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('no-such-vehicle-oss');
  await expect(page.getByText('No vehicles match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Show all cars' }).click();
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('2026 Mazda CX-5 GX');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('CX-5');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(30);
  expect(errors).toEqual([]);
});

test('shortlist persists, filters, clears and syncs across tabs', async ({ page, context }) => {
  await openRetailCatalog(page);
  await findHondas(page);
  await page.getByRole('button', { name: `Save ${honda}`, exact: true }).click();
  await page.reload();
  await revealCatalogFilters(page);
  await findHondas(page);
  await expect(page.getByRole('button', { name: `Unsave ${honda}`, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('Only my shortlist').check();
  await expect(page.getByRole('article')).toHaveCount(1);
  const other = await context.newPage();
  await other.goto('/');
  await findHondas(other);
  await other.getByRole('button', { name: `Unsave ${honda}`, exact: true }).click();
  await expect(page.getByText('Your shortlist is empty.')).toBeVisible();
  await other.close();
});

test('comparison restores from its URL and calculates fuel costs', async ({ page }) => {
  await openRetailCatalog(page);
  await findHondas(page);
  await page.getByRole('checkbox', { name: `Compare ${honda}`, exact: true }).check();
  await expect(page.getByRole('button', { name: 'Compare 1 car' })).toBeDisabled();
  await page.getByRole('checkbox', { name: `Compare ${hybrid}`, exact: true }).check();
  await page.getByRole('button', { name: 'Compare 2 cars' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('row', { name: /Estimated annual energy/ })).toContainText('$1,872');
  await expect(page.getByRole('row', { name: /Estimated annual energy/ })).toContainText('$1,536');
  await page
    .getByRole('dialog', { name: 'Compare specifications', exact: true })
    .getByRole('spinbutton', { name: 'Annual kilometres', exact: true })
    .fill('30000');
  await expect(page.getByRole('row', { name: /Estimated annual energy/ })).toContainText('$3,744');
  await page
    .getByRole('dialog')
    .getByRole('spinbutton', { name: 'Fuel price · CAD / litre', exact: true })
    .fill('');
  await expect(page.getByRole('row', { name: /Estimated annual energy/ })).toContainText(
    'Not available',
  );
  await page.reload();
  await revealCatalogFilters(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await findHondas(page);
  await expect(page.getByRole('checkbox', { name: `Compare ${honda}`, exact: true })).toBeChecked();
});

test('comparison limits selection to four and supports removing a car', async ({ page }) => {
  await openRetailCatalog(page);
  const boxes = page.getByRole('checkbox', { name: /^Compare / });
  for (let index = 0; index < 4; index++) await boxes.nth(index).check();
  await expect(boxes.nth(4)).toBeDisabled();
  await page.getByRole('button', { name: 'Compare 4 cars' }).click();
  await page
    .getByRole('button', { name: /^Remove .* from comparison$/ })
    .first()
    .click();
  await expect(page.getByRole('columnheader')).toHaveCount(4);
  await page.getByRole('button', { name: 'Close comparison' }).click();
  await revealCatalogFilters(page, true);
  await expect(boxes.nth(4)).toBeEnabled();
});

test('shows source links and handles clipboard denial', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Denied')) },
    }),
  );
  await openRetailCatalog(page);
  await page.getByRole('button', { name: 'Specs & sources' }).first().click();
  await expect(page.getByRole('link', { name: /Base MSRP: .*Source:/ }).first()).toHaveAttribute(
    'href',
    /^https:\/\//,
  );
  await findHondas(page);
  await page.getByRole('checkbox', { name: `Compare ${honda}`, exact: true }).check();
  await page.getByRole('checkbox', { name: `Compare ${hybrid}`, exact: true }).check();
  await page.getByRole('button', { name: 'Compare 2 cars' }).click();
  await page.getByRole('button', { name: 'Copy comparison link' }).click();
  await expect(page.getByLabel('Comparison link', { exact: true })).toHaveValue(
    /compare=honda-cr-v/,
  );
});

test('recovers from corrupt and blocked local storage', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oss-shortlist-v1', '{bad-json'));
  await openRetailCatalog(page);
  await expect(page.getByRole('article')).toHaveCount(30);
  await expect(page.getByText(/storage is unavailable or unreadable/)).toBeVisible();
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get: () => {
        throw new Error('Blocked');
      },
    }),
  );
  await page.reload();
  await revealCatalogFilters(page);
  await findHondas(page);
  await page.getByRole('button', { name: `Save ${honda}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Unsave ${honda}`, exact: true })).toBeVisible();
  await expect(page.getByText(/cannot be saved on this device/)).toBeVisible();
});

test('priority sliders work from keyboard and zero weights stay unscored', async ({ page }) => {
  await openRetailCatalog(page);
  const price = page.getByRole('slider', { name: /Purchase price/ });
  await price.focus();
  await page.keyboard.press('End');
  await expect(price).toHaveValue('5');
  for (const name of [/Purchase price/, /Energy cost/, /Cargo space/, /Rear legroom/]) {
    await page.getByRole('slider', { name }).focus();
    await page.keyboard.press('Home');
  }
  await expect(
    page.getByText('Choose at least one priority to calculate fit scores.'),
  ).toBeVisible();
  await expect(page.locator('.fit-score > strong').first()).toContainText('—');
});

test('catalog, expanded specs and comparison have no detected WCAG AA violations', async ({
  page,
}) => {
  await openRetailCatalog(page);
  await page.getByRole('button', { name: 'Specs & sources' }).first().click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await findHondas(page);
  await page.getByRole('checkbox', { name: `Compare ${honda}`, exact: true }).check();
  await page.getByRole('checkbox', { name: `Compare ${hybrid}`, exact: true }).check();
  await page.getByRole('button', { name: 'Compare 2 cars' }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

test('layout has no horizontal document overflow and dialog traps focus', async ({ page }) => {
  await openRetailCatalog(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await findHondas(page);
  await page.getByRole('checkbox', { name: `Compare ${honda}`, exact: true }).check();
  await page.getByRole('checkbox', { name: `Compare ${hybrid}`, exact: true }).check();
  await page.getByRole('button', { name: 'Compare 2 cars' }).click();
  await expect(page.getByRole('button', { name: 'Close comparison' })).toBeFocused();
  for (let index = 0; index < 12; index++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
