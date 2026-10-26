import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
const storageKey = 'oss-garage-v1';
async function addElantra(page: Page) {
  await page.getByRole('button', { name: 'Add your first vehicle' }).click();
  const form = page.getByRole('form', { name: 'Add a vehicle', exact: true });
  await form.getByLabel('Make', { exact: true }).fill('Hyundai');
  await form.getByLabel('Model', { exact: true }).fill('Elantra');
  await form.getByLabel('Model year', { exact: true }).fill('2016');
  await form.getByLabel('Current odometer (km)').fill('170000');
  await form.getByLabel('Engine / powertrain (optional)').fill('GL');
  await form.getByRole('button', { name: 'Save vehicle' }).click();
  await expect(page.getByRole('article', { name: '2016 Hyundai Elantra' })).toBeVisible();
}

test('owned-vehicle entry works without the comparison catalog; reminders reset from recorded completion', async ({
  page,
}) => {
  let catalogRequests = 0;
  await page.route(/\/assets\/catalog-[^/]+\.json$/, (route) => {
    catalogRequests++;
    return route.abort();
  });
  await page.goto('/garage');
  await addElantra(page);
  const car = page.getByRole('article', { name: '2016 Hyundai Elantra' });
  await car.getByRole('button', { name: 'Add reminder', exact: true }).click();
  const reminder = page.getByRole('form', { name: 'Add reminder for 2016 Hyundai Elantra' });
  await reminder.getByLabel('Reminder name').fill('Oil and filter');
  await reminder.getByLabel('Repeat every (km, optional)').fill('6000');
  await reminder.getByLabel('Repeat every (months, optional)').fill('6');
  await reminder.getByLabel('Last completed date').fill('2026-03-01');
  await reminder.getByLabel('Last completed odometer (km)').fill('165000');
  await reminder.getByRole('button', { name: 'Save reminder' }).click();
  await expect(car.getByText('Overdue', { exact: true })).toBeVisible();
  await expect(car).toContainText('Personal interval');
  await car.getByRole('button', { name: 'Update odometer', exact: true }).click();
  await car.getByLabel('New odometer (km)').fill('171000');
  await car.getByRole('button', { name: 'Save odometer' }).click();
  await car.getByRole('button', { name: 'Mark completed: Oil and filter' }).click();
  const service = page.getByRole('form', { name: 'Log service for 2016 Hyundai Elantra' });
  await service
    .getByLabel('Service notes (optional)')
    .fill('Oil and filter changed; checked levels.');
  await service.getByRole('button', { name: 'Save service record' }).click();
  await expect(car).toContainText('177,000 km');
  await expect(car.getByText('Upcoming', { exact: true })).toBeVisible();
  await car.getByText('Service history (1)', { exact: true }).click();
  await expect(car).toContainText('checked levels.');
  await page.reload();
  await expect(page.getByRole('article')).toContainText('171,000');
  expect(catalogRequests).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('exports a roundtrip backup and requires explicit confirmation to replace the garage', async ({
  page,
}) => {
  await page.goto('/garage');
  await addElantra(page);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export garage' }).click();
  const file = await event;
  const raw = await readFile((await file.path())!, 'utf8');
  expect(JSON.parse(raw).vehicles[0]).toMatchObject({
    make: 'Hyundai',
    model: 'Elantra',
    year: 2016,
  });
  const before = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  await page.getByLabel('Choose garage backup').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":2}'),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(before);
  const backup = JSON.parse(raw);
  backup.vehicles[0].nickname = 'My Elantra';
  await page.getByLabel('Choose garage backup').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole('button', { name: 'Replace garage with backup' })).toBeVisible();
  await expect(page.getByRole('article', { name: '2016 Hyundai Elantra' })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(before);
  await page.getByRole('button', { name: 'Replace garage with backup' }).click();
  await expect(page.getByRole('article', { name: 'My Elantra' })).toBeVisible();
});

test('preserves unsupported saved data and remains usable for the visit', async ({ page }) => {
  const raw = JSON.stringify({ version: 5, vehicles: [{ note: 'future data' }] });
  await page.addInitScript((raw) => localStorage.setItem('oss-garage-v1', raw), raw);
  await page.goto('/garage');
  await expect(page.getByRole('alert')).toContainText('preserved');
  await addElantra(page);
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(raw);
  await expect(page.getByRole('alert')).toContainText('only kept for this visit');
});

test('merges changes from another tab and confirms removal', async ({ page, context }) => {
  await page.goto('/garage');
  await addElantra(page);
  const other = await context.newPage();
  await other.goto('/garage');
  await expect(other.getByRole('article')).toContainText('2016 Hyundai Elantra');
  await other.getByRole('button', { name: 'Update odometer', exact: true }).click();
  await other.getByLabel('New odometer (km)').fill('172000');
  await other.getByRole('button', { name: 'Save odometer' }).click();
  await expect(page.getByRole('article')).toContainText('172,000');
  await page.getByRole('button', { name: 'Remove vehicle', exact: true }).click();
  await expect(page.getByRole('article')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('article')).toBeVisible();
  await page.getByRole('button', { name: 'Remove vehicle', exact: true }).click();
  await page.getByRole('button', { name: 'Remove vehicle and records' }).click();
  await expect(other.getByRole('article')).toHaveCount(0);
  await other.close();
});

test('catalog bridge preselects a vehicle and retains its specifications reference', async ({
  page,
}) => {
  await page.goto('/garage?vehicle=honda-cr-v-2026-lx-fwd');
  const form = page.getByRole('form', { name: 'Add a vehicle', exact: true });
  await expect(form.getByLabel('Make', { exact: true })).toHaveValue('Honda');
  await expect(form.getByLabel('Model year', { exact: true })).toHaveValue('2026');
  await form.getByLabel('Current odometer (km)').fill('4500');
  await form.getByRole('button', { name: 'Save vehicle' }).click();
  await expect(page.getByRole('article')).toContainText('Maintenance Minder');
  await expect(page.getByRole('button', { name: 'Set up service visit reminders' })).toHaveCount(0);
  await page.getByText('Comparison catalog specifications', { exact: true }).click();
  await page.getByRole('button', { name: 'Load published specifications' }).click();
  await expect(page.getByRole('definition').first()).toBeVisible();
  await expect(page).toHaveURL(/\/garage$/);
});

test('Canadian Elantra guidance creates a qualified oil reminder and links exact manual chapters', async ({
  page,
}) => {
  await page.goto('/garage');
  await addElantra(page);
  const car = page.getByRole('article', { name: '2016 Hyundai Elantra' });
  await expect(car).toContainText('6,000 km or 6 months');
  await car.getByRole('button', { name: 'Set up oil change reminders' }).click();
  const reminder = page.getByRole('form', { name: 'Add reminder for 2016 Hyundai Elantra' });
  await reminder.getByLabel('Last completed date').fill('2026-10-01');
  await reminder.getByLabel('Last completed odometer (km)').fill('168000');
  await reminder.getByRole('button', { name: 'Save reminder' }).click();
  await expect(car).toContainText('174,000 km');
  await expect(car).toContainText('Hyundai Canada · severe-use oil schedule');
  await car.getByText('Owner’s manual & service specifications', { exact: true }).click();
  await expect(car).toContainText('4.0 L');
  await expect(car).toContainText('Nu 1.8 and Nu 2.0');
  await expect(
    car.getByRole('link', { name: '2016 Canadian Elantra · Maintenance ↗' }),
  ).toHaveAttribute('href', /MDFL%20CANe%207.pdf$/);
  await expect(car.getByRole('link', { name: 'Chapter 8, page 4 ↗' }).first()).toHaveAttribute(
    'href',
    /#page=4$/,
  );
});

test('storage write denial keeps the garage usable and exports current records', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'oss-garage-v1')
        throw new DOMException('Storage unavailable', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.goto('/garage');
  await addElantra(page);
  await expect(page.getByRole('alert')).toContainText('only kept for this visit');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export garage' }).click();
  const file = await event;
  const saved = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(saved.vehicles[0]).toMatchObject({ make: 'Hyundai', model: 'Elantra', year: 2016 });
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
});
