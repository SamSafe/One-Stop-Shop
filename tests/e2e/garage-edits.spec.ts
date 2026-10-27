import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const key = 'oss-garage-v1';
const fixture = () => ({
  version: 1,
  revision: 'fixture',
  vehicles: [
    {
      id: 'elantra-owned',
      make: 'Hyundai',
      model: 'Elantra',
      year: 2016,
      engine: 'GL',
      nickname: '',
      odometerKm: 170000,
      updatedOn: '2026-10-26',
      reminders: [
        {
          id: 'oil',
          title: 'Engine oil and filter',
          km: 6000,
          months: 6,
          lastOn: '2026-03-01',
          lastKm: 165000,
          manufacturerKey: 'hyundai-2016-elantra-oil-severe',
        },
      ],
      records: [
        {
          id: 'service-1',
          reminderId: 'oil',
          title: 'Engine oil and filter',
          on: '2026-08-01',
          km: 168000,
          note: 'Original receipt',
        },
        {
          id: 'service-2',
          reminderId: null,
          title: 'Tires rotated',
          on: '2026-09-01',
          km: 169000,
          note: '',
        },
      ],
    },
  ],
});
async function openFixture(page: Page, data: unknown = fixture()) {
  await page.addInitScript((data) => {
    if (localStorage.getItem('oss-garage-v1') === null)
      localStorage.setItem('oss-garage-v1', JSON.stringify(data));
  }, data);
  await page.goto('/garage');
  await expect(page.getByRole('article')).toHaveCount(1);
}
async function saved(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}
async function editOil(page: Page) {
  const car = page.getByRole('article');
  const history = car
    .locator('.garage-history')
    .filter({ has: page.locator('summary', { hasText: 'Service history' }) });
  if (!(await history.evaluate((e) => (e as HTMLDetailsElement).open)))
    await history.locator('summary').click();
  await car
    .getByRole('button', { name: 'Edit record: Engine oil and filter on 2026-08-01', exact: true })
    .click();
  return page.getByRole('form', { name: 'Edit service for 2016 Hyundai Elantra' });
}

test('vehicle corrections preserve odometer, reminders and service history; cancel does not save', async ({
  page,
}) => {
  await openFixture(page);
  const before = await saved(page);
  await page.getByRole('button', { name: 'Edit vehicle', exact: true }).click();
  let form = page.getByRole('form', { name: 'Edit vehicle details', exact: true });
  await form.getByLabel('Nickname (optional)').fill('My Elantra');
  await form.getByLabel('Engine / powertrain (optional)').fill('GL · Nu 1.8');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await form.getByRole('button', { name: 'Save vehicle details' }).click();
  const car = page.getByRole('article', { name: 'My Elantra' });
  await expect(car).toBeFocused();
  const after = await saved(page);
  expect(after.vehicles[0].records).toEqual(before.vehicles[0].records);
  expect(after.vehicles[0].reminders.find((r: { id: string }) => r.id === 'oil')).toEqual(
    before.vehicles[0].reminders[0],
  );
  expect(after.vehicles[0].reminders).toHaveLength(6);
  expect(after.vehicles[0].odometerKm).toBe(170000);
  await page.reload();
  await expect(car).toBeVisible();
  await car.getByRole('button', { name: 'Edit vehicle', exact: true }).click();
  form = page.getByRole('form', { name: 'Edit vehicle details', exact: true });
  await form.getByLabel('Model', { exact: true }).fill('Do not save');
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await saved(page)).vehicles[0].model).toBe('Elantra');
});

test('a vehicle identity correction requires review before a sourced reminder becomes personal', async ({
  page,
}) => {
  await openFixture(page);
  const before = await saved(page);
  await page.getByRole('button', { name: 'Edit vehicle', exact: true }).click();
  const form = page.getByRole('form', { name: 'Edit vehicle details', exact: true });
  await form.getByLabel('Model year', { exact: true }).fill('2017');
  const consent = form.getByRole('checkbox', {
    name: /Keep the affected intervals as personal reminders/,
  });
  await expect(consent).not.toBeChecked();
  await form.getByRole('button', { name: 'Save vehicle details' }).click();
  expect((await saved(page)).vehicles).toEqual(before.vehicles);
  expect(await consent.evaluate((e) => (e as HTMLInputElement).validity.valid)).toBe(false);
  await consent.check();
  await form.getByRole('button', { name: 'Save vehicle details' }).click();
  const car = page.getByRole('article', { name: '2017 Hyundai Elantra' });
  await expect(car).toContainText('Personal interval');
  await expect(car).not.toContainText('Hyundai Canada · severe-use oil schedule');
  const result = (await saved(page)).vehicles[0];
  expect(result.reminders[0].manufacturerKey).toBeUndefined();
  expect(result.records).toEqual(before.vehicles[0].records);
  expect(result.records[0].reminderId).toBe('oil');
});

test('service correction changes the existing record and recalculates its reminder; unlinking keeps history', async ({
  page,
}) => {
  await openFixture(page);
  let form = await editOil(page);
  await expect(form.getByLabel('Service date', { exact: true })).toHaveValue('2026-08-01');
  await form.getByLabel('Service performed').fill('Oil and filter · receipt corrected');
  await form.getByLabel('Service date', { exact: true }).fill('2026-09-15');
  await form.getByLabel('Service odometer (km)').fill('169500');
  await form.getByLabel('Service notes (optional)').fill('Corrected from shop receipt');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await form.getByRole('button', { name: 'Save service changes' }).click();
  const car = page.getByRole('article');
  await expect(car).toContainText('175,500 km or 2027-03-15');
  let records = (await saved(page)).vehicles[0].records;
  expect(records).toHaveLength(2);
  expect(records[0]).toMatchObject({
    id: 'service-1',
    km: 169500,
    note: 'Corrected from shop receipt',
  });
  await car
    .getByRole('button', {
      name: 'Edit record: Oil and filter · receipt corrected on 2026-09-15',
      exact: true,
    })
    .click();
  form = page.getByRole('form', { name: 'Edit service for 2016 Hyundai Elantra' });
  await form.getByLabel('Apply to reminder (optional)').selectOption('');
  await form.getByRole('button', { name: 'Save service changes' }).click();
  await expect(car).toContainText('171,000 km or 2026-09-01');
  records = (await saved(page)).vehicles[0].records;
  expect(records).toHaveLength(2);
  expect(records[0].reminderId).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('stale editors cannot overwrite a correction or recreate a record removed in another tab', async ({
  page,
  context,
}) => {
  await openFixture(page);
  let form = await editOil(page);
  await form.getByLabel('Service notes (optional)').fill('Unsaved draft');
  const other = await context.newPage();
  await other.goto('/garage');
  let otherForm = await editOil(other);
  await otherForm.getByLabel('Service notes (optional)').fill('Saved in another tab');
  await otherForm.getByRole('button', { name: 'Save service changes' }).click();
  await form.getByRole('button', { name: 'Save service changes' }).click();
  await expect(page.getByRole('alert')).toContainText('changed in another tab');
  expect((await saved(page)).vehicles[0].records[0].note).toBe('Saved in another tab');
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  form = await editOil(page);
  await expect(form.getByLabel('Service notes (optional)')).toHaveValue('Saved in another tab');
  await other
    .getByRole('button', {
      name: 'Delete record: Engine oil and filter on 2026-08-01',
      exact: true,
    })
    .click();
  await other.getByRole('button', { name: 'Delete record', exact: true }).click();
  await form.getByRole('button', { name: 'Save service changes' }).click();
  await expect(page.getByRole('alert')).toContainText('removed in another tab');
  expect((await saved(page)).vehicles[0].records.map((r: { id: string }) => r.id)).toEqual([
    'service-2',
  ]);
  await other.close();
});

test('nickname changes preserve catalog specs while powertrain corrections remove the former configuration link', async ({
  page,
}) => {
  const data = fixture();
  Object.assign(data.vehicles[0]!, {
    make: 'Honda',
    model: 'CR-V',
    year: 2026,
    engine: 'LX FWD',
    reminders: [],
    records: [],
    catalogId: 'honda-cr-v-2026-lx-fwd',
  });
  await openFixture(page, data);
  let car = page.getByRole('article');
  await car.getByText('Comparison catalog specifications', { exact: true }).click();
  await car.getByRole('button', { name: 'Load published specifications' }).click();
  await expect(car.locator('.garage-specs')).toBeVisible();
  await car.getByRole('button', { name: 'Edit vehicle', exact: true }).click();
  let form = page.getByRole('form', { name: 'Edit vehicle details', exact: true });
  await form.getByLabel('Nickname (optional)').fill('My Honda');
  await form.getByRole('button', { name: 'Save vehicle details' }).click();
  car = page.getByRole('article', { name: 'My Honda' });
  await expect(car.locator('.garage-specs')).toBeVisible();
  expect((await saved(page)).vehicles[0].catalogId).toBe('honda-cr-v-2026-lx-fwd');
  await car.getByRole('button', { name: 'Edit vehicle', exact: true }).click();
  form = page.getByRole('form', { name: 'Edit vehicle details', exact: true });
  await form.getByLabel('Engine / powertrain (optional)').fill('Sport Hybrid AWD');
  await expect(form).toContainText('remove that comparison link');
  await form.getByRole('button', { name: 'Save vehicle details' }).click();
  await expect(car.getByText('Comparison catalog specifications', { exact: true })).toHaveCount(0);
  expect((await saved(page)).vehicles[0].catalogId).toBeUndefined();
});

test('restoring a different catalog reference never displays the former vehicle specifications', async ({
  page,
}) => {
  const data = fixture();
  Object.assign(data.vehicles[0]!, {
    make: 'Honda',
    model: 'CR-V',
    year: 2026,
    engine: 'LX FWD',
    reminders: [],
    records: [],
    catalogId: 'honda-cr-v-2026-lx-fwd',
  });
  await openFixture(page, data);
  const car = page.getByRole('article');
  await car.getByText('Comparison catalog specifications', { exact: true }).click();
  await car.getByRole('button', { name: 'Load published specifications' }).click();
  await expect(car.locator('.garage-specs')).toBeVisible();
  const backup = await saved(page);
  backup.vehicles[0].catalogId = 'unavailable-configuration';
  await page.getByLabel('Choose garage backup').setInputFiles({
    name: 'garage.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole('button', { name: 'Replace garage with backup' }).click();
  await expect(car.locator('.garage-specs')).toHaveCount(0);
  await car.getByRole('button', { name: 'Load published specifications' }).click();
  await expect(car.getByRole('status')).toContainText('could not be loaded');
  await expect(car.locator('.garage-specs')).toHaveCount(0);
});
