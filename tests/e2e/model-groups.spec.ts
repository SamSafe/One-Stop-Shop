import { test, expect } from '@playwright/test';

test('results show one card per model, switch trims inside it, and flatten on request', async ({
  page,
}) => {
  await page.goto('/');
  const status = page.locator('.results-caption [role=status]');
  await expect(status).toContainText(/^[\d,]+ models · [\d,]+ records/);
  const titles = await page.locator('article h3').allInnerTexts();
  const makes = await page.locator('article .car-make').allInnerTexts();
  const models = titles.map((title, index) => `${makes[index]!.replace(/^\S+ /, '')} ${title}`);
  expect(new Set(models).size).toBe(models.length);

  const card = page.getByRole('article').first();
  await card.getByRole('button', { name: /^Show all \d+ trims$/ }).click();
  const trims = card.getByRole('list', { name: / trims$/ }).getByRole('button');
  await expect(trims.first()).toHaveAttribute('aria-pressed', 'true');
  const price = (await trims.nth(1).locator('.trim-figures strong').innerText()).trim();
  await trims.nth(1).click();
  await expect(trims.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(card.locator('.price-row strong').first()).toHaveText(price);
  await card.getByRole('checkbox', { name: /^Compare / }).check();
  await expect(trims.nth(1)).toContainText('Comparing');

  await page.getByRole('button', { name: 'Show every trim separately', exact: true }).click();
  await expect(page).toHaveURL(/trims=all/);
  await expect(status).not.toContainText('models');
  await expect(page.getByRole('list', { name: / trims$/ })).toHaveCount(0);
});

test('choosing a model lists its trims as separate cards', async ({ page }) => {
  await page.goto('/?make=Toyota&model=Corolla+Hybrid');
  await expect(page.locator('.results-caption [role=status]')).not.toContainText('models');
  await expect(page.getByRole('button', { name: /^Show all \d+ trims$/ })).toHaveCount(0);
  expect(await page.getByRole('article').count()).toBeGreaterThan(1);
});
