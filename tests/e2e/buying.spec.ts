import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { revealCatalogFilters } from './catalog-helpers';

const view = '/?q=2027%20Subaru%20BRZ&kind=retail-trim';
const target = (page: Page) =>
  page.getByRole('article').filter({ has: page.locator('#title-subaru-ca-1625') });
const journal = (page: Page) =>
  page.getByRole('dialog', { name: 'Test-drive journal', exact: true });
async function startReview(
  page: Page,
  notes = 'Wonderful steering; check visibility again.',
  verdict = 'consider',
) {
  await target(page)
    .getByRole('button', { name: /^Test-drive notes for/ })
    .click();
  await journal(page).getByLabel('Test-drive date', { exact: true }).fill('2020-01-02');
  await journal(page)
    .getByRole('combobox', { name: 'Your verdict', exact: true })
    .selectOption(verdict);
  await journal(page)
    .getByRole('combobox', { name: 'Driving enjoyment', exact: true })
    .selectOption('5');
  await journal(page)
    .getByRole('textbox', { name: 'Your test-drive notes', exact: true })
    .fill(notes);
  await journal(page).getByRole('button', { name: 'Save test-drive review', exact: true }).click();
}

test('power, body and drivetrain limits with a performance ranking survive reload', async ({
  page,
}) => {
  await page.goto('/?q=2026%20Toyota%20GR86&kind=retail-trim');
  const chosen = page
    .getByRole('article')
    .filter({ has: page.locator('#title-toyota-ca-2026-t86-znbb6m-a') });
  await revealCatalogFilters(page);
  await page.getByRole('combobox', { name: 'Max base MSRP', exact: true }).selectOption('50000');
  await page.getByRole('combobox', { name: 'Minimum seats', exact: true }).selectOption('4');
  await page.getByRole('combobox', { name: 'Body style', exact: true }).selectOption('Coupe');
  await page.getByRole('combobox', { name: 'Drivetrain', exact: true }).selectOption('RWD');
  await page.getByRole('combobox', { name: 'Minimum horsepower', exact: true }).selectOption('200');
  await page.getByRole('button', { name: 'Performance', exact: true }).click();
  await expect(chosen.locator('.fit-score > strong')).not.toContainText('—');
  await expect(chosen).not.toContainText('Check before buying');
  await expect(page).toHaveURL(/hp=200/);
  await expect(page).toHaveURL(/power=5/);
  await page.reload();
  await expect(chosen).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Remove Minimum horsepower: 200+ hp filter' }),
  ).toBeVisible();
  await revealCatalogFilters(page);
  await page.getByRole('combobox', { name: 'Minimum horsepower', exact: true }).selectOption('300');
  await expect(chosen).toHaveCount(0);
});

test('unverified limits are hidden by default and explicitly unscored when kept', async ({
  page,
}) => {
  await page.goto('/?q=BRZ&kind=government-rating&hp=150');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.locator('.unchecked-notice')).toContainText('no verified figure');
  await revealCatalogFilters(page);
  await page
    .getByLabel('Keep vehicles with unverified price, seats, power or legroom', { exact: true })
    .check();
  const car = page.getByRole('article').first();
  await expect(car).toContainText('Check before buying');
  await expect(car.locator('.fit-score > strong')).toContainText('—');
  await expect(page.locator('.unchecked-notice')).toHaveCount(0);
});

test('multiple personal test drives persist, retain unassessed ratings and appear alongside comparison facts', async ({
  page,
}) => {
  await page.goto(view);
  await startReview(page);
  const d = journal(page);
  await expect(d).toContainText('Seat comfort');
  await expect(d).toContainText('Not assessed');
  await d.getByRole('button', { name: 'Record another test drive', exact: true }).click();
  await d.getByLabel('Test-drive date', { exact: true }).fill('2020-01-03');
  await d
    .getByRole('textbox', { name: 'Your test-drive notes', exact: true })
    .fill('Second visit: comfortable over bumps.');
  await d.getByRole('button', { name: 'Save test-drive review', exact: true }).click();
  await expect(
    d.getByRole('heading', { name: 'Saved test drives (2)', exact: true }),
  ).toBeVisible();
  await d.getByRole('button', { name: 'Close journal', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Test-drive journal (2)', exact: true }),
  ).toBeVisible();
  await target(page)
    .getByRole('checkbox', { name: /^Compare / })
    .check();
  await page
    .getByRole('article')
    .filter({ hasText: 'Sport-tech (AT)' })
    .getByRole('checkbox', { name: /^Compare / })
    .check();
  await page
    .getByRole('region', { name: 'Selected cars', exact: true })
    .getByRole('button', { name: 'Compare 2 cars', exact: true })
    .click();
  const compare = page.getByRole('dialog', { name: 'Compare specifications', exact: true });
  await expect(compare.getByRole('row', { name: /^Your latest test drive/ })).toContainText(
    '2020-01-03',
  );
  const experience = compare.getByRole('row', { name: /^Your latest test drive/ });
  await expect(experience).toContainText('Seat comfort');
  await expect(experience).toContainText('Not assessed');
  await experience.getByText('Read test-drive notes', { exact: true }).click();
  await expect(experience).toContainText('Second visit: comfortable over bumps.');
  await compare.getByRole('button', { name: 'Close comparison', exact: true }).click();
  await page.getByRole('button', { name: 'Test-drive journal (2)', exact: true }).click();
  await d.getByLabel('Search test-drive notes', { exact: true }).fill('steering');
  await expect(
    d.getByRole('heading', { name: 'Saved test drives (1)', exact: true }),
  ).toBeVisible();
  await d.getByRole('button', { name: 'Edit review', exact: true }).click();
  await d
    .getByRole('textbox', { name: 'Your test-drive notes', exact: true })
    .fill('Steering: still excellent.');
  await d.getByRole('button', { name: 'Save test-drive review', exact: true }).click();
  await expect(d).toContainText('Steering: still excellent.');
  await d.getByRole('button', { name: 'Remove review', exact: true }).click();
  await d.getByRole('button', { name: 'Keep review', exact: true }).click();
  await expect(d).toContainText('Steering: still excellent.');
  await d.getByRole('button', { name: 'Remove review', exact: true }).click();
  await d.getByRole('button', { name: 'Confirm remove review', exact: true }).click();
  await d.getByLabel('Search test-drive notes', { exact: true }).fill('');
  await expect(
    d.getByRole('heading', { name: 'Saved test drives (1)', exact: true }),
  ).toBeVisible();
  await expect(d).toContainText('Second visit: comfortable over bumps.');
});

test('hiding ruled-out vehicles is opt-in and a newer test-drive verdict restores them', async ({
  page,
}) => {
  await page.goto(view);
  await startReview(page, 'Too noisy for me.', 'ruled-out');
  await journal(page).getByRole('button', { name: 'Close journal', exact: true }).click();
  await expect(target(page)).toBeVisible();
  await revealCatalogFilters(page);
  await page.getByLabel('Hide vehicles I ruled out after a test drive 1', { exact: true }).check();
  await expect(target(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Test-drive journal (1)', exact: true }).click();
  const d = journal(page);
  await d
    .getByRole('combobox', { name: 'Journal vehicle', exact: true })
    .selectOption('subaru-ca-1625');
  await d.getByRole('button', { name: 'Record another test drive', exact: true }).click();
  await d.getByLabel('Test-drive date', { exact: true }).fill('2020-01-03');
  await d.getByRole('combobox', { name: 'Your verdict', exact: true }).selectOption('consider');
  await d.getByRole('button', { name: 'Save test-drive review', exact: true }).click();
  await d.getByRole('button', { name: 'Close journal', exact: true }).click();
  await expect(target(page)).toBeVisible();
});

test('buying backups restore after explicit clearing and merge without overwriting existing reviews', async ({
  page,
}) => {
  await page.goto(view);
  await startReview(page, 'Personal backup notes.');
  const d = journal(page);
  await d.getByText('Buying backups & device data', { exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await d.getByRole('button', { name: 'Export buying backup', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('oss-buying-backup.json');
  const content = await readFile((await download.path())!, 'utf8');
  const backup = JSON.parse(content);
  expect(backup).not.toHaveProperty('brief');
  expect(backup.reviews[0].notes).toBe('Personal backup notes.');
  await d.getByRole('button', { name: 'Clear test-drive reviews', exact: true }).click();
  await d.getByRole('button', { name: 'Confirm clear buying data', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('oss-buying-v1'))).toBeNull();
  await d.getByLabel('Choose buying backup', { exact: true }).setInputFiles({
    name: 'buying.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });
  await expect(d.getByRole('region', { name: 'Buying import preview', exact: true })).toBeVisible();
  await d.getByRole('button', { name: 'Merge buying backup', exact: true }).click();
  backup.reviews[0].notes = 'Conflicting backup must not overwrite';
  await d.getByLabel('Choose buying backup', { exact: true }).setInputFiles({
    name: 'buying.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await d.getByRole('button', { name: 'Merge buying backup', exact: true }).click();
  await expect(d).toContainText('Personal backup notes.');
  await expect(d).not.toContainText('Conflicting backup must not overwrite');
  await d.getByRole('button', { name: 'Close journal', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Test-drive journal (1)', exact: true }),
  ).toBeVisible();
});

test('personal reviews stay out of copied links and survive shortlist clearing', async ({
  page,
  browser,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Unavailable')) },
    }),
  );
  await page.goto(view);
  await startReview(page, 'PRIVATE TEST DRIVE NOTE');
  await journal(page).getByRole('button', { name: 'Close journal', exact: true }).click();
  await page.getByRole('button', { name: 'Copy search link', exact: true }).click();
  const link = await page.getByLabel('Search link', { exact: true }).inputValue();
  expect(link).not.toContain('PRIVATE');
  expect(link).not.toContain('oss-buying');
  const guest = await browser.newContext();
  try {
    const recipient = await guest.newPage();
    await recipient.goto(link);
    await expect(
      recipient.getByRole('button', { name: 'Test-drive journal (0)', exact: true }),
    ).toBeVisible();
  } finally {
    await guest.close();
  }
  await page.getByText('How your data works', { exact: true }).click();
  await page.getByRole('button', { name: 'Clear my shortlist', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Test-drive journal (1)', exact: true }),
  ).toBeVisible();
});

test('stale review edits reject changes made in another tab', async ({ page, context }) => {
  await page.goto(view);
  await startReview(page, 'Original notes');
  const d = journal(page);
  await d.getByRole('button', { name: 'Edit review', exact: true }).click();
  await d.getByRole('textbox', { name: 'Your test-drive notes', exact: true }).fill('Stale draft');
  const other = await context.newPage();
  await other.goto(view);
  await other.evaluate(() => {
    const w = JSON.parse(localStorage.getItem('oss-buying-v1')!);
    w.reviews[0].notes = 'Newer notes from another tab';
    w.revision = crypto.randomUUID();
    localStorage.setItem('oss-buying-v1', JSON.stringify(w));
  });
  await d.getByRole('button', { name: 'Save test-drive review', exact: true }).click();
  await expect(d.getByRole('alert')).toContainText('another tab');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('oss-buying-v1')!).reviews[0].notes),
  ).toBe('Newer notes from another tab');
  await other.close();
});

test('unreadable originals are preserved until explicit clearing and new dialog views are accessible', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('buying-seeded')) {
      localStorage.setItem('oss-buying-v1', '{"version":99,"original":"keep"}');
      sessionStorage.setItem('buying-seeded', '1');
    }
  });
  await page.goto(view);
  await startReview(page);
  expect(await page.evaluate(() => localStorage.getItem('oss-buying-v1'))).toBe(
    '{"version":99,"original":"keep"}',
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await journal(page).getByRole('button', { name: 'Close journal', exact: true }).click();
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark');
  await page.getByRole('button', { name: 'Test-drive journal (1)', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await journal(page).getByText('Buying backups & device data', { exact: true }).click();
  await journal(page)
    .getByRole('button', { name: 'Clear test-drive reviews', exact: true })
    .click();
  await journal(page)
    .getByRole('button', { name: 'Confirm clear buying data', exact: true })
    .click();
  expect(await page.evaluate(() => localStorage.getItem('oss-buying-v1'))).toBeNull();
});

test('failed device writes retain the visit-only review in an exportable backup', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'oss-buying-v1') throw new DOMException('Storage full', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  });
  await page.goto(view);
  await startReview(page, 'Keep these session notes.');
  const d = journal(page);
  await expect(d).toContainText('kept for this visit only');
  await d.getByText('Buying backups & device data', { exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await d.getByRole('button', { name: 'Export buying backup', exact: true }).click();
  const download = await downloaded;
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.reviews[0].notes).toBe('Keep these session notes.');
  expect(await page.evaluate(() => localStorage.getItem('oss-buying-v1'))).toBeNull();
});
