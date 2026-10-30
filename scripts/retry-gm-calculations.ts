import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import {
  gmCaptureManifestSchema,
  gmConfiguration,
  gmMatrix,
  gmMatrixUrl,
  gmMsrp,
  gmPostalCode,
  gmReferenceKey,
  gmReferences,
  gmRetrieveUrl,
} from '../packages/car-catalog/src/gm-import.ts';
import type { GmBrand } from '../packages/car-catalog/src/gm-import.ts';

// Retries exact build calculations that GM's public calculator rejected during
// the reviewed capture. Responses are validated the same way sync-gm reads them
// and are written to a review manifest; nothing tracked changes until
// `npm run catalog:sync:gm -- --from-captures data/raw/gm/review-capture-manifest.json`.
// Progress is saved after every response, so an interrupted run resumes.
// The manifest keeps its original retrievedAt: the lineup and trim matrices
// these requests come from were not rechecked, so the import does not claim a
// newer date than its oldest required source.

const directory = 'data/raw/gm',
  base = `${directory}/capture-manifest.json`,
  review = `${directory}/review-capture-manifest.json`;
const delayMs = Number(process.env.GM_RETRY_DELAY_MS ?? 2500),
  maxConsecutiveRejections = 4;
const manifest = gmCaptureManifestSchema.parse(
  JSON.parse(await readFile(existsSync(review) ? review : base, 'utf8')),
);
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function stored(url: string) {
  const source = manifest.sources.find((s) => s.url === url && s.requestSha256 === null);
  if (!source) throw new Error(`Missing GM capture: ${url}`);
  const bytes = await readFile(`${directory}/${source.sha256}`);
  if (hash(bytes) !== source.sha256) throw new Error(`GM source checksum mismatch: ${url}`);
  return bytes.toString('utf8');
}
async function save() {
  await writeFile(`${review}.tmp`, JSON.stringify(manifest, null, 2) + '\n');
  await rename(`${review}.tmp`, review);
}

// HTTP 422 responses reject the combination itself (for example, no colour is
// selectable), so only rate-limit rejections are worth repeating.
const retryable = new Set(
  manifest.calculationFailures
    .filter((failure) => failure.reason.includes('HTTP403'))
    .map((failure) => failure.requestSha256),
);
type Option = ReturnType<typeof gmMatrix>['options'][number];
const pending: { brand: GmBrand; option: Option; request: string; requestSha256: string }[] = [];
const seen = new Set<string>();
for (const page of manifest.lineupPages)
  for (const reference of gmReferences(await stored(page.url), page.brand).models) {
    const key = gmReferenceKey(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    const matrix = gmMatrix(JSON.parse(await stored(gmMatrixUrl(reference))));
    for (const option of matrix.options) {
      const request = JSON.stringify({
        style: `en/CA/${key}/${option.styleId}`,
        ss: option.ss,
        postalCode: gmPostalCode,
      });
      const requestSha256 = hash(request);
      if (retryable.has(requestSha256))
        pending.push({ brand: reference.brand, option, request, requestSha256 });
    }
  }
console.log(`${pending.length} rejected GM calculations to retry.`);

let rejections = 0,
  recovered = 0;
for (const [index, item] of pending.entries()) {
  if (index) await sleep(delayMs);
  const url = gmRetrieveUrl(item.brand);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: item.request,
    signal: AbortSignal.timeout(60_000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (response.status === 403 || response.status === 429) {
    if (++rejections >= maxConsecutiveRejections) {
      console.log(`Stopped after ${rejections} consecutive rejections; rerun later to resume.`);
      break;
    }
    await sleep(60_000 * rejections);
    continue;
  }
  rejections = 0;
  const failure = manifest.calculationFailures.find((f) => f.requestSha256 === item.requestSha256)!;
  if (!response.ok) {
    failure.reason = `Exact public configuration calculation failed: Error: HTTP${response.status}. No fee-inclusive matrix price is substituted for MSRP.`;
    await save();
    continue;
  }
  // Reject anything sync-gm would not accept as this exact configuration.
  const raw = JSON.parse(bytes.toString('utf8'));
  try {
    gmConfiguration(raw, item.option);
    gmMsrp(raw, item.option);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('differs from the requested'))
      throw error;
    failure.reason =
      'The exact public configuration calculation returned a different factory identity. No other calculation or fee-inclusive matrix price is substituted for MSRP.';
    await save();
    continue;
  }
  const sha256 = hash(bytes);
  await writeFile(`${directory}/${sha256}`, bytes);
  manifest.sources.push({ url, sha256, requestSha256: item.requestSha256 });
  manifest.calculationFailures.splice(manifest.calculationFailures.indexOf(failure), 1);
  await save();
  recovered++;
  if (recovered % 25 === 0) console.log(`${recovered} recovered (${index + 1}/${pending.length}).`);
}
console.log(
  `Recovered ${recovered} calculations; ${manifest.calculationFailures.length} failures remain in ${review}.`,
);
