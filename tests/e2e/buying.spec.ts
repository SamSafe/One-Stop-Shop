import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const view = '/?q=2027%20Subaru%20BRZ&kind=retail-trim';
const target = (page: Page) =>
  page.getByRole('article').filter({ has: page.locator('#title-subaru-ca-1625') });
const journal = (page: Page) =>
  page.getByRole('dialog', { name: 'Test-drive journal', exact: true });
const brief = (page: Page) => page.getByRole('dialog', { name: 'Your buying brief', exact: true });
async function openBrief(page: Page) {
  await page.getByRole('button', { name: /^(Create|Edit) buying brief$/ }).click();
  await expect(brief(page)).toBeVisible();
}
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

test('a saved power-focused brief requires chosen body styles and survives reload, pause and cancellation', async ({
  page,
}) => {
  await page.goto('/?q=2026%20Toyota%20GR86&kind=retail-trim');
  const chosen = page
    .getByRole('article')
    .filter({ has: page.locator('#title-toyota-ca-2026-t86-znbb6m-a') });
  await openBrief(page);
  const d = brief(page);
  await d.getByLabel('Maximum base MSRP · CAD', { exact: true }).fill('50000');
  await d.getByRole('combobox', { name: 'Minimum seats', exact: true }).selectOption('4');
  await d.getByLabel('Coupe', { exact: true }).check();
  await d.getByLabel('Only show these body styles', { exact: true }).check();
  await d.getByRole('combobox', { name: 'Preferred drivetrain', exact: true }).selectOption('RWD');
  await d.getByLabel('Drivetrain is a must-have', { exact: true }).check();
  await d.getByText('Optional questionnaire: what matters to you?', { exact: true }).click();
  await d.getByRole('button', { name: 'More power', exact: true }).click();
  await d.getByRole('slider', { name: 'Energy cost importance', exact: true }).focus();
  await d.getByRole('slider', { name: 'Energy cost importance', exact: true }).press('Home');
  await d.getByLabel('Horsepower target · hp', { exact: true }).fill('200');
  await d.getByLabel('Horsepower target is a minimum requirement', { exact: true }).check();
  await d.getByRole('button', { name: 'Save and use brief', exact: true }).click();
  await expect(chosen).toContainText('Meets your requirements');
  await expect(chosen).toContainText('200+ hp');
  await expect(chosen.locator('.fit-score > strong')).not.toContainText('—');
  await expect(page.locator('.buying-brief-summary')).toContainText('Coupe only');
  await page.reload();
  await expect(page.locator('.buying-brief-summary')).toContainText('RWD required');
  await openBrief(page);
  await d.getByLabel('Maximum base MSRP · CAD', { exact: true }).fill('10000');
  await d.getByRole('button', { name: 'Cancel brief', exact: true }).click();
  await expect(chosen).toBeVisible();
  await page.getByRole('button', { name: 'Pause buying brief', exact: true }).click();
  await expect(chosen).toContainText('fit score');
  await expect(chosen).not.toContainText('brief fit score');
  await page.getByRole('button', { name: 'Use buying brief', exact: true }).click();
  await expect(chosen).toContainText('brief fit score');
});

test('unverified requirements are hidden by default and explicitly unscored when included', async ({
  page,
}) => {
  await page.goto('/?q=BRZ&kind=government-rating');
  await expect(page.getByRole('article').first()).toBeVisible();
  await openBrief(page);
  const d = brief(page);
  await d.getByText('Optional questionnaire: what matters to you?', { exact: true }).click();
  await d.getByLabel('Horsepower target is a minimum requirement', { exact: true }).check();
  await d.getByRole('button', { name: 'Save and use brief', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
  await openBrief(page);
  await d
    .getByLabel('Include vehicles with unverified requirements for me to check', { exact: true })
    .check();
  await d.getByRole('button', { name: 'Save and use brief', exact: true }).click();
  const car = page.getByRole('article').first();
  await expect(car).toContainText('Requirements need checking');
  await expect(car.locator('.fit-score > strong')).toContainText('—');
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
  await openBrief(page);
  await brief(page)
    .getByLabel('Hide vehicles I ruled out in my latest test-drive review', { exact: true })
    .check();
  await brief(page).getByRole('button', { name: 'Save and use brief', exact: true }).click();
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
  await openBrief(page);
  await brief(page).getByLabel('Maximum base MSRP · CAD', { exact: true }).fill('60000');
  await brief(page).getByRole('button', { name: 'Save and use brief', exact: true }).click();
  await startReview(page, 'Personal backup notes.');
  const d = journal(page);
  await d.getByText('Buying backups & device data', { exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await d.getByRole('button', { name: 'Export buying backup', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('oss-buying-backup.json');
  const content = await readFile((await download.path())!, 'utf8');
  const backup = JSON.parse(content);
  expect(backup.brief.budget).toBe(60000);
  expect(backup.reviews[0].notes).toBe('Personal backup notes.');
  await d.getByRole('button', { name: 'Clear buying brief and reviews', exact: true }).click();
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
  await expect(page.locator('.buying-brief-summary')).toContainText('$60,000');
  await expect(
    page.getByRole('button', { name: 'Test-drive journal (1)', exact: true }),
  ).toBeVisible();
});

test('briefs and personal reviews stay out of copied links and survive shortlist clearing', async ({
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
  await openBrief(page);
  await brief(page).getByLabel('Maximum base MSRP · CAD', { exact: true }).fill('50000');
  await brief(page).getByRole('button', { name: 'Save and use brief', exact: true }).click();
  await page.getByRole('button', { name: 'Copy search link', exact: true }).click();
  const link = await page.getByLabel('Search link', { exact: true }).inputValue();
  expect(link).not.toContain('PRIVATE');
  expect(link).not.toContain('50000');
  expect(link).not.toContain('oss-buying');
  const guest = await browser.newContext();
  try {
    const recipient = await guest.newPage();
    await recipient.goto(link);
    await expect(
      recipient.getByRole('button', { name: 'Create buying brief', exact: true }),
    ).toBeVisible();
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

test('stale review and brief edits reject changes made in another tab', async ({
  page,
  context,
}) => {
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
  await d.getByRole('button', { name: 'Close journal', exact: true }).click();
  await openBrief(page);
  await brief(page).getByRole('button', { name: 'Save and use brief', exact: true }).click();
  await openBrief(page);
  await brief(page).getByLabel('Maximum base MSRP · CAD', { exact: true }).fill('50000');
  await other.evaluate(() => {
    const w = JSON.parse(localStorage.getItem('oss-buying-v1')!);
    w.brief.budget = 45000;
    w.revision = crypto.randomUUID();
    localStorage.setItem('oss-buying-v1', JSON.stringify(w));
  });
  await brief(page).getByRole('button', { name: 'Save and use brief', exact: true }).click();
  await expect(brief(page).getByRole('alert')).toContainText('another tab');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('oss-buying-v1')!).brief.budget),
  ).toBe(45000);
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
  await openBrief(page);
  await brief(page)
    .getByText('Optional questionnaire: what matters to you?', { exact: true })
    .click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await brief(page).getByRole('button', { name: 'Save and use brief', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('oss-buying-v1'))).toBe(
    '{"version":99,"original":"keep"}',
  );
  await startReview(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await journal(page).getByRole('button', { name: 'Close journal', exact: true }).click();
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark');
  await page.getByRole('button', { name: 'Test-drive journal (1)', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await journal(page).getByText('Buying backups & device data', { exact: true }).click();
  await journal(page)
    .getByRole('button', { name: 'Clear buying brief and reviews', exact: true })
    .click();
  await journal(page)
    .getByRole('button', { name: 'Confirm clear buying data', exact: true })
    .click();
  expect(await page.evaluate(() => localStorage.getItem('oss-buying-v1'))).toBeNull();
});

test('failed device writes retain the entire visit-only brief and review in an exportable backup', async ({
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
  await d.getByRole('button', { name: 'Close journal', exact: true }).click();
  await openBrief(page);
  await brief(page).getByLabel('Maximum base MSRP · CAD', { exact: true }).fill('55000');
  await brief(page).getByRole('button', { name: 'Save and use brief', exact: true }).click();
  await page.getByRole('button', { name: 'Test-drive journal (1)', exact: true }).click();
  await d.getByText('Buying backups & device data', { exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await d.getByRole('button', { name: 'Export buying backup', exact: true }).click();
  const download = await downloaded;
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.brief.budget).toBe(55000);
  expect(backup.reviews[0].notes).toBe('Keep these session notes.');
  expect(await page.evaluate(() => localStorage.getItem('oss-buying-v1'))).toBeNull();
});
