import { chromium } from 'playwright';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = process.env.MINI_STOCK_CAPTURE_DIR || 'data/raw/mini/stock';
const hash = (value) => createHash('sha256').update(value).digest('hex');
// Every published sort order has ties, so paging can repeat a vehicle and skip
// another. Complete passes in further orders are added until the distinct
// vehicles match the reported total.
const sortModes = ['PriceAscending', 'PriceDescending', 'YearAscending', 'YearDescending'];
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let normalRequest;
  page.on('request', (request) => {
    if (/\/en\/shopping\/inventory\/InventorySearch_API(?:_Init)?$/.test(request.url()))
      normalRequest = request.postDataJSON();
  });
  const retrievedAt = new Date().toISOString();
  await page.goto('https://www.mini.ca/en/shopping/inventory/', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForFunction(
    () => window.InventorySearch?.UpdatePage_LastSuccessfulResponse,
    undefined,
    { timeout: 45000 },
  );
  if (
    normalRequest?.Brand !== 'MINI' ||
    normalRequest?.Status !== 'N' ||
    normalRequest?.OnlyDemoVehicles !== false
  )
    throw new Error('Missing normal public MINI new-stock request.');
  const base = {
    ...normalRequest,
    SortMode: sortModes[0],
    ResultsPerPage: '36',
    WithPhotosOnly: false,
    FeaturedStockNumberList: [],
  };
  for (const field of [
    'ProvinceCode',
    'DealerID',
    'InternalRetailerIDs',
    'SeriesID',
    'ModelID',
    'ExteriorColorID',
    'InteriorColorID',
    'FuelType',
    'Transmission',
    'Vehicle_Line',
    'ModelYear_Minimum',
    'ModelYear_Maximum',
    'Price_Minimum',
    'Price_Maximum',
    'Kilometers_Minimum',
    'Kilometers_Maximum',
    'UserLatitude',
    'UserLongitude',
    'SearchDistanceFromUserLocationInKilometers',
  ])
    if (field in base) base[field] = null;
  async function capture(number, mode) {
    const body = JSON.stringify({ ...base, SortMode: mode, page: number });
    const raw = await page.evaluate(async (body) => {
      const response = await fetch('/en/shopping/inventory/InventorySearch_API', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', RDayAF: window.RDay.RDAFToken },
        body,
      });
      if (!response.ok) throw new Error(`MINI stock HTTP ${response.status}`);
      return response.text();
    }, body);
    const source = {
      url: 'https://www.mini.ca/en/shopping/inventory/InventorySearch_API',
      sha256: hash(raw),
      requestSha256: hash(body),
      status: 200,
    };
    await writeFile(`${directory}/${source.sha256}`, raw);
    await writeFile(`${directory}/${source.requestSha256}`, body);
    return { data: JSON.parse(raw), source };
  }
  const first = await capture(1, sortModes[0]),
    total = first.data.TotalCount,
    size = first.data.ResultsPerPage;
  if (!Number.isInteger(total) || total < 1 || size !== 36 || first.data.Page !== 1)
    throw new Error('Invalid MINI stock count/page size.');
  const count = Math.ceil(total / size),
    sources = [],
    vehicles = new Set();
  for (const mode of sortModes) {
    const pages = mode === sortModes[0] ? [first] : [],
      queue = Array.from({ length: count - pages.length }, (_, i) => i + pages.length + 1);
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (queue.length) {
          const number = queue.shift(),
            row = await capture(number, mode);
          if (
            row.data.Page !== number ||
            row.data.TotalCount !== total ||
            row.data.ResultsPerPage !== size
          )
            throw new Error('MINI stock pagination changed; previous manifest retained.');
          pages[number - 1] = row;
        }
      }),
    );
    const rows = pages.flatMap((row) => row.data.VehiclesForThisPageList),
      unexpected = rows.filter(
        (row) =>
          typeof row.VIN !== 'string' ||
          row.VIN.length !== 17 ||
          row.BrandCode !== 'M' ||
          row.Status !== 'N' ||
          row.IsNewInventory !== true ||
          row.IsDemo !== false ||
          row.VehicleType !== 'C',
      );
    if (rows.length !== total || unexpected.length)
      throw new Error(
        `MINI stock count/new-vehicle identities do not reconcile (${total} reported, ${rows.length} returned, ${unexpected.length} unexpected); previous manifest retained.`,
      );
    for (const row of rows) vehicles.add(row.VIN);
    sources.push(...pages.map((row) => row.source));
    console.log(`MINI ${mode}: ${vehicles.size} of ${total} distinct vehicles seen.`);
    if (vehicles.size === total) break;
  }
  if (vehicles.size !== total)
    throw new Error(
      `MINI stock passes found ${vehicles.size} of ${total} distinct vehicles; previous manifest retained.`,
    );
  await writeFile(
    `${directory}/capture-manifest.json.tmp`,
    JSON.stringify({ retrievedAt, sources }, null, 2) + '\n',
  );
  await rename(`${directory}/capture-manifest.json.tmp`, `${directory}/capture-manifest.json`);
  console.log(
    `Captured ${total} distinct MINI new vehicles across ${sources.length} reconciled pages.`,
  );
} finally {
  await browser.close();
}
