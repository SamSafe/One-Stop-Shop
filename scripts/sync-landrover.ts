import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  landroverReceiptSchema,
  landroverJsonp,
  landroverRaw,
  landroverLists,
  landroverVisibleProducts,
  landroverProfile,
  validateLandroverSnapshot,
  landroverClientHash,
} from '../packages/car-catalog/src/landrover-import.ts';
const folder = 'data/raw/landrover',
  target = 'packages/car-catalog/data/manufacturers/landrover.json';
const offline = process.argv.includes('--offline'),
  supplied = process.argv.includes('--from-captures');
if (!offline && !supplied)
  throw new Error(
    'Use --from-captures after reviewing current public Canadian builder captures, or --offline for exact reconstruction. No stale URL refresh is claimed.',
  );
const research = z
  .object({ sources: z.array(z.object({ url: z.string(), sha256: z.string() }).passthrough()) })
  .parse(JSON.parse(await readFile(`${folder}/research-manifest.json`, 'utf8')));
// Research receipts can contain transport metadata. Only the bounded receipt DTO is retained.
const receipt = (r: unknown) =>
  landroverReceiptSchema.parse(
    (({ url, status, sha256, capturedAt }) => ({ url, status, sha256, capturedAt }))(
      r as z.infer<typeof landroverReceiptSchema>,
    ),
  );
const review = JSON.parse(await readFile(`${folder}/derivative-review-manifest.json`, 'utf8')) as {
  families: {
    rootSha256: string;
    excluded: string[];
    bodies: { id: string; steps: unknown[] }[];
    products: { id: string; body: string; final: unknown; steps: unknown[] }[];
  }[];
};
async function body(r: z.infer<typeof landroverReceiptSchema>) {
  const bytes = await readFile(`${folder}/${r.sha256}`);
  if (createHash('sha256').update(bytes).digest('hex') !== r.sha256)
    throw new Error(`Land Rover checksum differs: ${r.url}`);
  return bytes.toString('utf8');
}
const byHash = (sha: string) => {
  const r = research.sources.find((r) => r.sha256 === sha);
  if (!r) throw new Error(`Missing Land Rover receipt ${sha}`);
  return receipt(r);
};
const normalizer = byHash(landroverClientHash),
  lineup = receipt(
    research.sources.find(
      (r) => r.url === 'https://www.landrover.ca/en/build-your-own/index.html',
    )!,
  ),
  yearSource = receipt(
    research.sources.find(
      (r) => r.url === 'https://www.rangerover.com/en-ca/range-rover/index.html',
    )!,
  );
await body(normalizer);
const lineupText = await body(lineup),
  overview = await body(yearSource),
  title = /<title\b[^>]*>([^<]+)<\/title>/.exec(overview)?.[1];
if (!title || !lineupText.includes('l663') || !lineupText.includes('l551'))
  throw new Error('Canadian lineup/year page changed.');
const profiles = [],
  families = [];
for (const f of review.families) {
  const source = byHash(f.rootSha256),
    root = landroverRaw(landroverJsonp(await body(source))),
    family = root['feature-dictionary'].vehicle.id;
  const visibleBodies = landroverLists(root)
    .get('BODYSTYLE')!
    .feature!.filter((b) => b.property?.HideRegister !== 'hidden')
    .map((b) => b.id)
    .sort();
  if (JSON.stringify(visibleBodies) !== JSON.stringify(f.bodies.map((b) => b.id).sort()))
    throw new Error('Land Rover body coverage differs.');
  const expected: string[] = [],
    excluded: string[] = [];
  for (const b of f.bodies) {
    let parent = root;
    for (const r of b.steps) {
      const raw = landroverJsonp(await body(receipt(r)));
      if ((raw as { metadata: { status: string } }).metadata.status === '200')
        parent = landroverRaw(raw);
    }
    const selected = landroverLists(parent)
      .get('BODYSTYLE')!
      .feature!.filter((f) => ['selected', 'default'].includes(f.availability));
    if (selected.length !== 1 || selected[0]!.id !== b.id)
      throw new Error('Land Rover body resolution differs.');
    const visible = landroverVisibleProducts(parent);
    expected.push(...visible.visible.filter((v) => v.body.id === b.id).map((v) => v.product.id));
    excluded.push(...visible.hidden);
  }
  if (
    JSON.stringify([...new Set(expected)].sort()) !==
    JSON.stringify(f.products.map((p) => p.id).sort())
  )
    throw new Error('Land Rover derivative coverage differs.');
  for (const p of f.products) {
    for (const step of p.steps) await body(receipt(step));
    const r = receipt(p.final),
      raw = landroverRaw(landroverJsonp(await body(r)));
    if (raw['feature-dictionary'].vehicle.id !== family)
      throw new Error('Land Rover resolved family changed.');
    profiles.push(landroverProfile(raw, p.id, r, title));
  }
  families.push({
    family,
    source,
    productIds: expected,
    excluded: [...new Set(excluded)].filter((id) => !expected.includes(id)).sort(),
  });
}
const retrievedAt = [
  normalizer,
  lineup,
  yearSource,
  ...families.map((f) => f.source),
  ...profiles.map((p) => p.source),
]
  .map((r) => r.capturedAt)
  .sort()
  .at(-1)!;
const snapshot = validateLandroverSnapshot({
  schemaVersion: 1,
  market: 'CA',
  retrievedAt,
  normalizer,
  lineup,
  yearSource,
  families,
  profiles,
});
try {
  const before = validateLandroverSnapshot(JSON.parse(await readFile(target, 'utf8')));
  if (
    before.profiles.some(
      (p) =>
        !snapshot.profiles.some((n) => n.family === p.family && n.id === p.id && n.year === p.year),
    )
  )
    throw new Error(
      'Land Rover derivative/year disappeared; review older new stock before replacement.',
    );
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
const serialized = await format(JSON.stringify(snapshot), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (serialized !== (await readFile(target, 'utf8')))
    throw new Error('Land Rover offline reconstruction differs.');
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
}
console.log(
  JSON.stringify({
    profiles: profiles.length,
    yearQualified: profiles.filter((p) => p.year !== null).length,
    knownBasePrices: profiles.filter((p) => p.price !== null).length,
    exactOfflineReplay: offline,
  }),
);
