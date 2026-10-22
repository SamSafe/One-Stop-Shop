import { chromium } from 'playwright';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = process.env.MINI_STOCK_CAPTURE_DIR || 'data/raw/mini/stock';
const hash = (value) => createHash('sha256').update(value).digest('hex');
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
  async function capture(number) {
    const body = JSON.stringify({ ...base, page: number });
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
  const first = await capture(1),
    total = first.data.TotalCount,
    size = first.data.ResultsPerPage;
  if (!Number.isInteger(total) || total < 1 || size !== 36 || first.data.Page !== 1)
    throw new Error('Invalid MINI stock count/page size.');
  const pages = [first],
    queue = Array.from({ length: Math.ceil(total / size) - 1 }, (_, i) => i + 2);
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const number = queue.shift(),
          row = await capture(number);
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
  const rows = pages.flatMap((row) => row.data.VehiclesForThisPageList);
  if (
    rows.length !== total ||
    new Set(rows.map((row) => row.VIN)).size !== total ||
    rows.some(
      (row) =>
        typeof row.VIN !== 'string' ||
        row.VIN.length !== 17 ||
        row.BrandCode !== 'M' ||
        row.Status !== 'N' ||
        row.IsNewInventory !== true ||
        row.IsDemo !== false ||
        row.VehicleType !== 'C',
    )
  )
    throw new Error(
      'MINI stock count/new-vehicle identities do not reconcile; previous manifest retained.',
    );
  await writeFile(
    `${directory}/capture-manifest.json.tmp`,
    JSON.stringify({ retrievedAt, sources: pages.map((row) => row.source) }, null, 2) + '\n',
  );
  await rename(`${directory}/capture-manifest.json.tmp`, `${directory}/capture-manifest.json`);
  console.log(
    `Captured ${total} distinct MINI new vehicles across ${pages.length} reconciled pages.`,
  );
} finally {
  await browser.close();
}
