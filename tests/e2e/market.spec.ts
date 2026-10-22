import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('Nissan EV versions and Infiniti equipment packages preserve prices, energy units and unknown-price filtering', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Nissan');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('LEAF');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Electric');
  await expect(page.getByRole('article')).toHaveCount(4);
  const leaf = page.getByRole('article').filter({ hasText: 'S FWD' });
  await expect(leaf).toHaveCount(1);
  await expect(leaf).toContainText('$34,998');
  await leaf.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    leaf.getByRole('link', { name: /Base MSRP: .*Source: Nissan Canada/ }),
  ).toHaveAttribute('href', 'https://www.nissan.ca/shopping-tools/build-price');
  await expect(leaf).toContainText('341');
  await expect(leaf).toContainText('Gasoline-equivalent energy');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('all');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Frontier');
  await page.getByLabel('Drivetrain', { exact: true }).selectOption('4WD');
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(page.getByRole('article').filter({ hasText: 'Luxury LWB' })).toContainText(
    '$60,598',
  );
  await page.getByLabel('Drivetrain', { exact: true }).selectOption('all');
  await page.getByLabel('Make', { exact: true }).selectOption('Infiniti');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('QX60 AUTOGRAPH');
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('article').filter({ hasText: 'Tech Package' })).toHaveCount(1);
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('50000');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('all');
  for (const article of await page.getByRole('article').all())
    await article.getByRole('checkbox', { name: /^Compare / }).check();
  await page.getByRole('button', { name: /^Compare 2 cars/ }).click();
  await expect(page.getByRole('row', { name: /^Cargo · seats up/ })).toContainText('411');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('GM factory prices exclude fees, unavailable prices remain visible, and passenger vans stay in scope', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Buick');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Envista');
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(page.getByRole('article').filter({ hasText: 'Preferred' })).toContainText('$29,749');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Envista Avenir');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('Not verified');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('50000');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('all');
  await page.getByLabel('Make', { exact: true }).selectOption('GMC');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Savana');
  await expect(page.getByRole('article')).toHaveCount(12);
  for (const article of await page.getByRole('article').all())
    await expect(article).toContainText('Passenger');
  await page.goto(
    '/?compare=gm-ca-chevrolet-2026-475054-l84-mht-gu5-none-none,honda-cr-v-2026-lx-fwd',
  );
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('row', { name: /^Base MSRP/ })).toContainText('$52,744');
  await expect(
    page.getByRole('link', { name: /Base MSRP: .*Source: Chevrolet Canada/ }),
  ).toHaveAttribute(
    'href',
    /^https:\/\/www\.chevrolet\.ca\/byo-vc\/client\/en\/CA\/chevrolet\/silverado-1500\/2026\/silverado-1500\/config\?styleId=475054&ss=/,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Kia AWD packages, overlapping model years and passenger vans retain exact factory prices', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Kia');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('EV4');
  await expect(page.getByRole('article')).toHaveCount(10);
  await page.getByLabel('Drivetrain', { exact: true }).selectOption('AWD');
  await expect(page.getByRole('article')).toHaveCount(5);
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('EV4 Wind Premium');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('$48,595');
  await page.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(page.getByRole('link', { name: /Base MSRP: .*Source: Kia Canada/ })).toHaveAttribute(
    'href',
    'https://www.kia.ca/en/shopping-tools/build-and-price',
  );
  await expect(page.getByRole('article')).toContainText('262');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('EV9');
  const gtLine = page.getByRole('article').filter({ hasText: 'with GT-line Pkg' });
  await expect(gtLine).toHaveCount(1);
  await expect(gtLine).toContainText('$79,495');
  await page.getByLabel('Drivetrain', { exact: true }).selectOption('all');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('PV5');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Carnival');
  await expect(page.getByRole('article')).toHaveCount(11);
  await page.getByLabel('Drivetrain', { exact: true }).selectOption('FWD');
  await expect(page.getByRole('article')).toHaveCount(11);
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Hybrid');
  await expect(page.getByRole('article')).toHaveCount(5);
  await page.getByRole('article').first().getByRole('button', { name: 'Specs & sources' }).click();
  await expect(page.getByRole('article').first()).toContainText('242');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Hyundai factory packages, plug-in powertrains and optional seating retain their own identities and MSRP', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Hyundai');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('TUCSON');
  await expect(page.getByRole('article')).toHaveCount(6);
  const trend = page.getByRole('article').filter({ hasText: 'with Trend Package' });
  await expect(trend).toContainText('$39,199');
  await trend.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    trend.getByRole('link', { name: /Base MSRP: .*Source: Hyundai Auto Canada/ }),
  ).toHaveAttribute(
    'href',
    'https://www.hyundaicanada.com/api/backendservice/buildandprice/trimallpurchaseOptions?trimId=f8066429-5e3f-4326-85f4-c731cd986e28&prov=AB&lang=en',
  );
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Plug-in hybrid');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('$53,299');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('all');
  await page
    .getByRole('searchbox', { name: 'Search cars' })
    .fill('KONA N Line AWD with Ultimate Package');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('$39,399');
  await page.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(page.getByRole('article')).toContainText('source conflict');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('PALISADE Luxury');
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('article').filter({ hasText: '8-Passenger' })).toContainText(
    '$61,849',
  );
  await expect(page.getByRole('article').filter({ hasText: '7-Passenger' })).toContainText(
    '$62,349',
  );
  for (const article of await page.getByRole('article').all())
    await article.getByRole('checkbox', { name: /^Compare / }).check();
  await page.getByRole('button', { name: /^Compare 2 cars/ }).click();
  const seats = page.getByRole('row', { name: /^Seats / });
  await expect(seats).toContainText('8');
  await expect(seats).toContainText('7');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

const snapshot = JSON.parse(readFileSync('packages/car-catalog/data/nrcan.json', 'utf8')) as {
  records: { Make: string; Year: number; VehicleTypeId: string }[];
};

test('full catalog is paged, retains a shortlist across pages, and supports make/year/powertrain filters', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('article')).toHaveCount(30);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.locator('.results-caption')).toContainText('records for your consideration');
  const save = page.getByRole('button', { name: /^Save / }).first();
  const name = await save.getAttribute('aria-label');
  await save.click();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Result pages' })).toContainText('Page 2');
  await expect(page.getByRole('article')).toHaveCount(30);
  await page.getByLabel('Only my shortlist').check();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: name!.replace(/^Save /, 'Unsave '), exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByLabel('Make', { exact: true }).selectOption('Tesla');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Electric');
  const expected = snapshot.records.filter(
    (car) => car.Make === 'Tesla' && car.Year === 2027 && car.VehicleTypeId === 'BEV',
  );
  expect(expected.length).toBeGreaterThan(0);
  await expect(page.getByRole('article')).toHaveCount(Math.min(30, expected.length));
  await expect(page.getByRole('article').first()).toContainText('retail trim not checked');
  await expect(page.getByRole('article').first()).toContainText('kWh/100 km');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('price limits exclude unverified prices without hiding them by default', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('50000');
  await expect(page.locator('.price-row').filter({ hasText: 'Not verified' })).toHaveCount(0);
  const pricedCount = Number(
    (await page.locator('.results-caption').innerText()).match(/^\d+/)?.[0],
  );
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('all');
  await expect
    .poll(async () =>
      Number((await page.locator('.results-caption').innerText()).match(/^\d+/)?.[0]),
    )
    .toBeGreaterThanOrEqual(snapshot.records.length);
  const fullCount = Number((await page.locator('.results-caption').innerText()).match(/^\d+/)?.[0]);
  expect(fullCount).toBeGreaterThan(pricedCount);
});

test('EV and plug-in comparisons show electricity and electric-mode fuel costs with exact source links', async ({
  page,
}) => {
  await page.goto('/?compare=nrcan-29063,nrcan-29292');
  await expect(page.getByRole('dialog')).toBeVisible();
  const row = page.getByRole('row', { name: /Estimated annual energy/ });
  await expect(row).toContainText('$324');
  await expect(row).toContainText('$3,679');
  await page.getByLabel('Plug-in electric-mode driving · %', { exact: true }).fill('100');
  await expect(row).toContainText('$2,582');
  await page.getByLabel('Electricity · CAD / kWh', { exact: true }).fill('0.30');
  await expect(row).toContainText('$648');
  await expect(
    page.getByRole('link', { name: /Fuel used in plug-in electric mode: 6.1/ }),
  ).toHaveAttribute('href', 'https://fcr-ccc.nrcan-rncan.gc.ca/en/VehicleReport/29292');
  await expect(page.getByRole('row', { name: 'Record and availability' })).toContainText(
    'current availability',
  );
});

test('manufacturer-listed Toyota packages retain their own MSRP and published specifications', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Make', { exact: true }).selectOption('Toyota');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Corolla LE CVT');
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('article').filter({ hasText: 'Standard Package' })).toContainText(
    '$26,200',
  );
  await expect(page.getByRole('article').filter({ hasText: 'LE Upgrade' })).toContainText(
    '$28,319',
  );
  await expect(page.getByRole('article').first()).toContainText('6.7');
  await page.getByRole('button', { name: 'Specs & sources' }).first().click();
  await expect(
    page.getByRole('link', { name: /Base MSRP: .*Source: Toyota Canada/ }),
  ).toHaveAttribute('href', /^https:\/\/www\.toyota\.ca\/graphql\/execute/);
});

test('current Honda model years and distinct Acura transmissions are available as retail configurations', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Honda');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('CR-V');
  await expect(page.getByRole('article')).toHaveCount(7);
  await page.getByLabel('Drivetrain', { exact: true }).selectOption('FWD');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('$37,575');
  await expect(page.getByRole('article')).toContainText('7.8');
  await page.getByLabel('Drivetrain', { exact: true }).selectOption('all');
  await page.getByLabel('Make', { exact: true }).selectOption('Acura');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Integra Elite');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('button', { name: 'Specs & sources' }).last().click();
  await expect(page.getByRole('article').last()).toContainText('Manual');
  await expect(page.getByRole('article').last()).toContainText('$46,675');
});

test('Ford pickups and passenger vans use exact factory MSRP while Lincoln hybrids remain distinct', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Ford');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('F-150 XL Cab:');
  await expect(page.getByRole('article')).toHaveCount(5);
  const regularEight = page
    .getByRole('article')
    .filter({ hasText: 'Cab: Regular Cab' })
    .filter({ hasText: "Box: 8' Box" });
  await expect(regularEight).toHaveCount(1);
  await expect(regularEight).toContainText('$52,690');
  await regularEight.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    regularEight.getByRole('link', { name: /Base MSRP: .*Source: Ford Canada/ }),
  ).toHaveAttribute(
    'href',
    /^https:\/\/www\.ford\.ca\/build-price\/f150\/2026\/choose-model\/build\?/,
  );
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Super Duty F-450');
  await expect(page.getByRole('article')).toHaveCount(7);
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Transit');
  await expect(page.getByRole('article')).toHaveCount(8);
  for (const article of await page.getByRole('article').all())
    await expect(article).toContainText('Passenger Van');
  await page.getByLabel('Make', { exact: true }).selectOption('Lincoln');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Hybrid');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Nautilus');
  await expect(page.getByRole('article')).toHaveCount(2);
});

test('Mazda factory packages retain complete MSRP and source availability conflicts remain visible', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page.getByLabel('Make', { exact: true }).selectOption('Mazda');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('CX-5');
  await expect(page.getByRole('article')).toHaveCount(5);
  const premium = page.getByRole('article').filter({ hasText: 'PREMIUM PACKAGE' });
  await expect(premium).toHaveCount(1);
  await expect(premium).toContainText('$46,700');
  await premium.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    premium.getByRole('link', { name: /Base MSRP: .*Source: Mazda Canada/ }),
  ).toHaveAttribute(
    'href',
    /^https:\/\/n8xgyscaa3\.execute-api\.ca-central-1\.amazonaws\.com\/prod\/api\/Packages\/NXTL86\/AA00/,
  );
  await page.getByLabel('Model year', { exact: true }).selectOption('2025');
  await page.getByLabel('Availability evidence', { exact: true }).selectOption('announced');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('CX-50');
  await expect(page.getByRole('article')).toHaveCount(8);
  await expect(page.getByText(/coming-soon source flag · availability needs review/)).toHaveCount(
    8,
  );
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Gasoline');
  await expect(page.getByRole('article')).toHaveCount(5);
  const first = page.getByRole('article').first();
  await first.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(first).toContainText('not automatically swapped');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
