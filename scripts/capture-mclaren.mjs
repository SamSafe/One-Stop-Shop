import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, rename } from 'node:fs/promises';

const folder = 'data/raw/mclaren',
  origin = 'https://configurator.mclaren.com';
await mkdir(folder, { recursive: true });
async function save(url, status, bytes) {
  const source = {
    url,
    status,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    capturedAt: new Date().toISOString(),
  };
  await writeFile(`${folder}/${source.sha256}`, bytes);
  if (status !== 200) throw new Error(`McLaren public source HTTP ${status}: ${url}`);
  return source;
}
async function capture(url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(45000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { source: await save(url, response.status, bytes), text: bytes.toString('utf8') };
}
const bootstrap = await capture(`${origin}/mclaren-ui/?model/gts`);
if (!bootstrap.text.includes('src="./assets/index-BNg9rp8r.js"'))
  throw new Error('McLaren public application changed; review its current client.');
const client = await capture(`${origin}/mclaren-ui/assets/index-BNg9rp8r.js`);
if (client.source.sha256 !== 'c75be33d5426536b2150de6d8512d239ad652816ccfe7272561dc9827ceb038f')
  throw new Error('McLaren public client checksum changed.');
const browser = await chromium.launch({ headless: true });
try {
  const menuPage = await browser.newPage();
  const menuResponse = menuPage.waitForResponse(
    (r) => r.url() === 'https://mclaren-cms.production.aws.mclaren.com/api/mainnav?site=1',
  );
  await menuPage.goto('https://www.mclaren.com/cars/gl_en/retailers/Toronto', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  const mr = await menuResponse;
  const menu = await save(mr.url(), mr.status(), Buffer.from(await mr.body()));
  await menuPage.close();
  const profiles = [];
  for (const id of ['artura', 'artura-spider', '750s', '750s-spider', 'gts']) {
    const context = await browser.newContext({ locale: 'en-CA' }),
      page = await context.newPage(),
      records = [],
      pending = [];
    page.on('response', (r) => {
      const u = new URL(r.url());
      if (
        u.origin !== origin ||
        !['ajaxLandingPageData.do', 'ajaxGetInitialData.do', 'ajaxGetCharacteristics.do'].some(
          (p) => u.pathname === `/configuration/${p}`,
        )
      )
        return;
      if (
        u.pathname.endsWith('/ajaxGetCharacteristics.do') &&
        u.searchParams.get('csticViewId') !== 'CSTIC_VIEW_0'
      )
        return;
      pending.push(
        (async () => {
          records.push(await save(r.url(), r.status(), Buffer.from(await r.body())));
        })(),
      );
    });
    const landingResponse = page.waitForResponse((r) => {
      const u = new URL(r.url());
      return (
        u.origin === origin &&
        u.pathname.endsWith('/ajaxLandingPageData.do') &&
        u.searchParams.get('country') === 'CA' &&
        u.searchParams.get('profileName') === id
      );
    });
    await page.goto(`${origin}/mclaren-ui/?model/${id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.getByRole('button', { name: 'Configure from Base Model', exact: true }).waitFor();
    if (!(await page.getByRole('button', { name: /Region:\s*Canada/i }).isVisible())) {
      await page.getByRole('button', { name: /^Region:/i }).click();
      await page.getByText('Canada', { exact: true }).last().click();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
    }
    await landingResponse;
    const generalResponse = page.waitForResponse((r) => {
      const u = new URL(r.url());
      return (
        u.origin === origin &&
        u.pathname.endsWith('/ajaxGetCharacteristics.do') &&
        u.searchParams.get('csticViewId') === 'CSTIC_VIEW_0'
      );
    });
    await page.getByRole('button', { name: 'Configure from Base Model', exact: true }).click();
    await generalResponse;
    await Promise.all(pending);
    const find = (fn) => {
      const matches = records.filter((r) => fn(new URL(r.url)));
      if (!matches.length) throw new Error(`Missing McLaren ${id} public response.`);
      return matches.at(-1);
    };
    profiles.push({
      id,
      landing: find(
        (u) =>
          u.pathname.endsWith('/ajaxLandingPageData.do') &&
          u.searchParams.get('country') === 'CA' &&
          u.searchParams.get('profileName') === id,
      ),
      initial: find((u) => u.pathname.endsWith('/ajaxGetInitialData.do')),
      general: find(
        (u) =>
          u.pathname.endsWith('/ajaxGetCharacteristics.do') &&
          u.searchParams.get('csticViewId') === 'CSTIC_VIEW_0' &&
          u.searchParams.get('instanceId') === '1',
      ),
    });
    await context.close();
    console.log(`Captured Canadian McLaren ${id} factory identity.`);
  }
  const manifest = {
    sources: { bootstrap: bootstrap.source, client: client.source, menu },
    profiles,
  };
  await writeFile(
    `${folder}/review-capture-manifest.json.tmp`,
    JSON.stringify(manifest, null, 2) + '\n',
  );
  await rename(
    `${folder}/review-capture-manifest.json.tmp`,
    `${folder}/review-capture-manifest.json`,
  );
} finally {
  await browser.close();
}
