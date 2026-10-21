import { createHash } from 'node:crypto';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import {
  subaruLineupUrl,
  subaruModels,
  subaruModelPrices,
  validateSubaruSnapshot,
} from '../packages/car-catalog/src/subaru-import.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const rawDirectory = path.join(root, 'data/raw/subaru');
await mkdir(rawDirectory, { recursive: true });
async function download(url: string, filename: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OSS Canadian vehicle catalog research (local development)' },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Subaru source HTTP ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(rawDirectory, filename), bytes);
  return { html: bytes.toString('utf8'), sha256: createHash('sha256').update(bytes).digest('hex') };
}
const lineup = await download(subaruLineupUrl, 'lineup.html');
const models = subaruModels(lineup.html);
const modelReceipts = [];
const trims = [];
for (const model of models) {
  const pricing = await download(model.pricingUrl, `${model.key}-${model.ModelYear}.html`);
  const entries = subaruModelPrices(model, pricing.html);
  trims.push(...entries);
  modelReceipts.push({
    name: model.DisplayModelName,
    year: model.ModelYear,
    rangeId: model.RangeId,
    pricingUrl: model.pricingUrl,
    pricingSha256: pricing.sha256,
    trimIds: entries.map((trim) => trim.manufacturerId),
  });
  console.log(
    `${model.DisplayModelName} ${model.ModelYear}: ${entries.length} retail configurations`,
  );
}
const snapshot = validateSubaruSnapshot({
  schemaVersion: 1,
  retrievedAt: new Date().toISOString(),
  lineup: { url: subaruLineupUrl, sha256: lineup.sha256 },
  models: modelReceipts,
  trims,
});
const directory = path.join(root, 'packages/car-catalog/data/manufacturers');
await mkdir(directory, { recursive: true });
const target = path.join(directory, 'subaru.json');
await writeFile(
  `${target}.tmp`,
  await format(JSON.stringify(snapshot), { ...(await resolveConfig(target)), parser: 'json' }),
);
await rename(`${target}.tmp`, target);
console.log(
  `Saved ${models.length} listed Subaru models and ${trims.length} exact retail configurations. Older stock/model-year availability still needs reconciliation.`,
);
