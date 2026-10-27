import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
async function addElantra(page: Page) {
  await page.goto('/garage');
  await page.getByRole('button', { name: 'Add your first vehicle' }).click();
  const form = page.getByRole('form', { name: 'Add a vehicle', exact: true });
  await form.getByLabel('Model year', { exact: true }).selectOption('2016');
  await form.getByLabel('Make', { exact: true }).selectOption('Hyundai');
  await form.getByLabel('Model', { exact: true }).selectOption('Elantra');
  await form.getByLabel('Current odometer (km)').fill('170000');
  await form.getByRole('button', { name: 'Save vehicle' }).click();
  return page.getByRole('article', { name: '2016 Hyundai Elantra', exact: true });
}
test('automatic tasks use actual history, survive reloads, and respect removal and restoration', async ({
  page,
}) => {
  const car = await addElantra(page);
  await expect(car.locator('.garage-reminder')).toHaveCount(6);
  await expect(car.getByText('Needs history', { exact: true })).toHaveCount(6);
  const initial = await page.evaluate(
    () => JSON.parse(localStorage.getItem('oss-garage-v1')!).vehicles[0],
  );
  expect(initial.records).toEqual([]);
  await page.reload();
  await expect(car.locator('.garage-reminder')).toHaveCount(6);
  await car
    .getByRole('button', { name: 'Add service history: Engine oil and filter', exact: true })
    .click();
  const form = page.getByRole('form', {
    name: 'Log service for 2016 Hyundai Elantra',
    exact: true,
  });
  await expect(form.getByLabel('Service date', { exact: true })).toHaveValue('');
  await form.getByLabel('Service date', { exact: true }).fill('2026-10-01');
  await form.getByLabel('Service odometer (km)').fill('168000');
  await form.getByRole('button', { name: 'Save service record', exact: true }).click();
  const oil = car
    .locator('.garage-reminder')
    .filter({ has: page.getByRole('heading', { name: 'Engine oil and filter', exact: true }) });
  await expect(oil).toContainText('174,000 km or 2027-04-01');
  await oil
    .getByRole('button', { name: 'Remove reminder: Engine oil and filter', exact: true })
    .click();
  await oil.getByRole('button', { name: 'Remove reminder', exact: true }).click();
  await page.reload();
  await expect(car.locator('.garage-reminder')).toHaveCount(5);
  await expect(oil).toHaveCount(0);
  const removed = await page.evaluate(
    () => JSON.parse(localStorage.getItem('oss-garage-v1')!).vehicles[0],
  );
  expect(removed.records[0].reminderId).toBeNull();
  await car
    .getByRole('button', { name: 'Restore removed manufacturer tasks', exact: true })
    .click();
  await expect(car.locator('.garage-reminder')).toHaveCount(6);
  await expect(oil).toContainText('Needs history');
});

test('existing garages gain tasks without guessing what unlinked service records completed', async ({
  page,
}) => {
  const original = JSON.stringify({
    version: 1,
    revision: 'old-garage',
    vehicles: [
      {
        id: 'my-car',
        make: 'Hyundai',
        model: 'Elantra',
        year: 2016,
        engine: 'GL',
        nickname: '',
        odometerKm: 170000,
        updatedOn: '2026-10-26',
        reminders: [],
        records: [
          {
            id: 'old-receipt',
            reminderId: null,
            title: 'Oil changed',
            on: '2026-10-01',
            km: 168000,
            note: 'Historical receipt',
          },
        ],
      },
    ],
  });
  await page.addInitScript((raw) => {
    if (localStorage.getItem('oss-garage-v1') === null) localStorage.setItem('oss-garage-v1', raw);
  }, original);
  await page.goto('/garage');
  const car = page.getByRole('article', { name: '2016 Hyundai Elantra', exact: true });
  await expect(car.locator('.garage-reminder')).toHaveCount(6);
  await expect(car.getByText('Needs history', { exact: true })).toHaveCount(6);
  expect(await page.evaluate(() => localStorage.getItem('oss-garage-v1'))).toBe(original);
  await car.getByRole('button', { name: 'Update odometer', exact: true }).click();
  await car.getByLabel('New odometer (km)').fill('170001');
  await car.getByRole('button', { name: 'Save odometer', exact: true }).click();
  await page.reload();
  await expect(car.locator('.garage-reminder')).toHaveCount(6);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('oss-garage-v1')!).vehicles[0],
  );
  expect(saved.records).toEqual(JSON.parse(original).vehicles[0].records);
  expect(saved.reminders).toHaveLength(6);
});
