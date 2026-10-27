import { createHash } from 'node:crypto';
import { mkdir, writeFile, rename } from 'node:fs/promises';
const folder = 'data/raw/owner-directory',
  dataset = '98f1a129-f628-4ce4-b24d-6f16bf24dd64';
const expected = new Set([
  '026e45b4-eb63-451f-b34f-d9308ea3a3d9',
  '8812228b-a6aa-4303-b3d0-66489225120d',
  '9df1b18d-d036-4783-a61c-99f1f75b3ac5',
  'd589f2bc-9a85-4f65-be2f-20f17debfcb1',
  'c98b9dc8-b23f-4cd8-8b19-e892da1e4688',
  '42495676-28b7-40f3-b0e0-3d7fe005ca56',
]);
async function get(input) {
  let url = new URL(input);
  for (let n = 0; n < 4; n++) {
    if (
      url.protocol !== 'https:' ||
      !['open.canada.ca', 'opencanada.blob.core.windows.net'].includes(url.hostname) ||
      url.username ||
      url.password
    )
      throw new Error('Unreviewed owner dataset host.');
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(45000) });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const location = r.headers.get('location');
      if (!location) throw new Error('Dataset redirect has no destination.');
      await r.body?.cancel();
      url = new URL(location, url);
      continue;
    }
    if (!r.ok || !r.body) throw new Error(`Dataset HTTP ${r.status}`);
    const reader = r.body.getReader(),
      chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 10000000) throw new Error('Owner dataset exceeds reviewed size bound.');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    return Buffer.concat(chunks);
  }
  throw new Error('Too many dataset redirects.');
}
await mkdir(folder, { recursive: true });
const metadata = await get(`https://open.canada.ca/data/api/action/package_show?id=${dataset}`),
  data = JSON.parse(metadata).result;
const selected = data.resources.filter(
  (r) =>
    r.format?.toUpperCase() === 'CSV' &&
    r.language?.includes('en') &&
    !r.name.startsWith('(Original'),
);
if (selected.length !== 6 || selected.some((r) => !expected.has(r.id)))
  throw new Error('Review changed Canadian dataset resources before refreshing.');
await writeFile(`${folder}/package.json`, metadata);
const sources = [];
for (const r of selected) {
  const u = new URL(r.url);
  if (u.origin !== 'https://open.canada.ca' || !u.pathname.includes(`/resource/${r.id}/download/`))
    throw new Error('Dataset resource URL changed.');
  const b = await get(r.url),
    sha256 = createHash('sha256').update(b).digest('hex');
  await writeFile(`${folder}/${sha256}`, b);
  sources.push({
    id: r.id,
    title: r.name,
    url: r.url,
    sha256,
    bytes: b.length,
    capturedAt: new Date().toISOString(),
  });
  console.log(`${r.name}: ${b.length} bytes`);
}
// Download redirect query strings are ephemeral; only canonical publisher URLs are retained.
await writeFile(
  `${folder}/manifest.json.tmp`,
  JSON.stringify({ schemaVersion: 1, sources }, null, 2) + '\n',
);
await rename(`${folder}/manifest.json.tmp`, `${folder}/manifest.json`);
