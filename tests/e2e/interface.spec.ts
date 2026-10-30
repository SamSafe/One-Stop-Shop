import { test, expect } from '@playwright/test';
import type { Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function unobstructed(control: Locator, dialog: Locator) {
  await expect
    .poll(async () => {
      const box = await control.boundingBox();
      const header = await dialog.locator(':scope > .dialog-header').boundingBox();
      const footer = await dialog.locator(':scope > .dialog-actions').boundingBox();
      return {
        belowHeader: !!box && box.y >= header!.y + header!.height - 1,
        aboveFooter: !!box && box.y + box.height <= footer!.y + 1,
      };
    })
    .toEqual({ belowHeader: true, aboveFooter: true });
}

for (const theme of ['light', 'dark']) {
  test(`navigation, fields and appearance stay consistent between comparison and Garage in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.goto('/?q=2026%20Honda%20CR-V&kind=retail-trim');
    const search = page.getByRole('searchbox', { name: 'Search cars', exact: true });
    await expect(search).toBeVisible();
    await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption(theme);
    const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true });
    const before = await navigation
      .getByRole('link', { name: 'Compare vehicles', exact: true })
      .boundingBox();
    const fieldStyle = await search.evaluate((el) => {
      const s = getComputedStyle(el);
      return { radius: s.borderRadius, height: s.height, font: s.fontSize };
    });
    await page.getByRole('button', { name: 'Filters & priorities', exact: true }).click();
    const energyStyle = await page
      .getByRole('spinbutton', { name: 'Fuel price · CAD / litre', exact: true })
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { radius: s.borderRadius, height: s.height, font: s.fontSize };
      });
    expect(energyStyle).toEqual(fieldStyle);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`comparison-${theme}.png`) });
    await navigation.getByRole('link', { name: 'My garage', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your garage', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const after = await navigation
      .getByRole('link', { name: 'Compare vehicles', exact: true })
      .boundingBox();
    expect(Math.abs(before!.x - after!.x)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: '+ Add a vehicle', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Which vehicle do you own?', exact: true }),
    ).toBeFocused();
    await page
      .getByRole('button', {
        name: 'Vehicle or year not listed? Enter details manually',
        exact: true,
      })
      .click();
    const form = page.getByRole('form', { name: 'Add a vehicle', exact: true });
    const make = form.getByRole('textbox', { name: 'Make', exact: true });
    await expect(make).toBeFocused();
    const garageStyle = await make.evaluate((el) => {
      const s = getComputedStyle(el);
      return { radius: s.borderRadius, height: s.height, font: s.fontSize };
    });
    expect(garageStyle).toEqual(fieldStyle);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`garage-form-${theme}.png`) });
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: '+ Add a vehicle', exact: true })).toBeFocused();
  });
}

test('journal editing keeps save actions visible and returns focus to saved reviews', async ({
  page,
}) => {
  await page.goto('/?q=2026%20Toyota%20GR86&kind=retail-trim');
  await page
    .getByRole('article')
    .first()
    .getByRole('button', { name: /^Test-drive notes for/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Test-drive journal', exact: true });
  await expect(
    dialog.getByRole('heading', { name: 'Saved test drives (0)', exact: true }),
  ).not.toBeVisible();
  const notes = dialog.getByRole('textbox', { name: 'Your test-drive notes', exact: true });
  await notes.fill('Easy to see out of. Try a longer drive next time.');
  const save = dialog.getByRole('button', { name: 'Save test-drive review', exact: true });
  await expect(save).toBeInViewport({ ratio: 1 });
  await unobstructed(notes, dialog);
  await save.click();
  const results = dialog.getByRole('heading', { name: 'Saved test drives (1)', exact: true });
  await expect(results).toBeFocused();
  await dialog.getByRole('button', { name: 'Edit review', exact: true }).click();
  await notes.fill('An unsaved correction');
  await expect(save).toBeInViewport({ ratio: 1 });
  await dialog.getByRole('button', { name: 'Cancel review', exact: true }).click();
  await expect(results).toBeFocused();
  await expect(dialog).toContainText('Easy to see out of. Try a longer drive next time.');
  await expect(dialog).not.toContainText('An unsaved correction');
});

test('shortlist comparison actions remain available while paging through saved vehicles', async ({
  page,
}) => {
  await page.goto('/');
  for (let index = 0; index < 13; index++)
    await page
      .getByRole('button', { name: /^Save /, pressed: false })
      .first()
      .click();
  await page.getByRole('button', { name: 'Manage shortlist (13)', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Your shortlist', exact: true });
  await expect(dialog.getByRole('button', { name: 'Compare 0 cars', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await dialog.getByRole('button', { name: 'Next saved vehicles', exact: true }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Saved vehicles · Page 2 of 2', exact: true }),
  ).toBeFocused();
  await dialog.getByRole('checkbox').nth(0).check();
  await dialog.getByRole('checkbox').nth(1).check();
  const compare = dialog.getByRole('button', { name: 'Compare 2 cars', exact: true });
  await expect(compare).toBeInViewport({ ratio: 1 });
  await compare.click();
  await expect(
    page.getByRole('dialog', { name: 'Compare specifications', exact: true }),
  ).toBeVisible();
});

test('scoring details and publication notes expand without crowding the catalog', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const methodology = page.getByRole('region', { name: 'How scoring works', exact: true });
  await methodology.getByText('Default score scales', { exact: true }).click();
  await expect(methodology).toContainText('CAD $30,000–$60,000');
  await methodology.getByText('Limits and unverified figures', { exact: true }).click();
  await expect(methodology).toContainText('Keep vehicles with unverified');
  await page.getByText(/^Browse [\d,]+ official sources$/).click();
  const entry = page.locator('.source-entry').first();
  await expect(entry.getByRole('link')).toHaveAttribute('href', /^https:\/\//);
  await expect(entry.locator('details')).not.toHaveAttribute('open', '');
  await entry.getByText('Publication details', { exact: true }).click();
  await expect(entry.locator('details p')).toBeVisible();
  await page.getByText('How your data works', { exact: true }).click();
  await expect(page.locator('#privacy')).toContainText('test-drive reviews');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await entry.screenshot({ path: testInfo.outputPath('source-details.png') });
});

test('Garage backup preview keeps the most recently chosen file when an older read finishes later', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const text = File.prototype.text;
    File.prototype.text = async function () {
      const raw = await text.call(this);
      if (this.name !== 'slow.json') return raw;
      return new Promise<string>((resolve) =>
        Object.assign(window, { releaseSlowGarage: () => resolve(raw) }),
      );
    };
  });
  await page.goto('/garage');
  const input = page.getByLabel('Choose garage backup', { exact: true });
  const vehicle = {
    id: 'owned-one',
    year: 2020,
    make: 'Example',
    model: 'Sedan',
    engine: '',
    nickname: '',
    odometerKm: 20000,
    updatedOn: '2026-10-28',
    reminders: [],
    records: [],
  };
  const backup = (vehicles: (typeof vehicle)[], name: string) => ({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ version: 1, revision: `backup-${name.split('.')[0]}`, vehicles }),
    ),
  });
  await input.setInputFiles(backup([], 'slow.json'));
  await expect.poll(() => page.evaluate(() => 'releaseSlowGarage' in window)).toBe(true);
  await input.setInputFiles(backup([vehicle], 'new.json'));
  await expect(page.locator('.garage-confirm')).toContainText('1 vehicle');
  await page.evaluate(() =>
    (window as unknown as { releaseSlowGarage: () => void }).releaseSlowGarage(),
  );
  await page.getByRole('button', { name: 'Replace garage with backup', exact: true }).click();
  await expect(
    page.getByRole('article', { name: '2020 Example Sedan', exact: true }),
  ).toBeVisible();
});
