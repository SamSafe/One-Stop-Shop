import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import { validateSubaruSnapshot } from '../packages/car-catalog/src/subaru-import.ts';
import {
  parseSubaruSpecifications,
  validateSubaruSpecifications,
} from '../packages/car-catalog/src/subaru-specifications-import.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const lineup = validateSubaruSnapshot(
  JSON.parse(
    await readFile(path.join(root, 'packages/car-catalog/data/manufacturers/subaru.json'), 'utf8'),
  ),
);
const rawDirectory = path.join(root, 'data/raw/subaru-specifications');
await mkdir(rawDirectory, { recursive: true });
const models = [];
for (const model of lineup.models) {
  const url = lineup.trims.find(
    (trim) => trim.model === model.name && trim.year === model.year,
  )!.specificationsUrl;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OSS Canadian vehicle catalog research (local development)' },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Subaru specifications HTTP ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const filename = `${model.year}-${model.name.toLowerCase()}.html`;
  await writeFile(path.join(rawDirectory, filename), bytes);
  const parsed = parseSubaruSpecifications(bytes.toString('utf8'), model.name, model.year);
  models.push({
    ...parsed,
    source: {
      url,
      responseUrl: response.url,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  });
  console.log(
    `${model.year} ${model.name}: ${parsed.trims.length} exact columns, ${parsed.rows.length} selected rows`,
  );
}
const snapshot = validateSubaruSpecifications(
  { schemaVersion: 1, retrievedAt: new Date().toISOString(), models },
  lineup,
);
const target = path.join(
  root,
  'packages/car-catalog/data/manufacturers/subaru-specifications.json',
);
await writeFile(
  `${target}.tmp`,
  await format(JSON.stringify(snapshot), { ...(await resolveConfig(target)), parser: 'json' }),
);
await rename(`${target}.tmp`, target);
console.log(
  `Saved ${models.length} specification pages; pricing and lineup receipts were not refreshed.`,
);
