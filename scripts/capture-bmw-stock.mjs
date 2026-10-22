import { chromium } from 'playwright';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = process.env.BMW_STOCK_CAPTURE_DIR || 'data/raw/bmw/stock';
const hash = (value) => createHash('sha256').update(value).digest('hex');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const retrievedAt = new Date().toISOString();
  await page.goto('https://inventory.bmw.ca/en/NewInventorySearch?site=bmw.ca', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForFunction(() => window.InventorySearch?.LastSuccessfullRequestData, undefined, {
    timeout: 45000,
  });
  const base = await page.evaluate(() => ({
    ...window.InventorySearch.LastSuccessfullRequestData,
    ResultsPerPage: '48',
  }));
  if (
    base.Brand !== 'BMW' ||
    base.Status !== 'N' ||
    base.OnlyDemoVehicles !== false ||
    base.SeriesList.length ||
    base.EngineList.length ||
    base.ProvinceCode
  )
    throw new Error('BMW new-stock capture is unexpectedly filtered.');
  async function capture(number) {
    const body = JSON.stringify({ ...base, page: number });
    const raw = await page.evaluate(async (body) => {
      const response = await fetch('/InventorySearch_API', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', RDayAF: window.RDay.RDAFToken },
        body,
      });
      if (!response.ok) throw new Error(`BMW stock HTTP ${response.status}`);
      return response.text();
    }, body);
    const source = {
      url: 'https://inventory.bmw.ca/InventorySearch_API',
      sha256: hash(raw),
      requestSha256: hash(body),
    };
    await writeFile(`${directory}/${source.sha256}`, raw);
    await writeFile(`${directory}/${source.requestSha256}`, body);
    return { data: JSON.parse(raw), source };
  }
  const first = await capture(1),
    total = first.data.TotalCount,
    size = first.data.ResultsPerPage;
  if (!Number.isInteger(total) || total < 1 || size !== 48)
    throw new Error('BMW stock count/page size is invalid.');
  const pages = [first],
    pending = Array.from({ length: Math.ceil(total / size) - 1 }, (_, i) => i + 2);
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (pending.length) {
        const number = pending.shift(),
          result = await capture(number);
        if (
          result.data.Page !== number ||
          result.data.ResultsPerPage !== size ||
          result.data.TotalCount !== total
        )
          throw new Error(
            'BMW stock total changed during capture; retry before replacing the snapshot.',
          );
        pages[number - 1] = result;
        if (number % 20 === 0)
          console.log(`Captured BMW stock page ${number}/${Math.ceil(total / size)}`);
      }
    }),
  );
  const rows = pages.flatMap((page) => page.data.VehiclesForThisPageList);
  if (
    rows.length !== total ||
    rows.some((row) => typeof row.VIN !== 'string' || row.VIN.length !== 17)
  )
    throw new Error('BMW stock row count/identity is invalid.');
  const distinct = new Set(rows.map((row) => row.VIN)).size;
  const manifest = { retrievedAt, sources: pages.map((page) => page.source) };
  await writeFile(
    `${directory}/capture-manifest.json.tmp`,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await rename(`${directory}/capture-manifest.json.tmp`, `${directory}/capture-manifest.json`);
  console.log(
    `BMW new-stock capture: ${total} reported rows, ${distinct} distinct vehicle references. ${distinct < total ? 'Repeated pages leave exhaustive coverage unproven; the importer retains this gap.' : 'Reported count and distinct identities agree.'}`,
  );
} finally {
  await browser.close();
}
