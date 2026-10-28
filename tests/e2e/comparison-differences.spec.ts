import { test, expect } from '@playwright/test';

test('key differences quantify trade-offs and update when the reference or driving inputs change', async ({
  page,
}) => {
  await page.goto('/?compare=honda-cr-v-2026-lx-fwd,honda-cr-v-2026-sport-hybrid-awd');
  const dialog = page.getByRole('dialog');
  const summary = dialog.getByRole('region', { name: 'Key differences', exact: true });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('$336/year less');
  await expect(summary).toContainText('Same published figure (5 seats)');
  await expect(dialog.getByRole('row', { name: /^Base MSRP / })).toBeVisible();
  await dialog.getByLabel('Annual kilometres', { exact: true }).fill('30000');
  await expect(summary).toContainText('$672/year less');
  await summary
    .getByLabel('Reference vehicle', { exact: true })
    .selectOption('honda-cr-v-2026-sport-hybrid-awd');
  await expect(summary).toContainText('$672/year more');
  await expect(page).toHaveURL(/reference=honda-cr-v-2026-sport-hybrid-awd/);
  await page.reload();
  await expect(summary.getByLabel('Reference vehicle', { exact: true })).toHaveValue(
    'honda-cr-v-2026-sport-hybrid-awd',
  );
  await expect(summary).toContainText('$672/year more');
  await dialog.getByLabel('Annual kilometres', { exact: true }).fill('');
  await expect(summary).toContainText('Not available for both vehicles at these inputs');
  await expect(summary).not.toContainText('$0/year');
});

test('rating comparisons identify exact variants and keep missing prices unknown', async ({
  page,
}) => {
  await page.goto('/?compare=nrcan-29063,nrcan-29292');
  const dialog = page.getByRole('dialog');
  const summary = dialog.getByRole('region', { name: 'Key differences', exact: true });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Not verified for both vehicles');
  await expect(dialog.getByRole('columnheader').nth(1)).toContainText('NRCan 29063');
  await expect(dialog.getByRole('columnheader').nth(2)).toContainText('NRCan 29292');
  await expect(dialog.getByRole('row', { name: /^Base MSRP / })).toContainText('Not verified');
});
