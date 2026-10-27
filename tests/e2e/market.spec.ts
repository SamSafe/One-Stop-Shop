import { revealCatalogFilters } from './catalog-helpers';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('Lucid packages, five/seven-seat Gravity and older new stock retain exact MSRP and sources', async ({
  page,
}) => {
  await page.goto('/?compare=lucid-ca-69a2e39941682f00,lucid-ca-ed7ec8bfd63a5c0e');
  await revealCatalogFilters(page);
  const dialog = page.getByRole('dialog');
  const prices = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Base MSRP', exact: true }) });
  await expect(prices).toContainText('$110,700');
  await expect(prices).toContainText('$114,700');
  const seats = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Seats', exact: true }) });
  await expect(seats).toContainText('5');
  await expect(seats).toContainText('7');
  await page.reload();
  await revealCatalogFilters(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close comparison' }).click();
  await revealCatalogFilters(page, true);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Lucid');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Air Pure');
  await expect(page.getByRole('article')).toHaveCount(3);
  const pure = page.locator('article[aria-labelledby="title-lucid-ca-a81090c502ea4798"]');
  await expect(pure.locator('.price-row')).toContainText('$97,600');
  await expect(
    page.locator('article[aria-labelledby="title-lucid-ca-481b58b35ce6a940"]'),
  ).toContainText('$103,800');
  await expect(
    page.locator('article[aria-labelledby="title-lucid-ca-20ba8edcf380cf57"]'),
  ).toContainText('$106,300');
  await pure.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    pure.getByRole('link', { name: /Base MSRP: .*Source: Lucid Canada/ }),
  ).toHaveAttribute('href', 'https://lucidmotors.com/en-ca/configure');
  await expect(pure).toContainText('manufacturer projections');
  await page.getByLabel('Model year', { exact: true }).selectOption('2025');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Air Grand Touring');
  const older = page.locator('article[aria-labelledby="title-lucid-ca-c6b2967d17db62cc"]');
  await expect(older).toContainText('Observed new stock');
  await expect(older.locator('.price-row')).toContainText('$150,000');
  await older.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    older.getByRole('link', { name: /Base MSRP: .*Source: Lucid Canada/ }),
  ).toHaveAttribute(
    'href',
    'https://ext.cpq.lucidmotors.com/cpq/configurator/v2/en-ca/air/2025/prCodes',
  );
  await expect(older).toContainText('not the discounted stock selling price');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Rivian factory packages, six-seat layouts and older new stock keep their own price and evidence', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Rivian');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('R1T Premium Dual-motor AWD');
  const truck = page.locator('article[aria-labelledby="title-rivian-ca-c1a3c0cac44a13cf"]');
  await expect(truck.locator('.price-row')).toContainText('$144,990');
  await expect(truck.locator('.published-price')).toHaveCount(0);
  await truck.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    truck.getByRole('link', { name: /Base MSRP: .*Source: Rivian Canada/ }),
  ).toHaveAttribute('href', 'https://rivian.com/en-CA/configurations/builder?MODEL=R1T');
  await truck.getByRole('checkbox', { name: /Compare/ }).check();
  await page
    .getByRole('searchbox', { name: 'Search cars' })
    .fill('R1S Premium Dual-motor AWD Long Range');
  const captains = page.locator('article[aria-labelledby="title-rivian-ca-856dc0455f074dfb"]');
  await expect(captains).toContainText('$175,290');
  await expect(captains).toContainText('6-seat Captain’s Chairs');
  await expect(captains).toContainText('All-Terrain');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('150000');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('all');
  await captains.getByRole('checkbox', { name: /Compare/ }).check();
  await page.getByRole('button', { name: 'Compare 2 cars' }).click();
  const dialog = page.getByRole('dialog');
  const prices = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Base MSRP', exact: true }) });
  await expect(prices).toContainText('$144,990');
  await expect(prices).toContainText('$175,290');
  const seats = dialog
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Seats', exact: true }) });
  await expect(seats).toContainText('5');
  await expect(seats).toContainText('6');
  await dialog.getByRole('button', { name: 'Close comparison' }).click();
  await revealCatalogFilters(page, true);
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('R1S');
  const older = page
    .getByRole('article')
    .filter({ has: page.locator('.price-row').filter({ hasText: '$139,990' }) })
    .first();
  await expect(older).toContainText('Observed new stock');
  await older.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    older.getByRole('link', { name: /Base MSRP: .*Source: Rivian Canada/ }),
  ).toHaveAttribute('href', 'https://rivian.com/configurations/api/v1/vehicle-ruleset');
  await expect(older).not.toContainText('$139,290');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Genesis regional all-inclusive prices keep their basis, missing fees and preorder status', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Genesis');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('G70');
  const advanced = page.locator(
    'article[aria-labelledby="title-genesis-ca-2027-1064-g7cs4k2dga00"]',
  );
  const prestige = page.locator(
    'article[aria-labelledby="title-genesis-ca-2027-1065-g7cs4k2dgp00"]',
  );
  await expect(advanced.locator('.price-row')).toContainText('Not verified');
  await expect(advanced.locator('.published-price')).toContainText('$57,131.88');
  await expect(advanced.locator('.published-price')).toContainText('AB · before sales tax');
  await advanced.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    advanced.getByRole('link', {
      name: /Published all-inclusive price: .*Source: Genesis Motors Canada/,
    }),
  ).toHaveAttribute(
    'href',
    'https://acquisition.genesis.ca/api/genesisbackend/GenesisShowroom/GetTrimsJson?language=en&province=AB&modelName=G70&year=2027',
  );
  await expect(advanced).toContainText('300');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('75000');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('all');
  await advanced.getByRole('checkbox', { name: /Compare/ }).check();
  await prestige.getByRole('checkbox', { name: /Compare/ }).check();
  await page.getByRole('button', { name: 'Compare 2 cars' }).click();
  const dialog = page.getByRole('dialog');
  const quote = dialog.getByRole('row').filter({
    has: page.getByRole('rowheader', { name: 'Published all-inclusive price', exact: true }),
  });
  await expect(quote).toContainText('$57,131.88');
  await expect(quote).toContainText('$62,631.88');
  await dialog.getByRole('button', { name: 'Close comparison' }).click();
  await revealCatalogFilters(page, true);
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Electrified GV70');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article').locator('.published-price')).toHaveCount(0);
  await page.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(page.getByRole('article')).toContainText('fee amounts are missing');
  await page.getByLabel('Availability evidence', { exact: true }).selectOption('announced');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Magma');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article').locator('.published-price')).toHaveCount(0);
  await page.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(page.getByRole('article')).toContainText('preorder');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('MINI factory packages, electric stock editions and older conflicting specifications retain exact evidence', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('MINI');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Cooper C 3 door');
  const piano = page.locator('article[aria-labelledby="title-mini-ca-2027-27ha-310-60-standard"]');
  await expect(piano).toContainText('$39,240');
  await piano.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(piano).toContainText('161');
  await expect(
    piano.getByRole('link', { name: /Base MSRP: .*Source: MINI Canada/ }),
  ).toHaveAttribute(
    'href',
    'https://api.minicdn.ca/v1/config/navdata?lang=en&cacode=27HA&lineid=310&styleid=60',
  );
  await expect(piano.getByRole('link', { name: /Power: .*Source: MINI Canada/ })).toHaveAttribute(
    'href',
    'https://api.minicdn.ca/v1/config/techspec?CACode=27HA&lang=en',
  );
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Countryman S ALL4');
  const packages = page.locator(
    'article[aria-labelledby="title-mini-ca-2027-27yd-305-58-zyu-zz0"]',
  );
  await expect(packages).toContainText('$53,890');
  await expect(packages).toContainText('Advanced Driver Assistance Package');
  await expect(packages).toContainText('Interior Protection Package');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('50000');
  await expect(packages).toHaveCount(0);
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Electric');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Countryman SE ALL4');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('Elementary Edition');
  await expect(page.getByRole('article')).toContainText('$49,990');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('all');
  const electric = page.locator(
    'article[aria-labelledby="title-mini-ca-2027-27ye-307-40-standard"]',
  );
  await electric.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(electric).toContainText('7.5');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('all');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Victory');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('1965 Victory Edition');
  await expect(page.getByRole('article')).toContainText('$55,200');
  await page.getByLabel('Model year', { exact: true }).selectOption('2025');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('John Cooper Works');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('Not verified');
  await page.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(page.getByRole('article')).toContainText('conflicts with stock');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('BMW Canadian MSRP, mild hybrids, electric models and older new stock retain their exact evidence', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('BMW');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page
    .getByRole('searchbox', { name: 'Search cars' })
    .fill('228 xDrive Gran Coupe Essential Edition');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('$50,900');
  await page.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(page.getByRole('article')).toContainText('241');
  await expect(page.getByRole('link', { name: /Base MSRP: .*Source: BMW Canada/ })).toHaveAttribute(
    'href',
    'https://configure.bmw.ca/en_CA/configure/F74/272A',
  );
  await expect(page.getByRole('link', { name: /Power: .*Source: BMW Canada/ })).toHaveAttribute(
    'href',
    /^https:\/\/prod\.ucp\.bmw\.cloud\/otd\/country-groups\/us\/ag-models\/23GG\//,
  );
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Hybrid');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('M340i xDrive Sedan');
  await expect(page.getByRole('article')).toHaveCount(2);
  const mild = page.locator('article[aria-labelledby="title-bmw-ca-2026-2634-63ft-s02tb"]');
  await expect(mild).toContainText('48 V mild hybrid');
  await expect(mild).toContainText('$74,500');
  await mild.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(mild).toContainText('386');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Electric');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('iX3 50 xDrive');
  await expect(page.getByRole('article')).toHaveCount(2);
  const electric = page.locator('article[aria-labelledby="title-bmw-ca-2027-27c1-33hr-automatic"]');
  await expect(electric).toContainText('$75,900');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('75000');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('all');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('all');
  await page.getByLabel('Model year', { exact: true }).selectOption('2025');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('530i xDrive Sedan');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('Not verified');
  await expect(page.getByRole('article')).toContainText('manufacturer-listed');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Polestar configured prices, EPA fields and older new-stock years remain distinct', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Polestar');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Long range Dual motor');
  const fastback = page.locator(
    'article[aria-labelledby="title-polestar-ca-2027-b8b53c0372705370"]',
  );
  await expect(fastback).toContainText('$69,900');
  await fastback.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(fastback).toContainText('447');
  await expect(
    fastback.getByRole('link', { name: /Base MSRP: .*Source: Polestar Canada/ }),
  ).toHaveAttribute(
    'href',
    /^https:\/\/www\.polestar\.com\/en-ca\/polestar-2\/configurator\/api\/v2\/initconfig\?/,
  );
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('4 coupe Rear motor');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('75000');
  const rear = page.locator('article[aria-labelledby="title-polestar-ca-2027-69bfc628fc6d152f"]');
  await expect(rear).toContainText('$64,900');
  await expect(rear).toContainText('RWD');
  await rear.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(rear).toContainText('21.8');
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('all');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('3 Performance');
  const performance = page.locator(
    'article[aria-labelledby="title-polestar-ca-2027-4cfce7283e2042b5"]',
  );
  await expect(performance).toContainText('$120,000');
  await performance.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(performance).toContainText('680');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('4 coupe');
  await expect(page.getByRole('article')).toHaveCount(7);
  const older = page.getByRole('article').first();
  await expect(older).toContainText('manufacturer-listed');
  await older.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(older).toContainText('499');
  await expect(
    older.getByRole('link', { name: /Base MSRP: .*Source: Polestar Canada/ }),
  ).toHaveAttribute('href', 'https://www.polestar.com/en-ca/stock-cars/polestar-4-coupe/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Mitsubishi mild hybrids, PHEVs, EVs and older inventory families keep distinct factory evidence', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Mitsubishi');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Hybrid');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Outlander');
  await expect(page.getByRole('article')).toHaveCount(7);
  const mild = page.getByRole('article').filter({ hasText: 'ES S-AWC' });
  await expect(mild).toContainText('$36,398');
  await expect(mild).toContainText('48 V mild hybrid');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Plug-in hybrid');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Outlander PHEV ES');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('$46,998');
  await page.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    page.getByRole('link', { name: /Base MSRP: .*Source: Mitsubishi Motors Canada/ }),
  ).toHaveAttribute(
    'href',
    /^https:\/\/www-graphql\.prod\.mipulse\.co\/prod\/graphql\?operationName=getModelSelector&/,
  );
  await expect(
    page.getByRole('link', { name: /Electric driving range: .*Source: Mitsubishi Motors Canada/ }),
  ).toHaveAttribute('href', 'https://www.mitsubishi-motors.ca/en/vehicles/outlander-phev/specs');
  await page.getByLabel('Model year', { exact: true }).selectOption('2027');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Electric');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Eclipse Sportback');
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('article').filter({ hasText: 'EV Tech Pkg' })).toContainText(
    '$54,098',
  );
  await page.getByLabel('Max base MSRP', { exact: true }).selectOption('50000');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('$48,998');
  await page.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(page.getByRole('article')).toContainText('454');
  await expect(page.getByRole('article')).toContainText('Combined gasoline-equivalent energy');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('all');
  await page.getByLabel('Availability evidence', { exact: true }).selectOption('not-checked');
  await page.getByLabel('Model year', { exact: true }).selectOption('2025');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Outlander');
  await expect(page.getByRole('article')).toHaveCount(6);
  await expect(page.getByRole('article').filter({ hasText: 'ES S-AWC' })).toContainText('$35,598');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Volkswagen transmissions keep exact fuel figures and passenger ID. Buzz variants retain seats and EV units', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page
    .getByLabel('Availability evidence', { exact: true })
    .selectOption('manufacturer-listed');
  await page.getByLabel('Make', { exact: true }).selectOption('Volkswagen');
  await page.getByLabel('Model year', { exact: true }).selectOption('2026');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('Jetta GLI');
  await expect(page.getByRole('article')).toHaveCount(2);
  const manual = page.getByRole('article').filter({ hasText: '6-speed Manual' });
  await expect(manual).toHaveCount(1);
  await expect(manual).toContainText('$35,395');
  await manual.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(
    manual.getByRole('link', { name: /Base MSRP: .*Source: Volkswagen Canada/ }),
  ).toHaveAttribute('href', /modelId-app=BU59V2&modelVersion-app=0&modelYear-app=2026/);
  for (const article of await page.getByRole('article').all())
    await article.getByRole('checkbox', { name: /^Compare / }).check();
  await page.getByRole('button', { name: /^Compare 2 cars/ }).click();
  await expect(page.getByRole('row', { name: /^Combined consumption/ })).toContainText('8.1');
  await expect(page.getByRole('row', { name: /^Combined consumption/ })).toContainText('8.2');
  await page.goto('/');
  await revealCatalogFilters(page);
  await page.getByLabel('Record type', { exact: true }).selectOption('retail-trim');
  await page.getByLabel('Make', { exact: true }).selectOption('Volkswagen');
  await page.getByLabel('Model year', { exact: true }).selectOption('2025');
  await page.getByLabel('Powertrain', { exact: true }).selectOption('Electric');
  await page.getByRole('searchbox', { name: 'Search cars' }).fill('ID. Buzz');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByLabel('Drivetrain', { exact: true }).selectOption('RWD');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('$77,495');
  await page.getByRole('button', { name: 'Specs & sources' }).click();
  await expect(page.getByRole('article')).toContainText('25.3');
  await expect(page.getByRole('article')).toContainText('377');
  await page.getByLabel('Drivetrain', { exact: true }).selectOption('all');
  for (const article of await page.getByRole('article').all())
    await article.getByRole('checkbox', { name: /^Compare / }).check();
  await page.getByRole('button', { name: /^Compare 2 cars/ }).click();
  await expect(page.getByRole('row', { name: /^Seats / })).toContainText('6');
  await expect(page.getByRole('row', { name: /^Seats / })).toContainText('7');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Nissan EV versions and Infiniti equipment packages preserve prices, energy units and unknown-price filtering', async ({
  page,
}) => {
  await page.goto('/');
  await revealCatalogFilters(page);
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
  await revealCatalogFilters(page);
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
  await revealCatalogFilters(page);
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
  await revealCatalogFilters(page);
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
  await revealCatalogFilters(page);
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
  await revealCatalogFilters(page);
  await expect(page.getByRole('article')).toHaveCount(30);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.locator('.results-caption')).toContainText('records matching your filters');
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
  await revealCatalogFilters(page);
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
  await revealCatalogFilters(page);
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
  await revealCatalogFilters(page);
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
  await revealCatalogFilters(page);
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
  await revealCatalogFilters(page);
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
  await revealCatalogFilters(page);
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
