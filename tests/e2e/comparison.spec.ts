import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const honda = '2026 Honda CR-V LX FWD';
const hybrid = '2026 Honda CR-V Sport Hybrid AWD';

test('browse, filter, empty state and reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('article')).toHaveCount(5);
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Hybrid');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByLabel('Drivetrain', { exact: true }).selectOption('FWD');
  await expect(page.getByText('No fits with these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Show all cars' }).click();
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('mazda');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('CX-5');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('shortlist persists, filters, clears and syncs across tabs', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: `Save ${honda}`, exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: `Unsave ${honda}`, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('Only my shortlist').check();
  await expect(page.getByRole('article')).toHaveCount(1);
  const other = await context.newPage();
  await other.goto('/');
  await other.getByRole('button', { name: `Unsave ${honda}`, exact: true }).click();
  await expect(page.getByText('Your shortlist starts with a favourite.')).toBeVisible();
  await other.close();
});

test('comparison restores from its URL and calculates fuel costs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('checkbox', { name: `Compare ${honda}`, exact: true }).check();
  await expect(page.getByRole('button', { name: 'Compare 1 cars' })).toBeDisabled();
  await page.getByRole('checkbox', { name: `Compare ${hybrid}`, exact: true }).check();
  await page.getByRole('button', { name: 'Compare 2 cars' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('row', { name: /Estimated annual fuel/ })).toContainText('$1,872');
  await expect(page.getByRole('row', { name: /Estimated annual fuel/ })).toContainText('$1,536');
  await page.getByLabel('Annual kilometres', { exact: true }).fill('30000');
  await expect(page.getByRole('row', { name: /Estimated annual fuel/ })).toContainText('$3,744');
  await page.getByLabel('Gas price').fill('');
  await expect(page.getByRole('row', { name: /Estimated annual fuel/ })).toContainText(
    'Not available',
  );
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('checkbox', { name: `Compare ${honda}`, exact: true })).toBeChecked();
});

test('comparison limits selection to four and supports removing a car', async ({ page }) => {
  await page.goto('/');
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
  await expect(boxes.nth(4)).toBeEnabled();
});

test('shows source links and handles clipboard denial', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Denied')) },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Specs & sources' }).first().click();
  await expect(page.getByRole('link', { name: /Base MSRP: .*Source:/ }).first()).toHaveAttribute(
    'href',
    /^https:\/\//,
  );
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
  await page.goto('/');
  await expect(page.getByRole('article')).toHaveCount(5);
  await expect(page.getByText(/storage is unavailable or unreadable/)).toBeVisible();
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get: () => {
        throw new Error('Blocked');
      },
    }),
  );
  await page.reload();
  await page.getByRole('button', { name: `Save ${honda}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Unsave ${honda}`, exact: true })).toBeVisible();
  await expect(page.getByText(/cannot be saved on this device/)).toBeVisible();
});

test('priority sliders work from keyboard and zero weights stay unscored', async ({ page }) => {
  await page.goto('/');
  const price = page.getByRole('slider', { name: /Purchase price/ });
  await price.focus();
  await page.keyboard.press('End');
  await expect(price).toHaveValue('5');
  for (const name of [/Purchase price/, /Fuel economy/, /Cargo space/, /Rear legroom/]) {
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
  await page.goto('/');
  await page.getByRole('button', { name: 'Specs & sources' }).first().click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('checkbox', { name: `Compare ${honda}`, exact: true }).check();
  await page.getByRole('checkbox', { name: `Compare ${hybrid}`, exact: true }).check();
  await page.getByRole('button', { name: 'Compare 2 cars' }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

test('layout has no horizontal document overflow and dialog traps focus', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
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
