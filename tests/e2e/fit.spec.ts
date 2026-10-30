import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { emptyBrief } from '../../apps/oss/src/buying';
import type { BuyingBrief } from '../../apps/oss/src/buying';

const gr86 = 'toyota-ca-2026-t86-znbb6m-a';
const premium = 'toyota-ca-2026-t86-znbf6t-a';
const coupeView = '/?q=2026%20Toyota%20GR86&kind=retail-trim';
const card = (page: Page, id = gr86) => page.locator(`article[aria-labelledby="title-${id}"]`);
const breakdown = (parent: Locator) => parent.locator('.fit-breakdown');
async function openFit(parent: Locator) {
  const details = breakdown(parent);
  await details.locator(':scope > summary').click();
  await expect(details.locator('.fit-breakdown-content')).toBeVisible();
  return details;
}
async function seedBrief(page: Page, changes: Partial<BuyingBrief>) {
  await page.addInitScript(
    (brief) => {
      if (sessionStorage.getItem('fit-test-seeded')) return;
      localStorage.setItem(
        'oss-buying-v1',
        JSON.stringify({ version: 1, revision: 'fit-test', brief, reviews: [] }),
      );
      sessionStorage.setItem('fit-test-seeded', 'yes');
    },
    { ...emptyBrief(), ...changes },
  );
}
const powerBrief: Partial<BuyingBrief> = {
  budget: 50000,
  minSeats: 4,
  bodies: ['Coupe'],
  bodyRequired: true,
  drive: 'RWD',
  driveRequired: true,
  horsepower: 300,
  weights: { price: 2, energy: 0, cargo: 0, room: 0, power: 5, drive: 3, body: 3 },
};
async function noOverflow(page: Page, details: Locator) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
  for (const detail of await details.all()) {
    expect(await detail.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
}

test('default contributions match the visible total and update with energy prices', async ({
  page,
}) => {
  await page.goto(coupeView);
  const chosen = card(page),
    fit = await openFit(chosen);
  const score = Number.parseInt(await chosen.locator('.fit-score > strong').innerText());
  await expect(fit.locator('.fit-breakdown-total')).toContainText(`${score} / 100`);
  await expect(
    fit.getByRole('list', { name: 'Active priorities', exact: true }).getByRole('listitem'),
  ).toHaveCount(2);
  await expect(
    fit.getByRole('list', { name: 'Excluded priorities', exact: true }).getByRole('listitem'),
  ).toHaveCount(2);
  await expect(fit.locator('.fit-points')).toHaveCount(2);
  for (const point of await fit.locator('.fit-points').all())
    await expect(point).toContainText('of 50 points');
  const before = await fit.locator('[data-priority="efficiency"] .fit-points').innerText();
  await page.getByRole('button', { name: 'Filters & priorities', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Fuel price · CAD / litre', exact: true }).fill('3.2');
  await expect(fit.locator('[data-priority="efficiency"] .fit-points')).not.toHaveText(before);
  await expect(fit.locator('.fit-breakdown-total')).toContainText(
    `${Number.parseInt(await chosen.locator('.fit-score > strong').innerText())} / 100`,
  );
  await expect(fit).toHaveAttribute('open', '');
});

test('a power-focused brief explains met requirements and the below-target horsepower trade-off', async ({
  page,
}) => {
  await seedBrief(page, powerBrief);
  await page.goto(coupeView);
  const fit = await openFit(card(page));
  await expect(
    fit.getByRole('list', { name: 'Requirements', exact: true }).getByRole('listitem'),
  ).toHaveCount(4);
  await expect(fit.locator('.fit-status').filter({ hasText: /^Met$/ })).toHaveCount(4);
  await expect(fit.locator('.fit-criteria > li')).toHaveCount(4);
  await expect(fit.locator('.fit-excluded > li')).toHaveCount(3);
  const power = fit.locator('[data-priority="power"]');
  await expect(power).toContainText('228 hp');
  await expect(power).toContainText('300 hp target');
  await expect(power).toContainText('29.2 of 38.5 points');
  await expect(power.getByRole('link')).toHaveAttribute('href', /toyota\.ca/);
  await expect(fit).toContainText('use your test drives to assess driving enjoyment');
});

test('unknown requirements expose every missing priority and never show partial earned points', async ({
  page,
}) => {
  await seedBrief(page, {
    budget: 50000,
    minSeats: 4,
    powerRequired: true,
    includeUnverified: true,
    weights: { price: 2, energy: 2, cargo: 0, room: 0, power: 5, drive: 3, body: 3 },
  });
  await page.goto('/?q=BRZ&kind=government-rating');
  const fit = await openFit(page.getByRole('article').first());
  await expect(fit.locator('.fit-breakdown-total')).toContainText('Unscored');
  await expect(fit.locator('.fit-status').filter({ hasText: 'Needs checking' })).toHaveCount(3);
  await expect(fit.locator('.fit-criteria > li')).toHaveCount(3);
  await expect(fit.locator('[data-priority="price"]')).toContainText('Not verified');
  await expect(fit.locator('[data-priority="power"]')).toContainText('Not verified');
  for (const priority of ['price', 'power']) {
    const text = await fit.locator(`[data-priority="${priority}"]`).innerText();
    expect(text.match(/Not supplied by the government fuel-rating dataset/g)).toHaveLength(1);
  }
  await expect(fit.locator('[data-priority="energy"] .fit-criterion-value')).toContainText(
    'CAD / 100 km',
  );
  await expect(fit.locator('[data-priority="energy"]')).toContainText('Points are unavailable');
  await expect(fit.locator('.fit-points, .fit-points-track')).toHaveCount(0);
});

test('comparison breakdowns track their totals, live prices and horizontal keyboard focus', async ({
  page,
}) => {
  await page.goto('/?compare=honda-cr-v-2026-lx-fwd,honda-cr-v-2026-sport-hybrid-awd');
  const dialog = page.getByRole('dialog', { name: 'Compare specifications', exact: true });
  const cells = dialog.locator('.score-table-row > td');
  await expect(cells).toHaveCount(2);
  for (const cell of await cells.all()) await openFit(cell);
  const first = cells.first(),
    fit = breakdown(first);
  const before = await first.locator(':scope > strong').innerText();
  await dialog
    .getByRole('spinbutton', { name: 'Fuel price · CAD / litre', exact: true })
    .fill('3.2');
  await expect(first.locator(':scope > strong')).not.toHaveText(before);
  for (const cell of await cells.all()) {
    await expect(breakdown(cell).locator('.fit-breakdown-total')).toContainText(
      `${await cell.locator(':scope > strong').innerText()} / 100`,
    );
  }
  await page.setViewportSize({ width: 320, height: 760 });
  const link = breakdown(cells.last()).getByRole('link').first();
  await link.focus();
  // Arrive by keyboard: only keyboard focus scrolls a partly hidden column into view.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  const region = dialog.getByRole('region', { name: 'Car specifications comparison', exact: true });
  await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await noOverflow(page, dialog.locator('.fit-breakdown'));
  await expect(fit.locator('.fit-points')).toHaveCount(2);
});

test('a compared SUV explains failed coupe and drivetrain requirements while the coupe remains scored', async ({
  page,
}) => {
  await seedBrief(page, { ...powerBrief, budget: 70000 });
  await page.goto(`/?compare=${gr86},subaru-forester-2026-touring-awd`);
  const dialog = page.getByRole('dialog', { name: 'Compare specifications', exact: true });
  const cells = dialog.locator('.score-table-row > td');
  const passing = await openFit(cells.first()),
    failed = await openFit(cells.last());
  await expect(passing.locator('.fit-breakdown-total')).not.toContainText('Unscored');
  await expect(failed.locator('.fit-breakdown-total')).toContainText('Unscored');
  await expect(failed.locator('.fit-status').filter({ hasText: 'Does not meet' })).toHaveCount(2);
  await expect(failed.getByRole('list', { name: 'Requirements', exact: true })).toContainText(
    'SUV',
  );
  await expect(failed.getByRole('list', { name: 'Requirements', exact: true })).toContainText(
    'AWD',
  );
  await expect(failed.locator('.fit-points')).toHaveCount(0);
  await expect(passing.locator('.fit-points')).toHaveCount(4);
});

test('dormant preferences have no points and pausing restores the ordinary priority explanation', async ({
  page,
}) => {
  await seedBrief(page, {
    weights: { price: 0, energy: 0, cargo: 0, room: 0, power: 0, drive: 3, body: 3 },
  });
  await page.goto(coupeView);
  const fit = await openFit(card(page));
  await expect(fit.locator('.fit-breakdown-total')).toContainText('Unscored');
  await expect(fit.locator('.fit-excluded > li')).toHaveCount(7);
  await expect(fit.locator('.fit-criteria > li')).toHaveCount(0);
  await expect(fit).toContainText('Choose a preferred drivetrain');
  await page.getByRole('button', { name: 'Pause buying brief', exact: true }).click();
  await expect(fit.locator('.fit-breakdown-total')).toContainText('Filters & priorities');
  await expect(fit.locator('.fit-points')).toHaveCount(2);
  await page.getByRole('button', { name: 'Use buying brief', exact: true }).click();
  await expect(fit.locator('.fit-breakdown-total')).toContainText('Unscored');
  await expect(fit.locator('.fit-points')).toHaveCount(0);
});

for (const theme of ['light', 'dark']) {
  test(`expanded fit explanations wrap on cards and comparisons and are accessible in ${theme}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await seedBrief(page, {
      ...powerBrief,
      bodies: [
        'Sedan',
        'Hatchback',
        'Coupe',
        'Convertible',
        'Wagon',
        'SUV',
        'Pickup',
        'Minivan',
        'Van',
      ],
      weights: { price: 2, energy: 0, power: 5, room: 3, cargo: 2, body: 3, drive: 3 },
    });
    await page.goto(coupeView);
    await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption(theme);
    const expanded = await openFit(card(page));
    await expect(expanded.locator('.fit-points')).toHaveCount(6);
    await expect(expanded.locator('[data-priority="room"]')).toContainText('759.5 mm');
    await expect(expanded.locator('[data-priority="room"]').getByRole('link')).toHaveAttribute(
      'href',
      /toyotacanada\.scene7\.com/,
    );
    for (const width of [320, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow(page, breakdown(card(page)));
    }
    await page.goto(`${coupeView}&compare=${gr86},${premium}`);
    const dialog = page.getByRole('dialog', { name: 'Compare specifications', exact: true });
    const cells = dialog.locator('.score-table-row > td');
    await expect(cells).toHaveCount(2);
    for (const cell of await cells.all()) await openFit(cell);
    for (const width of [320, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow(page, dialog.locator('.fit-breakdown'));
    }
    expect(
      (await new AxeBuilder({ page }).include('.comparison-dialog').analyze()).violations,
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
}
