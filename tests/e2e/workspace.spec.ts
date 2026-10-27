import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function begin(page: Page) {
  await page.goto('/garage');
  await page.getByRole('button', { name: 'Add your first vehicle' }).click();
  return page.getByRole('form', { name: 'Add a vehicle', exact: true });
}
async function chooseElantra(page: Page) {
  const form = await begin(page);
  await form.getByLabel('Model year', { exact: true }).selectOption('2016');
  await form.getByLabel('Make', { exact: true }).selectOption('Hyundai');
  await form.getByLabel('Model', { exact: true }).selectOption('Elantra');
  return form;
}
async function openFilters(page: Page) {
  const toggle = page.getByRole('button', { name: 'Filters & priorities', exact: true });
  if (await toggle.isVisible()) await toggle.click();
}

test('comparison workspace puts vehicles first and hides technical filters until requested', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Compare vehicles', level: 1 })).toBeVisible();
  await expect(page.locator('.hero,.car-illustration')).toHaveCount(0);
  const mobile = await page
    .getByRole('button', { name: 'Filters & priorities', exact: true })
    .isVisible();
  if (mobile) await expect(page.getByLabel('Make', { exact: true })).not.toBeVisible();
  await openFilters(page);
  await expect(page.getByLabel('Make', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Record type', { exact: true })).not.toBeVisible();
  await page.locator('.advanced-filters summary').click();
  await expect(page.getByLabel('Record type', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Compare vehicles', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('model filter follows the selected make and resets on a year or make change', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search cars' }).waitFor();
  await openFilters(page);
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByLabel('Make', { exact: true }).selectOption('Honda');
  await page.getByLabel('Model', { exact: true }).selectOption('CR-V');
  await expect(page.getByRole('article').first().locator('h3')).toHaveText('CR-V');
  const headings = await page.getByRole('article').locator('h3').allTextContents();
  expect(headings.length).toBeGreaterThan(0);
  expect(headings.every((h) => h === 'CR-V')).toBe(true);
  await page.getByLabel('Make', { exact: true }).selectOption('Hyundai');
  await expect(page.getByLabel('Model', { exact: true })).toHaveValue('all');
  expect(
    await page.getByLabel('Model', { exact: true }).locator('option').allTextContents(),
  ).not.toContain('CR-V');
  await page.getByLabel('Model', { exact: true }).selectOption('Elantra');
  await page.getByLabel('Model year', { exact: true }).selectOption('2025');
  await expect(page.getByLabel('Model', { exact: true })).toHaveValue('all');
});

test('appearance follows system settings and explicit preference persists across workspace pages', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const reported = () =>
    page.evaluate(() => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', await reported());
  await page.getByLabel('Appearance', { exact: true }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'My garage', exact: true })
    .click();
  await expect(page.getByLabel('Appearance', { exact: true })).toHaveValue('light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('Appearance', { exact: true }).selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', await reported());
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('dark comparison and guided finder remain accessible and fit small screens', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Appearance', { exact: true }).selectOption('dark');
  await page
    .getByRole('checkbox', { name: /^Compare / })
    .nth(0)
    .check();
  await page
    .getByRole('checkbox', { name: /^Compare / })
    .nth(1)
    .check();
  await page.getByRole('button', { name: 'Compare 2 cars' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Close comparison', exact: true }).click();
  const form = await chooseElantra(page);
  await expect(form).toContainText('Manufacturer guidance available');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('older vehicle lookup supplies Canadian model and powertrain choices without the comparison download', async ({
  page,
}) => {
  let catalogs = 0;
  await page.route(/\/assets\/catalog-[^/]+\.json$/, (route) => {
    catalogs++;
    return route.abort();
  });
  const form = await chooseElantra(page);
  await form
    .getByLabel('Engine / powertrain (optional)')
    .selectOption({ label: '1.8 L · Automatic with selectable gears (6-speed) · Gasoline' });
  await form.getByLabel('Canadian trim (optional)').fill('GL');
  await form.getByLabel('Current odometer (km)').fill('150000');
  await form.getByRole('button', { name: 'Save vehicle' }).click();
  const car = page.getByRole('article', { name: '2016 Hyundai Elantra' });
  await expect(car).toContainText('GL · 1.8 L');
  await expect(car).toContainText('150,000');
  await expect(car.getByRole('button', { name: 'Set up oil change reminders' })).toBeVisible();
  expect(catalogs).toBe(0);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('oss-garage-v1')!).vehicles[0],
  );
  expect(saved.catalogId).toBeUndefined();
  expect(saved.records).toEqual([]);
});

test('a vehicle outside lookup coverage can still be added manually', async ({ page }) => {
  let form = await chooseElantra(page);
  await form
    .getByRole('button', { name: 'Vehicle or year not listed? Enter details manually' })
    .click();
  form = page.getByRole('form', { name: 'Add a vehicle', exact: true });
  await expect(form.getByLabel('Make', { exact: true })).toHaveValue('Hyundai');
  await expect(form.getByLabel('Model year', { exact: true })).toHaveValue('2016');
  await expect(form).not.toContainText('Imported from the comparison catalog');
  await form.getByLabel('Make', { exact: true }).fill('Volvo');
  await form.getByLabel('Model', { exact: true }).fill('240');
  await form.getByLabel('Model year', { exact: true }).fill('1988');
  await form.getByLabel('Current odometer (km)').fill('280000');
  await form.getByRole('button', { name: 'Save vehicle' }).click();
  await expect(page.getByRole('article', { name: '1988 Volvo 240' })).toBeVisible();
  await expect(page.getByRole('article')).toContainText('schedule has not been verified');
});

test('lookup failure leaves manual entry available and a failed address update does not lose the saved car', async ({
  page,
}) => {
  await page.addInitScript(() => {
    history.replaceState = () => {
      throw new DOMException('Unavailable', 'SecurityError');
    };
  });
  await page.route(/\/assets\/owner-directory-[^/]+\.json$/, (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  let form = await begin(page);
  await expect(form.getByRole('status')).toContainText('Vehicle lookup could not be loaded');
  await form
    .getByRole('button', { name: 'Vehicle or year not listed? Enter details manually' })
    .click();
  form = page.getByRole('form', { name: 'Add a vehicle', exact: true });
  await form.getByLabel('Make', { exact: true }).fill('Hyundai');
  await form.getByLabel('Model', { exact: true }).fill('Elantra');
  await form.getByLabel('Model year', { exact: true }).fill('2016');
  await form.getByLabel('Current odometer (km)').fill('150000');
  await form.getByRole('button', { name: 'Save vehicle' }).click();
  await expect(page.getByRole('article', { name: '2016 Hyundai Elantra' })).toBeVisible();
  expect(
    (await page.evaluate(() => JSON.parse(localStorage.getItem('oss-garage-v1')!))).vehicles,
  ).toHaveLength(1);
});
