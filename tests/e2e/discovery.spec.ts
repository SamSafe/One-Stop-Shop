import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('priced EV discovery gives real fit scores and shares the same energy assumptions', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Electric vehicles', exact: true }).click();
  await page.getByRole('button', { name: 'Filters & priorities', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Verified base price only', exact: true }).check();
  await expect(page.getByRole('article').first().locator('.fit-score > strong')).not.toContainText(
    '—',
  );
  await page.getByLabel('Electric unit price for ranking · CAD / kWh', { exact: true }).fill('0.3');
  await page
    .getByRole('article')
    .nth(0)
    .getByRole('checkbox', { name: /^Compare / })
    .check();
  await page
    .getByRole('article')
    .nth(1)
    .getByRole('checkbox', { name: /^Compare / })
    .check();
  await page
    .getByRole('region', { name: 'Selected cars', exact: true })
    .getByRole('button', { name: 'Compare 2 cars', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Electricity · CAD / kWh', { exact: true })).toHaveValue('0.3');
  await dialog.getByLabel('Annual kilometres', { exact: true }).fill('24000');
  await expect(page).toHaveURL(/electricityPrice=0.3/);
  await page.reload();
  await expect(dialog.getByLabel('Annual kilometres', { exact: true })).toHaveValue('24000');
  await expect(dialog.getByLabel('Electricity · CAD / kWh', { exact: true })).toHaveValue('0.3');
  await expect(dialog.getByRole('row', { name: /^Your fit score/ })).not.toContainText('Unscored');
});

test('family SUV discovery uses verified seating and manufacturer body styles, with removable filters', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Family SUVs', exact: true }).click();
  await expect(page.getByRole('article').first()).toBeVisible();
  const group = page.getByRole('group', { name: 'Active filters', exact: true });
  await expect(group).toContainText('Body style: SUV');
  await expect(group).toContainText('Minimum seats: 5');
  await group.getByRole('button', { name: 'Remove Minimum seats: 5 filter', exact: true }).click();
  await expect(group).not.toContainText('Minimum seats');
  await page.getByRole('button', { name: 'Filters & priorities', exact: true }).click();
  await page.getByLabel('Make', { exact: true }).selectOption('Honda');
  await page.getByLabel('Model', { exact: true }).selectOption('CR-V');
  await page.getByRole('button', { name: 'Family space', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Has a fit score for my priorities', exact: true })
    .check();
  await expect(page.getByRole('article').first()).toBeVisible();
  await expect(page.getByRole('article').first().locator('.fit-score > strong')).not.toContainText(
    '—',
  );
});

test('garage exports known dates as a calendar and explains missing schedule coverage', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-27T12:00:00Z') });
  await page.addInitScript(() =>
    localStorage.setItem(
      'oss-garage-v1',
      JSON.stringify({
        version: 1,
        revision: 'calendar',
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
            records: [],
            reminders: [
              {
                id: 'oil',
                title: 'Oil and filter',
                km: 6000,
                months: 6,
                lastOn: '2026-10-01',
                lastKm: 18000,
              },
            ],
          },
        ],
      }),
    ),
  );
  await page.goto('/garage');
  await expect(
    page.getByText('Manufacturer schedule not yet reviewed · personal reminders available'),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export service dates (.ics)', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('oss-maintenance.ics');
  const content = await readFile((await download.path())!, 'utf8');
  expect(content).toContain('DTSTART;VALUE=DATE:20270401');
  expect(content).toContain('UID:car.oil@oss.local');
  await expect(page.getByRole('status')).toContainText('1 service date exported');
});
