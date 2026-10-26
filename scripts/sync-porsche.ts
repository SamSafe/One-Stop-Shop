import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  porscheLineupUrl,
  porscheClients,
  porscheReceiptSchema,
  porscheLineup,
  porscheFactory,
  porscheDetail,
  porscheProfileKey,
  porscheSelectionUrl,
  validatePorscheSnapshot,
  porscheNoRegression,
} from '../packages/car-catalog/src/porsche-import.ts';
import type {
  PorscheSnapshot,
  PorscheFactory,
} from '../packages/car-catalog/src/porsche-import.ts';

const folder = 'data/raw/porsche',
  target = 'packages/car-catalog/data/manufacturers/porsche.json';
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const offline = process.argv.includes('--offline'),
  arg = process.argv.indexOf('--from-captures'),
  extend = process.argv.includes('--capture-missing');
if ((arg >= 0 && !process.argv[arg + 1]) || (extend && (arg < 0 || offline)))
  throw new Error('Use --capture-missing only with --from-captures <manifest>.');
const captured = offline || arg >= 0;
const rawReceipt = porscheReceiptSchema
  .extend({ url: z.url(), finalUrl: z.url().optional() })
  .strip();
const manifest = captured
  ? z
      .object({ sources: z.array(rawReceipt) })
      .parse(
        JSON.parse(
          await readFile(
            arg >= 0 ? process.argv[arg + 1]! : `${folder}/capture-manifest.json`,
            'utf8',
          ),
        ),
      )
  : { sources: [] as z.infer<typeof rawReceipt>[] };
await mkdir(folder, { recursive: true });
const used: z.infer<typeof porscheReceiptSchema>[] = [];
async function capture(url: string) {
  let r = manifest.sources.findLast((r) => r.url === url),
    bytes: Buffer;
  if (captured && r) {
    if (r.finalUrl && r.finalUrl !== url) throw new Error(`Redirected Porsche source: ${url}`);
    bytes = await readFile(`${folder}/${r.sha256}`);
    if (hash(bytes) !== r.sha256) throw new Error('Porsche source checksum mismatch.');
  } else {
    if (captured && !extend) throw new Error(`Missing required Porsche capture: ${url}`);
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(45000) });
    bytes = Buffer.from(await response.arrayBuffer());
    r = { url, status: response.status, sha256: hash(bytes), capturedAt: new Date().toISOString() };
    await writeFile(`${folder}/${r.sha256}`, bytes);
    manifest.sources.push(r);
    await writeFile(
      `${folder}/review-capture-manifest.json`,
      JSON.stringify(manifest, null, 2) + '\n',
    );
  }
  const source = porscheReceiptSchema.strip().parse(r);
  if (source.status !== 200)
    throw new Error(`Required Porsche source HTTP ${source.status}: ${url}`);
  used.push(source);
  return { source, text: bytes.toString('utf8') };
}
const overview = await capture(porscheLineupUrl),
  models = porscheLineup(overview.text),
  clients = [];
for (const client of porscheClients) {
  const c = await capture(client.url);
  if (c.source.sha256 !== client.sha256)
    throw new Error('Porsche native selection client changed; review before refresh.');
  clients.push(c.source);
}
const rows: PorscheSnapshot['models'] = [];
for (const reference of models) {
  const page = await capture(reference.detailUrl),
    detail = { source: page.source, data: porscheDetail(page.text, reference) };
  if (!reference.builderUrl) {
    rows.push({ reference, detail, initial: null, profiles: [] });
    continue;
  }
  const response = await capture(reference.builderUrl);
  if (!response.text.includes(`/public/${porscheClients[0]!.file}`))
    throw new Error('Porsche builder no longer links the reviewed selection client.');
  const initial = { source: response.source, data: porscheFactory(response.text, reference) },
    profiles: PorscheSnapshot['models'][number]['profiles'] = [];
  if (initial.data.transmission)
    profiles.push({
      key: porscheProfileKey(initial.data),
      source: initial.source,
      data: initial.data,
      selection: null,
    });
  async function select(
    parent: PorscheFactory,
    parentKey: string,
    optionId: string,
    replacedId?: string,
  ) {
    const url = porscheSelectionUrl(parent, optionId, replacedId),
      response = await capture(url),
      data = porscheFactory(response.text, reference);
    if (!response.text.includes(`/public/${porscheClients[0]!.file}`))
      throw new Error('Porsche selected page changed its reviewed native client.');
    if (
      !data.transmission ||
      !data.selectedOptions.includes(optionId) ||
      (optionId === '3UG' ? !data.rearSeatOption?.selected : data.transmission.id !== optionId)
    )
      throw new Error('Porsche native option selection was not honored.');
    const profile = {
      key: porscheProfileKey(data),
      source: response.source,
      data,
      selection: { parentKey, optionId, replacedId: replacedId ?? null },
    };
    if (profiles.some((p) => p.key === profile.key))
      throw new Error('Porsche native option selection repeated a profile.');
    profiles.push(profile);
    return profile;
  }
  for (const choice of initial.data.transmissionChoices)
    if (choice.id !== initial.data.transmission?.id)
      await select(initial.data, 'initial', choice.id, initial.data.transmission?.id);
  for (const p of [...profiles])
    if (p.data.rearSeatOption && !p.data.rearSeatOption.selected)
      await select(p.data, p.key, '3UG');
  rows.push({ reference, detail, initial, profiles });
}
const retrievedAt = used
  .map((s) => s.capturedAt)
  .sort()
  .at(-1)!;
const snapshot = validatePorscheSnapshot({
  schemaVersion: 1,
  market: 'CA',
  currency: 'CAD',
  retrievedAt,
  overviewSource: overview.source,
  clients,
  models: rows,
});
try {
  const previous = validatePorscheSnapshot(JSON.parse(await readFile(target, 'utf8')));
  porscheNoRegression(previous, snapshot);
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
const serialized = await format(JSON.stringify(snapshot), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (serialized !== (await readFile(target, 'utf8')))
    throw new Error('Porsche exact offline reconstruction differs.');
  console.log('Porsche source checksums and exact offline reconstruction match.');
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
  await writeFile(
    `${folder}/capture-manifest.json`,
    JSON.stringify({ retrievedAt, sources: used }, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    models: models.length,
    initializers: rows.filter((r) => r.initial).length,
    factoryProfiles: rows.reduce((n, r) => n + r.profiles.length, 0),
    menuOnlyModels: rows.filter((r) => !r.initial).length,
    fullMarketCoverageVerified: false,
  }),
);
