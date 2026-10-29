import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

const key = 'oss-shortlist-v1';
const hondaId = 'honda-cr-v-2026-lx-fwd',
  hybridId = 'honda-cr-v-2026-sport-hybrid-awd',
  mazdaId = 'mazda-cx-5-2026-gx-awd';
const honda = '2026 Honda CR-V LX FWD',
  hybrid = '2026 Honda CR-V Sport Hybrid AWD';
async function open(page: Page, ids: string[] = [hondaId]) {
  await page.addInitScript((ids) => {
    if (!localStorage.getItem('oss-shortlist-v1'))
      localStorage.setItem('oss-shortlist-v1', JSON.stringify({ version: 1, ids }));
  }, ids);
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search cars', exact: true }).waitFor();
}
async function manager(page: Page) {
  await page.getByRole('button', { name: /^Manage shortlist \(/ }).click();
  return page.getByRole('dialog', { name: 'Your shortlist', exact: true });
}
const saved = (page: Page): Promise<{ version: number; ids: string[] }> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
function backup(ids: string[], name = 'shortlist.json') {
  return {
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 1, ids })),
  };
}

test('manager pages all saved vehicles, exports the complete list, and supports accessible comparison selection independent of filters', async ({
  page,
}) => {
  await open(page, []);
  for (let index = 0; index < 13; index++)
    await page
      .getByRole('button', { name: /^Save / })
      .first()
      .click();
  const original = await saved(page);
  await page
    .getByRole('searchbox', { name: 'Search cars', exact: true })
    .fill('no-such-configuration');
  let dialog = await manager(page);
  await expect(dialog.locator('li')).toHaveCount(10);
  const choices = dialog.getByRole('checkbox');
  for (let index = 0; index < 4; index++) await choices.nth(index).check();
  await expect(choices.nth(4)).toBeDisabled();
  await choices.first().uncheck();
  await choices.nth(4).check();
  await dialog.getByRole('button', { name: 'Next saved vehicles', exact: true }).click();
  await expect(dialog.locator('li')).toHaveCount(3);
  await expect(
    dialog.getByRole('heading', { name: 'Saved vehicles · Page 2 of 2', exact: true }),
  ).toBeFocused();
  await dialog
    .getByRole('button', { name: /^Remove .* from shortlist$/ })
    .first()
    .click();
  await expect(dialog.locator('li')).toHaveCount(2);
  const downloadEvent = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export shortlist', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('oss-shortlist-backup.json');
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.ids).toHaveLength(12);
  expect(exported).toEqual(await saved(page));
  expect(original.ids.filter((id) => !exported.ids.includes(id))).toHaveLength(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Manage shortlist \(/ })).toBeFocused();
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark');
  dialog = await manager(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Compare 4 cars', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Compare specifications', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close comparison', exact: true }).click();
  dialog = await manager(page);
  await dialog
    .getByRole('button', { name: 'Show entire shortlist in catalog', exact: true })
    .click();
  await expect(page.getByRole('article')).toHaveCount(12);
  await expect(page.getByRole('searchbox', { name: 'Search cars', exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Compare 4 cars', exact: true })).toBeVisible();
});

test('backup import previews duplicates and unavailable configurations, supports cancellation, and rejects malformed or oversized files', async ({
  page,
}) => {
  await open(page);
  const dialog = await manager(page),
    original = await saved(page),
    file = backup([hondaId, hondaId, mazdaId, 'missing-config']);
  await dialog.getByLabel('Choose shortlist backup', { exact: true }).setInputFiles(file);
  await expect(dialog).toContainText('2 vehicles are available');
  await expect(dialog).toContainText('1 is already saved');
  await expect(dialog).toContainText('1 vehicle is unavailable');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await saved(page)).toEqual(original);
  await dialog.getByRole('button', { name: 'Cancel import', exact: true }).click();
  await expect(dialog.getByLabel('Choose shortlist backup', { exact: true })).toBeFocused();
  expect(await saved(page)).toEqual(original);
  await dialog.getByLabel('Choose shortlist backup', { exact: true }).setInputFiles(file);
  await dialog.getByRole('button', { name: 'Add vehicles', exact: true }).click();
  expect((await saved(page)).ids).toEqual([hondaId, mazdaId]);
  for (const buffer of [
    Buffer.from('{bad'),
    Buffer.from('{"version":2,"ids":[]}'),
    Buffer.alloc(2_000_001, 32),
  ]) {
    await dialog
      .getByLabel('Choose shortlist backup', { exact: true })
      .setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer });
    await expect(dialog.getByRole('alert')).toBeVisible();
    expect((await saved(page)).ids).toEqual([hondaId, mazdaId]);
  }
  await dialog
    .getByLabel('Choose shortlist backup', { exact: true })
    .setInputFiles(backup(['unavailable-only']));
  await expect(dialog.getByRole('button', { name: 'Add vehicles', exact: true })).toBeDisabled();
  expect(new URL(page.url()).searchParams.has('compare')).toBe(false);
});

test('import merges the latest cross-tab shortlist and keeps the active comparison unchanged', async ({
  page,
  context,
}) => {
  await open(page);
  await page.getByRole('searchbox', { name: 'Search cars', exact: true }).fill('2026 Honda CR-V');
  await page.getByRole('checkbox', { name: `Compare ${honda}`, exact: true }).check();
  await page.getByRole('checkbox', { name: `Compare ${hybrid}`, exact: true }).check();
  const dialog = await manager(page);
  await dialog
    .getByLabel('Choose shortlist backup', { exact: true })
    .setInputFiles(backup([mazdaId]));
  const other = await context.newPage();
  await other.goto('/');
  await other.getByRole('searchbox', { name: 'Search cars', exact: true }).fill('2026 Honda CR-V');
  await other.getByRole('button', { name: `Save ${hybrid}`, exact: true }).click();
  await dialog.getByRole('button', { name: 'Add vehicles', exact: true }).click();
  expect((await saved(page)).ids).toEqual([hondaId, hybridId, mazdaId]);
  expect(new URL(page.url()).searchParams.get('compare')?.split(',')).toEqual([hondaId, hybridId]);
  await expect(dialog.locator('li')).toHaveCount(3);
  await other.close();
});

test('import preserves an unreadable saved original and offers a portable copy of session choices', async ({
  page,
}) => {
  const raw = '{"version":2,"ids":["future-choice"],"privateNote":"keep"}';
  await page.addInitScript((raw) => localStorage.setItem('oss-shortlist-v1', raw), raw);
  await page.goto('/');
  const dialog = await manager(page);
  await dialog
    .getByLabel('Choose shortlist backup', { exact: true })
    .setInputFiles(backup([hondaId]));
  await dialog.getByRole('button', { name: 'Add vehicles', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('only last for this visit');
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
  const event = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export shortlist', exact: true }).click();
  expect(JSON.parse(await readFile((await (await event).path())!, 'utf8'))).toEqual({
    version: 1,
    ids: [hondaId],
  });
});

test('imports remain usable and exportable when storage writes fail', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'oss-shortlist-v1',
      JSON.stringify({ version: 1, ids: ['honda-cr-v-2026-lx-fwd'] }),
    );
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'oss-shortlist-v1') throw new Error('Full');
      return write.call(this, key, value);
    };
  });
  await page.goto('/');
  const dialog = await manager(page);
  await dialog
    .getByLabel('Choose shortlist backup', { exact: true })
    .setInputFiles(backup([mazdaId]));
  await dialog.getByRole('button', { name: 'Add vehicles', exact: true }).click();
  await expect(dialog.locator('li')).toHaveCount(2);
  await expect(dialog.getByRole('alert')).toContainText('cannot be saved');
  expect((await saved(page)).ids).toEqual([hondaId]);
  const event = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export shortlist', exact: true }).click();
  expect(JSON.parse(await readFile((await (await event).path())!, 'utf8')).ids).toEqual([
    hondaId,
    mazdaId,
  ]);
});

test('choosing a new backup supersedes an earlier file that is still being read', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const text = File.prototype.text;
    File.prototype.text = async function () {
      const raw = await text.call(this);
      if (this.name !== 'slow.json') return raw;
      return new Promise<string>((resolve) => {
        Object.assign(window, { releaseSlowShortlist: () => resolve(raw) });
      });
    };
  });
  await open(page, []);
  const dialog = await manager(page);
  await dialog
    .getByLabel('Choose shortlist backup', { exact: true })
    .setInputFiles(backup([hondaId], 'slow.json'));
  await expect.poll(() => page.evaluate(() => 'releaseSlowShortlist' in window)).toBe(true);
  await dialog
    .getByLabel('Choose shortlist backup', { exact: true })
    .setInputFiles(backup([mazdaId, hybridId], 'new.json'));
  await expect(dialog).toContainText('2 vehicles are available');
  await page.evaluate(() =>
    (window as unknown as { releaseSlowShortlist: () => void }).releaseSlowShortlist(),
  );
  await dialog.getByRole('button', { name: 'Add vehicles', exact: true }).click();
  expect((await saved(page)).ids).toEqual([mazdaId, hybridId]);
});
