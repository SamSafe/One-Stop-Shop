import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import type { Garage, OwnedVehicle } from '../../apps/oss/src/garage/domain';

const name = '2020 Example Sedan';
const fixture = (): Garage => ({
  version: 1,
  revision: 'reminder-fixture',
  vehicles: [
    {
      id: 'car',
      year: 2020,
      make: 'Example',
      model: 'Sedan',
      engine: '',
      nickname: '',
      odometerKm: 20000,
      updatedOn: '2026-10-27',
      reminders: [
        {
          id: 'oil',
          title: 'Oil and filter',
          km: 6000,
          months: 6,
          lastOn: '2026-10-20',
          lastKm: 20000,
        },
      ],
      records: [
        {
          id: 'receipt',
          reminderId: 'oil',
          title: 'Oil and filter',
          on: '2026-09-01',
          km: 19000,
          note: 'Original receipt',
          costCents: 9529,
          provider: 'Atelier North',
        },
      ],
    },
  ],
});
async function open(page: Page, data = fixture()) {
  await page.clock.install({ time: new Date('2026-10-27T12:00:00Z') });
  await page.addInitScript((data) => {
    if (localStorage.getItem('oss-garage-v1') === null)
      localStorage.setItem('oss-garage-v1', JSON.stringify(data));
  }, data);
  await page.goto('/garage');
}
const car = (page: Page) => page.getByRole('article', { name, exact: true });
async function edit(page: Page, title = 'Oil and filter') {
  await car(page)
    .getByRole('button', { name: `Edit reminder: ${title}`, exact: true })
    .click();
  return car(page).getByRole('form', { name: `Edit reminder for ${name}`, exact: true });
}
const saved = (page: Page): Promise<OwnedVehicle> =>
  page.evaluate(() => JSON.parse(localStorage.getItem('oss-garage-v1')!).vehicles[0]);

test('personal reminders can be corrected without replacing actual service history, with inline interval validation and persistent due dates', async ({
  page,
}) => {
  await open(page);
  const original = await saved(page);
  let form = await edit(page);
  await expect(form.getByLabel('Reminder name', { exact: true })).toBeFocused();
  await expect(form.getByLabel('Starting completion date (optional)', { exact: true })).toHaveValue(
    '2026-10-20',
  );
  await form.getByLabel('Repeat every (km, optional)', { exact: true }).fill('');
  await form.getByLabel('Repeat every (months, optional)', { exact: true }).fill('');
  await form.getByRole('button', { name: 'Save reminder changes', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('Enter a distance interval');
  await expect(form.getByLabel('Repeat every (km, optional)', { exact: true })).toBeFocused();
  expect(await saved(page)).toEqual(original);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await form.getByLabel('Reminder name', { exact: true }).fill('Personal oil plan');
  await form.getByLabel('Repeat every (km, optional)', { exact: true }).fill('5000');
  await form.getByLabel('Repeat every (months, optional)', { exact: true }).fill('2');
  await form.getByLabel('Starting completion date (optional)', { exact: true }).fill('');
  await form.getByLabel('Starting completion odometer (km, optional)', { exact: true }).fill('');
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await form.getByRole('button', { name: 'Save reminder changes', exact: true }).click();
  const reminder = car(page).getByRole('group', {
    name: `Personal oil plan for ${name}`,
    exact: true,
  });
  await expect(reminder).toBeFocused();
  await expect(reminder).toContainText('24,000 km or 2026-11-01');
  await expect(
    page.getByRole('region', { name: 'Maintenance overview', exact: true }),
  ).toContainText('Personal oil plan');
  const after = await saved(page);
  expect(after.records).toEqual(original.records);
  expect(after.reminders).toEqual([
    { id: 'oil', title: 'Personal oil plan', km: 5000, months: 2, lastOn: null, lastKm: null },
  ]);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export service dates (.ics)', exact: true }).click();
  const calendar = await readFile((await (await event).path())!, 'utf8');
  expect(calendar).toContain('UID:car.oil@oss.local');
  expect(calendar).toContain('DTSTART;VALUE=DATE:20261101');
  await page.reload();
  await expect(reminder).toContainText('24,000 km or 2026-11-01');
  form = await edit(page, 'Personal oil plan');
  await form.getByLabel('Reminder name', { exact: true }).fill('Unsaved title');
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(reminder).toBeFocused();
  expect(await saved(page)).toEqual(after);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('adding and revising a personal interval preserves genuinely unknown completion history', async ({
  page,
}) => {
  const data = fixture();
  data.vehicles[0]!.reminders = [];
  data.vehicles[0]!.records = [];
  await open(page, data);
  await car(page).getByRole('button', { name: 'Add reminder', exact: true }).click();
  let form = car(page).getByRole('form', { name: `Add reminder for ${name}`, exact: true });
  await expect(form.getByLabel('Reminder name', { exact: true })).toBeFocused();
  await form.getByLabel('Reminder name', { exact: true }).fill('Cabin filter');
  await form.getByRole('button', { name: 'Save reminder', exact: true }).click();
  await expect(form.getByRole('alert')).toBeVisible();
  await form.getByLabel('Repeat every (months, optional)', { exact: true }).fill('12');
  await form.getByRole('button', { name: 'Save reminder', exact: true }).click();
  const id = (await saved(page)).reminders[0]!.id;
  form = await edit(page, 'Cabin filter');
  await form.getByLabel('Repeat every (months, optional)', { exact: true }).fill('6');
  await form.getByRole('button', { name: 'Save reminder changes', exact: true }).click();
  const current = await saved(page);
  expect(current.reminders).toEqual([
    { id, title: 'Cabin filter', km: null, months: 6, lastOn: null, lastKm: null },
  ]);
  expect(current.records).toEqual([]);
  await expect(
    car(page).getByRole('group', { name: `Cabin filter for ${name}`, exact: true }),
  ).toContainText('Needs history');
});

test('stale interval edits and pending removals cannot overwrite a corrected reminder from another tab', async ({
  page,
  context,
}) => {
  await open(page);
  const other = await context.newPage();
  await other.clock.install({ time: new Date('2026-10-27T12:00:00Z') });
  await other.goto('/garage');
  const original = await saved(page);
  const form = await edit(page);
  await form.getByLabel('Reminder name', { exact: true }).fill('Stale title');
  let otherForm = await edit(other);
  await otherForm.getByLabel('Repeat every (km, optional)', { exact: true }).fill('7000');
  await otherForm.getByRole('button', { name: 'Save reminder changes', exact: true }).click();
  await form.getByRole('button', { name: 'Save reminder changes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('reminder changed in another tab');
  expect((await saved(page)).reminders[0]!.km).toBe(7000);
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  await car(page)
    .getByRole('button', { name: 'Remove reminder: Oil and filter', exact: true })
    .click();
  otherForm = await edit(other);
  await otherForm.getByLabel('Reminder name', { exact: true }).fill('Corrected oil plan');
  await otherForm.getByRole('button', { name: 'Save reminder changes', exact: true }).click();
  await car(page).getByRole('button', { name: 'Remove reminder', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('reminder changed in another tab');
  expect((await saved(page)).reminders[0]!.title).toBe('Corrected oil plan');
  expect((await saved(page)).records).toEqual(original.records);
  await car(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await car(page)
    .getByRole('button', { name: 'Remove reminder: Corrected oil plan', exact: true })
    .click();
  await car(page).getByRole('button', { name: 'Remove reminder', exact: true }).click();
  const current = await saved(page);
  expect(current.reminders).toEqual([]);
  expect(current.records).toEqual(
    original.records.map((record) => ({ ...record, reminderId: null })),
  );
  await expect(car(page)).toBeFocused();
  await other.close();
});

test('an interval editor cannot recreate a reminder removed in another tab', async ({
  page,
  context,
}) => {
  await open(page);
  const form = await edit(page);
  const other = await context.newPage();
  await other.clock.install({ time: new Date('2026-10-27T12:00:00Z') });
  await other.goto('/garage');
  await car(other)
    .getByRole('button', { name: 'Remove reminder: Oil and filter', exact: true })
    .click();
  await car(other).getByRole('button', { name: 'Remove reminder', exact: true }).click();
  await form.getByRole('button', { name: 'Save reminder changes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('reminder was removed in another tab');
  expect((await saved(page)).reminders).toEqual([]);
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(car(page)).toBeFocused();
  await other.close();
});

test('interval changes preserve service and odometer updates made while the editor is open', async ({
  page,
  context,
}) => {
  await open(page);
  const form = await edit(page);
  await form.getByLabel('Repeat every (km, optional)', { exact: true }).fill('5000');
  await form.getByLabel('Repeat every (months, optional)', { exact: true }).fill('2');
  const other = await context.newPage();
  await other.clock.install({ time: new Date('2026-10-27T12:00:00Z') });
  await other.goto('/garage');
  await car(other).getByRole('button', { name: 'Update odometer', exact: true }).click();
  await car(other).getByLabel('New odometer (km)', { exact: true }).fill('25000');
  await car(other).getByRole('button', { name: 'Save odometer', exact: true }).click();
  await car(other)
    .getByRole('button', { name: 'Mark completed: Oil and filter', exact: true })
    .click();
  const service = car(other).getByRole('form', { name: `Log service for ${name}`, exact: true });
  await service.getByRole('button', { name: 'Save service record', exact: true }).click();
  await form.getByRole('button', { name: 'Save reminder changes', exact: true }).click();
  const current = await saved(page);
  expect(current.odometerKm).toBe(25000);
  expect(current.records).toHaveLength(2);
  expect(current.records[1]).toMatchObject({ reminderId: 'oil', on: '2026-10-27', km: 25000 });
  await expect(
    car(page).getByRole('group', { name: `Oil and filter for ${name}`, exact: true }),
  ).toContainText('30,000 km or 2026-12-27');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await other.close();
});

test('switching from a reminder edit to a new reminder resets fields even with a matching imported identifier', async ({
  page,
}) => {
  const data = fixture();
  data.vehicles[0]!.reminders[0]!.id = 'new-reminder';
  data.vehicles[0]!.records[0]!.reminderId = 'new-reminder';
  await open(page, data);
  const editing = await edit(page);
  await editing.getByLabel('Reminder name', { exact: true }).fill('Unsaved edit');
  await car(page).getByRole('button', { name: 'Add reminder', exact: true }).click();
  const adding = car(page).getByRole('form', { name: `Add reminder for ${name}`, exact: true });
  await expect(adding.getByLabel('Reminder name', { exact: true })).toHaveValue('');
  await expect(adding.getByLabel('Repeat every (km, optional)', { exact: true })).toHaveValue('');
  await expect(adding.getByLabel('Repeat every (months, optional)', { exact: true })).toHaveValue(
    '',
  );
  await expect(adding.getByLabel('Last completed date', { exact: true })).toHaveValue('');
  await expect(adding.getByLabel('Last completed odometer (km)', { exact: true })).toHaveValue('');
  expect((await saved(page)).reminders).toEqual(data.vehicles[0]!.reminders);
});

test('switching from a service edit to completion clears old work and expenses when record and reminder IDs match', async ({
  page,
}) => {
  const data = fixture();
  data.vehicles[0]!.records[0]!.id = 'oil';
  await open(page, data);
  await car(page)
    .locator('summary')
    .filter({ hasText: /^Service history \(/ })
    .click();
  await car(page)
    .getByRole('button', { name: 'Edit record: Oil and filter on 2026-09-01', exact: true })
    .click();
  const editing = car(page).getByRole('form', { name: `Edit service for ${name}`, exact: true });
  await editing
    .getByLabel('Service notes (optional)', { exact: true })
    .fill('Unsaved historical correction');
  await car(page)
    .getByRole('button', { name: 'Mark completed: Oil and filter', exact: true })
    .click();
  const completion = car(page).getByRole('form', { name: `Log service for ${name}`, exact: true });
  await expect(completion.getByLabel('Service date', { exact: true })).toHaveValue('2026-10-27');
  await expect(completion.getByLabel('Service odometer (km)', { exact: true })).toHaveValue(
    '20000',
  );
  await expect(completion.getByLabel('Amount paid (CAD, optional)', { exact: true })).toHaveValue(
    '',
  );
  await expect(completion.getByLabel('Service provider (optional)', { exact: true })).toHaveValue(
    '',
  );
  await expect(completion.getByLabel('Service notes (optional)', { exact: true })).toHaveValue('');
  await completion.getByRole('button', { name: 'Save service record', exact: true }).click();
  const current = await saved(page);
  expect(current.records).toHaveLength(2);
  expect(current.records[0]).toEqual(data.vehicles[0]!.records[0]);
  expect(current.records[1]).toMatchObject({
    reminderId: 'oil',
    on: '2026-10-27',
    km: 20000,
    note: '',
  });
  expect(current.records[1]!.costCents).toBeUndefined();
  expect(current.records[1]!.provider).toBeUndefined();
});
