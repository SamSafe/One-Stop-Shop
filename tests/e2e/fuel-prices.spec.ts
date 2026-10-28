import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { revealCatalogFilters } from './catalog-helpers';

test('regular, premium, diesel and E85 comparisons use their selected prices and restore them from the URL', async ({
  page,
}) => {
  await page.goto(
    '/?compare=subaru-forester-2026-convenience-awd,subaru-ca-1625,nrcan-29028,nrcan-28710',
  );
  const dialog = page.getByRole('dialog');
  const options = dialog.locator('.fuel-price-options');
  await options.locator('summary').click();
  await dialog.getByLabel('Premium gasoline · CAD / litre', { exact: true }).fill('2');
  await dialog.getByLabel('Diesel · CAD / litre', { exact: true }).fill('1.8');
  await dialog.getByLabel('E85 · CAD / litre', { exact: true }).fill('1.3');
  const costs = dialog.getByRole('row', { name: /^Estimated energy \/100 km/ }).getByRole('cell');
  for (const [index, price, basis] of [
    [0, '$13.28', 'Regular gasoline · $1.60/L · shared price'],
    [1, '$21.00', 'Premium gasoline · $2.00/L · specific price'],
    [2, '$16.74', 'Diesel · $1.80/L · specific price'],
    [3, '$13.65', 'E85 · $1.30/L · specific price'],
  ] as const) {
    await expect(costs.nth(index).locator('strong')).toHaveText(price);
    await expect(costs.nth(index)).toContainText(basis);
  }
  await expect(page).toHaveURL(/premiumPrice=2/);
  await page.reload();
  await expect(options).toHaveAttribute('open', '');
  await expect(dialog.getByLabel('Diesel · CAD / litre', { exact: true })).toHaveValue('1.8');
  await expect(dialog.getByLabel('E85 · CAD / litre', { exact: true })).toHaveValue('1.3');
  await expect(costs.nth(1).locator('strong')).toHaveText('$21.00');
  await dialog.getByLabel('Premium gasoline · CAD / litre', { exact: true }).fill('');
  await expect(costs.nth(1)).toContainText('Premium gasoline · $1.60/L · shared price');
  await expect(costs.nth(1).locator('strong')).toHaveText('$16.80');
  expect(new URL(page.url()).searchParams.has('premiumPrice')).toBe(false);
  await expect(options).toHaveAttribute('open', '');
});

test('unverified fuel grades retain the shared price and invalid overrides affect only matching fuel types', async ({
  page,
}) => {
  await page.goto('/?compare=toyota-ca-2026-cah-daackc-a,subaru-ca-1625&premiumPrice=2');
  const dialog = page.getByRole('dialog');
  const costs = dialog.getByRole('row', { name: /^Estimated energy \/100 km/ }).getByRole('cell');
  await expect(costs.nth(0)).toContainText('Fuel grade not verified · $1.60/L · shared price');
  await expect(costs.nth(0).locator('strong')).toHaveText('$8.00');
  await expect(costs.nth(1).locator('strong')).toHaveText('$21.00');
  await dialog.getByLabel('Gas price / fuel price · CAD / litre', { exact: true }).fill('');
  await expect(costs.nth(0)).toContainText('Enter a fuel price from $0.01 to $5 per litre.');
  await expect(costs.nth(1).locator('strong')).toHaveText('$21.00');
  const premium = dialog.getByLabel('Premium gasoline · CAD / litre', { exact: true });
  await premium.fill('0.001');
  await expect(premium).toHaveAttribute('aria-invalid', 'true');
  await expect(costs.nth(1)).toContainText(
    'Enter a premium gasoline price from $0.01 to $5 per litre.',
  );
  await expect(dialog.getByLabel('Diesel · CAD / litre', { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('E85 · CAD / litre', { exact: true })).toBeDisabled();
});

test('fuel-specific ranking costs and scores survive copied search links without device state', async ({
  page,
  browser,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Clipboard unavailable')) },
    }),
  );
  await page.goto('/?q=2027%20Subaru%20BRZ&kind=retail-trim');
  await revealCatalogFilters(page);
  const card = page.getByRole('article').filter({ has: page.locator('#title-subaru-ca-1625') });
  const score = await card.locator('.fit-score > strong').innerText();
  await page.locator('.filters .fuel-price-options > summary').click();
  await page
    .getByLabel('Premium gasoline price for ranking · CAD / litre', { exact: true })
    .fill('2.4');
  await expect(card.locator('.card-energy-cost')).toContainText('$25.20');
  await expect(card.locator('.card-energy-cost')).toContainText(
    'Premium gasoline · $2.40/L · specific price',
  );
  await expect(card.locator('.fit-score > strong')).not.toHaveText(score);
  await page.getByRole('button', { name: 'Copy search link', exact: true }).click();
  const link = await page.getByLabel('Search link', { exact: true }).inputValue();
  expect(new URL(link).searchParams.get('premiumPrice')).toBe('2.4');
  expect(new URL(link).searchParams.has('compare')).toBe(false);
  const guest = await browser.newContext();
  try {
    const recipient = await guest.newPage();
    await recipient.goto(link);
    const imported = recipient
      .getByRole('article')
      .filter({ has: recipient.locator('#title-subaru-ca-1625') });
    await expect(imported.locator('.card-energy-cost')).toContainText('$25.20');
    await expect(imported.locator('.fit-score > strong')).toHaveText(
      await card.locator('.fit-score > strong').innerText(),
    );
    expect(await recipient.evaluate(() => localStorage.getItem('oss-shortlist-v1'))).toBeNull();
  } finally {
    await guest.close();
  }
});

test('fuel-specific prices reorder energy-cost results without changing unrelated inputs', async ({
  page,
}) => {
  await page.goto('/?make=Subaru&kind=retail-trim&sort=fuel&scored=1');
  await revealCatalogFilters(page);
  const first = page.getByRole('article').first();
  await expect(first.getByRole('heading', { name: 'BRZ', exact: true })).toHaveCount(0);
  await page.locator('.filters .fuel-price-options > summary').click();
  const premium = page.getByLabel('Premium gasoline price for ranking · CAD / litre', {
    exact: true,
  });
  await premium.fill('0.01');
  await expect(first.getByRole('heading', { name: 'BRZ', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/premiumPrice=0.01/);
  await premium.fill('');
  await expect(first.getByRole('heading', { name: 'BRZ', exact: true })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('premiumPrice')).toBe(false);
});

test('premium plug-in fuel prices include electric-mode fuel while EV estimates ignore unused fuel inputs', async ({
  page,
}) => {
  await page.goto('/?compare=nrcan-29063,nrcan-29292');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Gas price / fuel price · CAD / litre', { exact: true }).fill('');
  await dialog.locator('.fuel-price-options > summary').click();
  await dialog.getByLabel('Premium gasoline · CAD / litre', { exact: true }).fill('2');
  await dialog.getByLabel('Plug-in electric-mode driving · %', { exact: true }).fill('100');
  const costs = dialog.getByRole('row', { name: /^Estimated energy \/100 km/ }).getByRole('cell');
  await expect(costs.nth(0).locator('strong')).toHaveText('$2.16');
  await expect(costs.nth(0).locator('.fuel-price-basis')).toHaveCount(0);
  await expect(costs.nth(1)).toContainText('Fuel: 6.1 L · $12.20');
  await expect(costs.nth(1).locator('strong')).toHaveText('$19.66');
  await expect(
    dialog.getByLabel('Gas price / fuel price · CAD / litre', { exact: true }),
  ).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Close comparison', exact: true }).click();
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark');
  await page.getByRole('button', { name: 'Compare 2 cars', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
