import { test, expect } from '@playwright/test';

test('reload and a garage round trip preserve filters, ordering and result page', async ({
  page,
}) => {
  await page.goto('/?kind=retail-trim&priced=1&sort=price&page=2');
  const pagination = page.getByRole('navigation', { name: 'Result pages', exact: true });
  await expect(pagination).toContainText('Page 2');
  const first = await page
    .getByRole('article')
    .first()
    .getByRole('button', { name: /^Save / })
    .getAttribute('aria-label');
  await page.reload();
  await expect(pagination).toContainText('Page 2');
  await expect(
    page
      .getByRole('article')
      .first()
      .getByRole('button', { name: /^Save / }),
  ).toHaveAttribute('aria-label', first!);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'My garage', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Your garage', exact: true })).toBeVisible();
  await page.goBack();
  await expect(pagination).toContainText('Page 2');
  await expect(
    page
      .getByRole('article')
      .first()
      .getByRole('button', { name: /^Save / }),
  ).toHaveAttribute('aria-label', first!);
  await page.getByLabel('Make', { exact: true }).selectOption('Honda');
  await expect(pagination).toContainText('Page 1');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBeNull();
});

test('copied searches restore the public view without exposing the device shortlist or current comparison', async ({
  page,
  browser,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Clipboard unavailable')) },
    }),
  );
  await page.goto('/?q=hybrid&body=SUV&kind=retail-trim&sort=fuel');
  const first = page.getByRole('article').first();
  await first.getByRole('button', { name: /^Save / }).click();
  await first.getByRole('checkbox', { name: /^Compare / }).check();
  await page.getByRole('button', { name: /^Shortlist / }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Copy search link', exact: true }).click();
  const link = await page.getByLabel('Search link', { exact: true }).inputValue();
  const params = new URL(link).searchParams;
  expect(params.get('q')).toBe('hybrid');
  expect(params.get('body')).toBe('SUV');
  expect(params.get('sort')).toBe('fuel');
  expect(params.has('saved')).toBe(false);
  expect(params.has('compare')).toBe(false);
  const guest = await browser.newContext();
  try {
    const recipient = await guest.newPage();
    await recipient.goto(link);
    await expect(recipient.getByRole('article').first()).toBeVisible();
    await expect(
      recipient.getByRole('searchbox', { name: 'Search cars', exact: true }),
    ).toHaveValue('hybrid');
    await expect(recipient.getByRole('dialog')).not.toBeVisible();
    await expect(
      recipient.getByRole('group', { name: 'Active filters', exact: true }),
    ).toContainText('Body style: SUV');
    expect(await recipient.evaluate(() => localStorage.getItem('oss-shortlist-v1'))).toBeNull();
  } finally {
    await guest.close();
  }
});

test('reordered and punctuation-normalized search survives reload and custom budgets remain visible', async ({
  page,
}) => {
  await page.goto(
    '/?make=Honda&model=CR-V&year=2026&budget=42000&q=2026%20honda%20crv&kind=retail-trim',
  );
  await expect(page.getByRole('article').first()).toContainText('CR-V');
  await page.getByRole('button', { name: 'Filters & priorities', exact: true }).click();
  await expect(page.getByLabel('Max base MSRP', { exact: true })).toHaveValue('42000');
  await page
    .getByRole('searchbox', { name: 'Search cars', exact: true })
    .fill('AWD honda 2026 crv');
  await expect(page.getByRole('article').first()).toContainText('AWD');
  await page.reload();
  await expect(page.getByLabel('Make', { exact: true })).toHaveValue('Honda');
  await expect(page.getByLabel('Model', { exact: true })).toHaveValue('CR-V');
  await expect(page.getByRole('searchbox', { name: 'Search cars', exact: true })).toHaveValue(
    'AWD honda 2026 crv',
  );
  await expect(page.getByRole('article').first()).toContainText('AWD');
});

test('zero electric driving uses the known fuel rating even when the unused electricity input is empty', async ({
  page,
}) => {
  await page.goto('/?compare=honda-cr-v-2026-lx-fwd,nrcan-29292');
  const dialog = page.getByRole('dialog');
  const electricity = dialog.getByRole('spinbutton', {
    name: 'Electricity · CAD / kWh',
    exact: true,
  });
  const fraction = dialog.getByRole('spinbutton', {
    name: 'Plug-in electric-mode driving · %',
    exact: true,
  });
  const row = dialog.getByRole('row', { name: /^Estimated annual energy/ });
  await electricity.fill('');
  await expect(row).toContainText('Not available');
  await fraction.fill('0');
  await expect(electricity).toBeDisabled();
  await expect(electricity).toHaveAttribute('aria-invalid', 'false');
  await expect(row).not.toContainText('Not available');
  await fraction.fill('100');
  await expect(electricity).toBeEnabled();
  await expect(row).toContainText('Not available');
});
