import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Garage, ServiceRecord } from '../../apps/oss/src/garage/domain';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

const key = 'oss-garage-v1';
const name = '2020 Example Sedan';
const fixture = (): Garage => ({
  version: 1,
  revision: 'history-fixture',
  vehicles: [
    {
      id: 'car',
      make: 'Example',
      model: 'Sedan',
      year: 2020,
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
          lastOn: null,
          lastKm: null,
        },
      ],
      records: [
        {
          id: 'oil-record',
          reminderId: 'oil',
          title: 'Oil and filter',
          on: '2026-08-01',
          km: 18000,
          note: 'Receipt 42',
        },
        {
          id: 'inspection',
          reminderId: null,
          title: 'Warranty inspection',
          on: '2026-09-01',
          km: 19000,
          note: '',
          costCents: 0,
          provider: 'Warranty shop',
        },
        {
          id: 'tires',
          reminderId: null,
          title: 'Tire rotation',
          on: '2026-10-01',
          km: 20000,
          note: '',
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
  return history(page);
}
async function history(page: Page) {
  const car = page.getByRole('article', { name, exact: true });
  const summary = car.locator('summary').filter({ hasText: /^Service history \(/ });
  if ((await summary.locator('..').getAttribute('open')) === null) await summary.click();
  return car.getByRole('region', { name: `Service history for ${name}`, exact: true });
}
async function editOil(page: Page) {
  const view = await history(page);
  await view
    .getByRole('button', { name: 'Edit record: Oil and filter on 2026-08-01', exact: true })
    .click();
  return page.getByRole('form', { name: `Edit service for ${name}`, exact: true });
}
const saved = (page: Page): Promise<Garage> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);

test('optional service expenses survive reload and JSON restore while blanks stay unknown and covered work stays zero', async ({
  page,
}) => {
  let view = await open(page);
  await expect(view.getByText('No amounts recorded', { exact: true })).toHaveCount(0);
  await expect(view.getByLabel('Costs for matching service records')).toContainText(
    '$0.00 CAD recorded',
  );
  let form = await editOil(page);
  await expect(form.getByLabel('Service performed', { exact: true })).toBeFocused();
  await expect(form.getByLabel('Amount paid (CAD, optional)', { exact: true })).toHaveValue('');
  await form.getByLabel('Amount paid (CAD, optional)', { exact: true }).fill('95.29');
  await form.getByLabel('Service provider (optional)', { exact: true }).fill('Atelier North');
  await form.getByRole('button', { name: 'Save service changes', exact: true }).click();
  expect((await saved(page)).vehicles[0]!.records[0]).toMatchObject({
    costCents: 9529,
    provider: 'Atelier North',
  });
  await page.reload();
  view = await history(page);
  await expect(view.getByLabel('Costs for matching service records')).toContainText(
    '$95.29 CAD recorded',
  );
  await expect(view).toContainText('1 unknown amount is excluded');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export garage', exact: true }).click();
  const download = await event,
    raw = await readFile((await download.path())!, 'utf8');
  const backup: Garage = JSON.parse(raw);
  expect(backup.vehicles[0]!.records[1]!.costCents).toBe(0);
  expect(backup.vehicles[0]!.records[2]!.costCents).toBeUndefined();
  form = await editOil(page);
  await form.getByLabel('Amount paid (CAD, optional)', { exact: true }).fill('');
  await form.getByRole('button', { name: 'Save service changes', exact: true }).click();
  expect((await saved(page)).vehicles[0]!.records[0]!.costCents).toBeUndefined();
  await page.getByLabel('Choose garage backup', { exact: true }).setInputFiles({
    name: 'expenses.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await page.getByRole('button', { name: 'Replace garage with backup', exact: true }).click();
  expect((await saved(page)).vehicles[0]!.records[0]).toMatchObject({
    costCents: 9529,
    provider: 'Atelier North',
  });
  await expect(view.getByLabel('Costs for matching service records')).toContainText(
    '$95.29 CAD recorded',
  );
});

test('history search and dates cover all records, and CSV exports every matching page', async ({
  page,
}) => {
  const data = fixture();
  data.vehicles[0]!.reminders = [];
  data.vehicles[0]!.records = Array.from({ length: 23 }, (_, index): ServiceRecord => ({
    id: `service-${index}`,
    reminderId: null,
    title: `Service ${index + 1}`,
    on: `2026-10-${String(index + 1).padStart(2, '0')}`,
    km: 1000 + index * 500,
    note: '',
    provider: index % 2 === 0 ? 'North Shop' : 'South Garage',
    ...(index % 3 === 0 ? {} : { costCents: index * 100 }),
  }));
  const view = await open(page, data),
    original = await page.evaluate((key) => localStorage.getItem(key), key);
  await expect(view.locator('.garage-record')).toHaveCount(10);
  await view.getByRole('searchbox', { name: 'Search service history', exact: true }).fill('north');
  await expect(view).toContainText('12 of 23 service records match');
  await view.getByRole('button', { name: 'Next history page', exact: true }).click();
  await expect(view.locator('.garage-record')).toHaveCount(2);
  const resultHeading = view.getByRole('heading', {
    name: 'Service records · Page 2 of 2',
    exact: true,
  });
  await expect(resultHeading).toBeFocused();
  await expect(resultHeading).toBeInViewport();
  await view.getByRole('button', { name: 'Previous history page', exact: true }).click();
  await expect(
    view.getByRole('heading', { name: 'Service records · Page 1 of 2', exact: true }),
  ).toBeFocused();
  await view.getByRole('button', { name: 'Next history page', exact: true }).click();
  const event = page.waitForEvent('download');
  await view.getByRole('button', { name: 'Export matching history (CSV)', exact: true }).click();
  const download = await event,
    csv = await readFile((await download.path())!, 'utf8');
  expect(download.suggestedFilename()).toBe('oss-service-history.csv');
  expect(csv).toContain('"Service 1"');
  expect(csv).toContain('"Service 23"');
  expect(csv.trimEnd().split('\r\n')).toHaveLength(13);
  await view.getByLabel('From service date', { exact: true }).fill('2026-10-10');
  await view.getByLabel('To service date', { exact: true }).fill('2026-10-20');
  await expect(view.locator('.garage-record')).toHaveCount(5);
  await view.getByLabel('From service date', { exact: true }).fill('2026-10-21');
  await expect(view.getByRole('alert')).toContainText('start date');
  await expect(
    view.getByRole('button', { name: 'Export matching history (CSV)', exact: true }),
  ).toBeDisabled();
  await view.getByRole('button', { name: 'Reset history filters', exact: true }).click();
  await expect(view.locator('.garage-record')).toHaveCount(10);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(original);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('concurrent amount edits and pending deletions cannot overwrite newer expense details', async ({
  page,
  context,
}) => {
  await open(page);
  let form = await editOil(page);
  await form.getByLabel('Amount paid (CAD, optional)', { exact: true }).fill('40');
  const other = await context.newPage();
  await other.goto('/garage');
  let otherForm = await editOil(other);
  await otherForm.getByLabel('Amount paid (CAD, optional)', { exact: true }).fill('50');
  await otherForm.getByRole('button', { name: 'Save service changes', exact: true }).click();
  await form.getByRole('button', { name: 'Save service changes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('changed in another tab');
  expect((await saved(page)).vehicles[0]!.records[0]!.costCents).toBe(5000);
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  const view = await history(page);
  await view
    .getByRole('button', { name: 'Delete record: Oil and filter on 2026-08-01', exact: true })
    .click();
  otherForm = await editOil(other);
  await otherForm.getByLabel('Service provider (optional)', { exact: true }).fill('Updated shop');
  await otherForm.getByRole('button', { name: 'Save service changes', exact: true }).click();
  await view.getByRole('button', { name: 'Delete record', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('changed in another tab');
  expect((await saved(page)).vehicles[0]!.records[0]!.provider).toBe('Updated shop');
  await view.getByRole('button', { name: 'Cancel', exact: true }).click();
  await view
    .getByRole('button', { name: 'Delete record: Oil and filter on 2026-08-01', exact: true })
    .click();
  await view.getByRole('button', { name: 'Delete record', exact: true }).click();
  expect((await saved(page)).vehicles[0]!.records.map((record) => record.id)).toEqual([
    'inspection',
    'tires',
  ]);
  await expect(page.getByRole('article')).toContainText('Needs history');
  await other.close();
});
