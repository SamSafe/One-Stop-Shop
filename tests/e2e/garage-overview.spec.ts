import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Garage, OwnedVehicle, Reminder } from '../../apps/oss/src/garage/domain';

test.use({ timezoneId: 'America/Edmonton' });

const reminder = (id: string, values: Partial<Reminder> = {}): Reminder => ({
  id,
  title: id,
  km: null,
  months: 6,
  lastOn: '2026-04-27',
  lastKm: null,
  ...values,
});
const vehicle = (id: string, reminders: Reminder[]): OwnedVehicle => ({
  id,
  year: 2020,
  make: 'Example',
  model: 'Sedan',
  nickname: id,
  engine: '',
  odometerKm: 20000,
  updatedOn: '2026-10-27',
  reminders,
  records: [],
});
const fixture = (): Garage => ({
  version: 1,
  revision: 'overview-fixture',
  vehicles: [
    vehicle('Daily', [
      reminder('oil', { title: 'Oil and filter', lastOn: '2026-05-01' }),
      reminder('brakes', {
        title: 'Brake inspection',
        km: 10000,
        months: null,
        lastOn: null,
        lastKm: 9000,
      }),
      reminder('history', { title: 'Cabin filter', lastOn: null }),
    ]),
    vehicle('Weekend', [
      reminder('oil', { title: 'Oil and filter' }),
      reminder('upcoming', { title: 'Air filter', lastOn: '2026-10-01' }),
    ]),
  ],
});
async function open(page: Page, data = fixture(), time = '2026-10-27T12:00:00Z') {
  await page.clock.install({ time: new Date(time) });
  await page.addInitScript((data) => {
    if (localStorage.getItem('oss-garage-v1') === null)
      localStorage.setItem('oss-garage-v1', JSON.stringify(data));
  }, data);
  await page.goto('/garage');
  return page.getByRole('region', { name: 'Maintenance overview', exact: true });
}

test('overview prioritizes work across vehicles and moves keyboard focus to the correct reminder without loading comparison data', async ({
  page,
}) => {
  let catalogRequests = 0;
  await page.route(/\/assets\/catalog-[^/]+\.json$/, (route) => {
    catalogRequests++;
    return route.abort();
  });
  const overview = await open(page);
  await expect(overview.locator('li h4')).toHaveText([
    'Brake inspection',
    'Oil and filter',
    'Oil and filter',
    'Cabin filter',
  ]);
  await expect(overview.locator('li .garage-status')).toHaveText([
    'Overdue',
    'Due now',
    'Due soon',
    'Needs history',
  ]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await overview.getByLabel('Show reminders', { exact: true }).selectOption('due');
  await expect(overview.locator('li')).toHaveCount(2);
  await overview.getByLabel('Vehicle for reminders', { exact: true }).selectOption('Weekend');
  await expect(overview.locator('li')).toHaveCount(1);
  await overview
    .getByRole('button', { name: 'Review reminder: Oil and filter for Weekend', exact: true })
    .click();
  const weekend = page.getByRole('article', { name: 'Weekend', exact: true });
  const target = weekend.getByRole('group', { name: 'Oil and filter for Weekend', exact: true });
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(
    target.getByRole('button', { name: 'Mark completed: Oil and filter', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  const form = weekend.getByRole('form', { name: 'Log service for Weekend', exact: true });
  await expect(form.getByLabel('Service date', { exact: true })).toBeFocused();
  await form.getByRole('button', { name: 'Save service record', exact: true }).click();
  await expect(overview).toContainText('No reminders match this filter.');
  await overview.getByLabel('Show reminders', { exact: true }).selectOption('history');
  await overview.getByLabel('Vehicle for reminders', { exact: true }).selectOption('Daily');
  await overview
    .getByRole('button', { name: 'Review reminder: Cabin filter for Daily', exact: true })
    .click();
  const daily = page.getByRole('article', { name: 'Daily', exact: true });
  await expect(
    daily.getByRole('group', { name: 'Cabin filter for Daily', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const history = daily.getByRole('form', { name: 'Log service for Daily', exact: true });
  await expect(history.getByLabel('Service date', { exact: true })).toHaveValue('');
  await expect(history.getByLabel('Service odometer (km)', { exact: true })).toHaveValue('');
  expect(new URL(page.url()).hash).toBe('');
  expect(catalogRequests).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('overview paging reveals new reminders and filtering never changes saved records', async ({
  page,
}) => {
  const data = fixture();
  data.vehicles[0]!.reminders = Array.from({ length: 8 }, (_, index) =>
    reminder(`task-${index}`, { lastOn: '2026-04-01' }),
  );
  data.vehicles[1]!.reminders = [];
  const overview = await open(page, data);
  const original = await page.evaluate(() => localStorage.getItem('oss-garage-v1'));
  await expect(overview.locator('li')).toHaveCount(6);
  await overview.getByRole('button', { name: 'Next reminders', exact: true }).click();
  await expect(overview.locator('li')).toHaveCount(2);
  const heading = overview.getByRole('heading', { name: 'Reminders · Page 2 of 2', exact: true });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await overview.getByRole('button', { name: 'Previous reminders', exact: true }).click();
  await expect(
    overview.getByRole('heading', { name: 'Reminders · Page 1 of 2', exact: true }),
  ).toBeFocused();
  await overview.getByLabel('Show reminders', { exact: true }).selectOption('history');
  await expect(overview).toContainText('0 reminders match this view.');
  await overview.getByLabel('Vehicle for reminders', { exact: true }).selectOption('Weekend');
  await overview.getByLabel('Show reminders', { exact: true }).selectOption('attention');
  await expect(overview).toContainText('No reminders need attention');
  expect(await page.evaluate(() => localStorage.getItem('oss-garage-v1'))).toBe(original);
});

test('overview and vehicle reminders stay in step after midnight and service entered in another tab', async ({
  page,
  context,
}) => {
  const data = fixture();
  data.vehicles = [data.vehicles[1]!];
  const overview = await open(page, data, '2026-10-27T23:59:00-06:00');
  await expect(overview.getByText('Due now', { exact: true })).toBeVisible();
  await page.clock.fastForward(120000);
  await expect(overview.getByText('Overdue', { exact: true })).toBeVisible();
  await expect(page.getByRole('article').getByText('Overdue', { exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.clock.install({ time: new Date('2026-10-28T12:00:00Z') });
  await other.goto('/garage');
  await other.getByRole('button', { name: 'Mark completed: Oil and filter', exact: true }).click();
  await other
    .getByRole('form', { name: 'Log service for Weekend', exact: true })
    .getByRole('button', { name: 'Save service record', exact: true })
    .click();
  await expect(overview).toContainText('No reminders need attention');
  await expect(page.getByRole('article').getByText('Upcoming', { exact: true })).toHaveCount(2);
  await other.close();
});
