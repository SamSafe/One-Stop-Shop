import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  rivianHomeUrl,
  rivianBuilderUrl,
  rivianStockUrl,
  rivianRulesUrl,
  rivianSeatingCopyUrl,
  rivianWheelClientUrl,
  rivianWheelClientSha256,
  rivianReceiptSchema,
  rivianDeliveryPoints,
  rivianStockBody,
  rivianRulesBody,
  rivianStockResponseSchema,
  rivianBuilderLoader,
  rivianBuilderSchema,
  rivianFactoryProfiles,
  rivianRulesKey,
  validateRivianRules,
  validateRivianSnapshot,
  rivianRequireNoRegression,
} from '../packages/car-catalog/src/rivian-import.ts';
import type { RivianReceipt, RivianSnapshot } from '../packages/car-catalog/src/rivian-import.ts';
import { addRivianRetail } from '../packages/car-catalog/src/rivian.ts';

const folder = 'data/raw/rivian',
  target = 'packages/car-catalog/data/manufacturers/rivian.json';
const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
const manifestSchema = z.object({
  retrievedAt: z.iso.datetime(),
  sources: z.array(rivianReceiptSchema),
});
const offline = process.argv.includes('--offline'),
  arg = process.argv.indexOf('--from-captures');
const captured = offline || arg >= 0;
const manifest = captured
  ? manifestSchema.parse(
      JSON.parse(
        await readFile(
          arg >= 0 ? process.argv[arg + 1]! : `${folder}/capture-manifest.json`,
          'utf8',
        ),
      ),
    )
  : { retrievedAt: new Date().toISOString(), sources: [] as RivianReceipt[] };
await mkdir(folder, { recursive: true });
async function capture(url: string, body?: string) {
  const requestSha256 = body ? hash(body) : undefined;
  let source: RivianReceipt, bytes: Buffer;
  if (captured) {
    const receipt = manifest.sources.find(
      (s) => s.url === url && s.requestSha256 === requestSha256,
    );
    if (!receipt) throw new Error(`Missing Rivian capture: ${url} (${requestSha256 ?? 'GET'})`);
    source = rivianReceiptSchema.parse(receipt);
    bytes = await readFile(`${folder}/${source.sha256}`);
    if (hash(bytes) !== source.sha256) throw new Error('Rivian response checksum mismatch.');
    if (body && (await readFile(`${folder}/${requestSha256}`, 'utf8')) !== body)
      throw new Error('Rivian original request mismatch.');
  } else {
    const response = await fetch(url, {
      ...(body ? { method: 'POST', body, headers: { 'Content-Type': 'application/json' } } : {}),
      signal: AbortSignal.timeout(45000),
    });
    bytes = Buffer.from(await response.arrayBuffer());
    const raw = {
      url,
      status: response.status,
      sha256: hash(bytes),
      ...(requestSha256 ? { requestSha256 } : {}),
    };
    await writeFile(`${folder}/${raw.sha256}`, bytes);
    if (body) await writeFile(`${folder}/${requestSha256}`, body);
    if (!response.ok && !(url === rivianStockUrl && response.status === 400))
      throw new Error(`Rivian required source HTTP ${response.status}: ${url}`);
    source = rivianReceiptSchema.parse(raw);
    manifest.sources.push(source);
    await writeFile(
      `${folder}/review-capture-manifest.json`,
      JSON.stringify(manifest, null, 2) + '\n',
    );
  }
  return {
    source,
    text: bytes.toString('utf8'),
    json: () => JSON.parse(bytes.toString('utf8')) as unknown,
  };
}
const home = await capture(rivianHomeUrl);
const next = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(
  home.text,
);
if (!next) throw new Error('Rivian Canadian overview contract changed.');
const overview = z
  .object({
    locale: z.literal('en-CA'),
    props: z.object({
      pageProps: z.object({
        data: z.object({
          consumerNavbarConfig: z.object({
            primaryItems: z.array(
              z.object({
                cards: z
                  .array(
                    z.object({
                      type: z.string(),
                      sku: z.string().optional(),
                      actions: z
                        .array(z.object({ label: z.string(), href: z.string() }))
                        .optional(),
                    }),
                  )
                  .optional(),
              }),
            ),
          }),
        }),
      }),
    }),
  })
  .parse(JSON.parse(next[1]!));
const orderModels = overview.props.pageProps.data.consumerNavbarConfig.primaryItems
  .flatMap((i) => i.cards ?? [])
  .filter((c) => c.type === 'vehicle' && c.actions?.some((a) => a.label === 'Design yours'))
  .map((c) => z.enum(['R1S', 'R1T']).parse(c.sku?.toUpperCase()))
  .sort();
const current: RivianSnapshot['current'] = [];
const wheelSelector = await capture(rivianWheelClientUrl);
if (wheelSelector.source.sha256 !== rivianWheelClientSha256)
  throw new Error(
    'Rivian visible wheel/package selector changed; review the current client before import.',
  );
for (const model of orderModels) {
  const response = await capture(rivianBuilderUrl(model));
  if (!response.text.includes(new URL(rivianWheelClientUrl).pathname))
    throw new Error(
      'Rivian reviewed wheel/package client is no longer linked by the current builder.',
    );
  const builder = rivianBuilderSchema.parse(rivianBuilderLoader(response.text));
  builder.ruleset = validateRivianRules(builder.ruleset);
  const expanded = rivianFactoryProfiles(builder.ruleset, builder.selection);
  current.push({
    source: response.source,
    builder,
    expectedProfileKeys: expanded.profiles.map((p) => p.key),
  });
}
const deferredModels: RivianSnapshot['deferredModels'] = [];
let standardSource: RivianReceipt | undefined;
for (const model of ['R2', 'R3']) {
  const response = await capture(`https://rivian.com/en-CA/${model.toLowerCase()}`);
  if (model === 'R2' && !response.text.includes('Coming 2027'))
    throw new Error('Rivian R2 Canadian ordering status needs renewed review.');
  if (model === 'R2') {
    const plain = response.text
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    if (
      !plain.includes(
        'R1S is our all-electric SUV with three rows and seating for seven passengers.',
      ) ||
      !plain.includes(
        'R1T is our all-electric truck with two rows and seating for five passengers.',
      )
    )
      throw new Error('Rivian Canadian default seating needs renewed review.');
    standardSource = response.source;
  }
  deferredModels.push({
    model,
    source: response.source,
    reason:
      model === 'R2'
        ? 'The Canadian page advertises Coming 2027 and reservations. An exact Canadian model-year/retail-trim ordering identity is not yet reconciled; a launch calendar year is not assumed to be a model year.'
        : 'The Canadian R3 page and gallery are captured, but no exact Canadian retail-trim/model-year ordering identity is reconciled. Availability remains a research gap.',
  });
}
const seatingCopy = await capture(rivianSeatingCopyUrl);
const seatingDescriptions = z
  .object({ builderOptions: z.record(z.string(), z.unknown()) })
  .parse(seatingCopy.json());
for (const code of ['bund-ar02', 'seat-capt']) {
  const description = z
    .object({ cardDescription: z.string() })
    .parse(seatingDescriptions.builderOptions[code]);
  if (!description.cardDescription.includes('Six passengers'))
    throw new Error('Rivian Captain’s Chairs seating count needs renewed review.');
}
const searches: RivianSnapshot['searches'] = [],
  rows = new Map<string, RivianSnapshot['stock'][number]>();
for (const [province, postalCode] of Object.entries(rivianDeliveryPoints)) {
  for (const model of orderModels) {
    const key = `${province}/${model}`,
      response = await capture(rivianStockUrl, rivianStockBody(model, postalCode));
    if (response.source.status === 400) {
      const error = z
        .object({
          error: z.object({
            graphQLErrors: z
              .array(
                z.object({
                  extensions: z.object({
                    code: z.literal('NO_DC'),
                    classification: z.literal('DataFetchingException'),
                  }),
                }),
              )
              .min(1),
          }),
        })
        .parse(response.json());
      if (!error.error.graphQLErrors.length) throw new Error('Unreviewed Rivian stock failure.');
      searches.push({
        key,
        model,
        province,
        postalCode,
        source: response.source,
        error: 'NO_DC',
        identities: [],
        reportedRows: 0,
      });
      continue;
    }
    const data = rivianStockResponseSchema.parse(response.json()).shopSearch;
    if (data.postalCode !== postalCode || data.cursor || data.similarResults.length)
      throw new Error(
        'Rivian search pagination/similar results or postal context requires reconciliation.',
      );
    const identities: string[] = [];
    for (const vehicle of data.results) {
      if (vehicle.model !== model) throw new Error('Rivian stock model search mismatch.');
      const { configId, region: _region, shopType: _type, ...rest } = vehicle;
      const identityHash = hash(configId),
        previous = rows.get(identityHash);
      if (previous) {
        if (
          previous.model !== rest.model ||
          previous.modelYear !== rest.modelYear ||
          previous.ruleset !== rest.ruleset ||
          JSON.stringify(previous.marketingOptions) !== JSON.stringify(rest.marketingOptions)
        )
          throw new Error('Rivian stock identity changes across delivery-point searches.');
        previous.searchKeys.push(key);
      } else rows.set(identityHash, { ...rest, identityHash, searchKeys: [key] });
      identities.push(identityHash);
    }
    searches.push({
      key,
      model,
      province,
      postalCode,
      source: response.source,
      error: null,
      identities: identities.sort(),
      reportedRows: data.results.length,
    });
  }
}
const stock = [...rows.values()].sort((a, b) => a.identityHash.localeCompare(b.identityHash));
const neededRules = new Map(stock.map((r) => [rivianRulesKey(r.model, r.ruleset), r]));
const stockRules: RivianSnapshot['stockRules'] = [];
for (const [key, row] of neededRules) {
  const response = await capture(rivianRulesUrl, rivianRulesBody(row.model, row.ruleset));
  const product = z
    .object({ vehicleProduct: z.object({ ruleset: z.unknown() }) })
    .parse(response.json());
  stockRules.push({
    key,
    source: response.source,
    rules: validateRivianRules(product.vehicleProduct.ruleset),
  });
}
const snapshot = validateRivianSnapshot({
  schemaVersion: 1,
  retrievedAt: manifest.retrievedAt,
  homeSource: home.source,
  wheelSelectorSource: wheelSelector.source,
  listedOrderModels: orderModels,
  deferredModels,
  seating: {
    standardSource,
    captainsSource: seatingCopy.source,
    standard: { R1S: 7, R1T: 5 },
    captains: 6,
  },
  current,
  stockRules: stockRules.sort((a, b) => a.key.localeCompare(b.key)),
  searches,
  stock,
});
const catalog = addRivianRetail(
  {
    schemaVersion: 1,
    reviewedAt: snapshot.retrievedAt.slice(0, 10),
    scope: 'Canadian Rivian import validation',
    pricingNote: 'Factory MSRP before paint, accessories, delivery, taxes, fees and incentives.',
    sources: [],
    cars: [],
  },
  snapshot,
);
if (!captured) {
  let previous: RivianSnapshot | undefined;
  try {
    previous = validateRivianSnapshot(JSON.parse(await readFile(target, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (previous) rivianRequireNoRegression(previous, snapshot);
}
const serialized = await format(JSON.stringify(snapshot), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (serialized !== (await readFile(target, 'utf8')))
    throw new Error('Rivian offline reconstruction differs from the reviewed snapshot.');
  console.log('Rivian offline request/response checksums and normalized reconstruction match.');
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
  await writeFile(`${folder}/capture-manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
}
console.log(
  JSON.stringify({
    currentProfiles: snapshot.current.reduce((n, c) => n + c.expectedProfileKeys.length, 0),
    observedStockConfigurations: snapshot.stock.length,
    retailProfiles: catalog.cars.length,
    successfulDeliverySearches: snapshot.searches.filter((q) => !q.error).length,
  }),
);
