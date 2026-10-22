import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import {
  gmCaptureManifestSchema,
  gmReferences,
  gmReferenceKey,
  gmMatrixUrl,
  gmMatrix,
  gmOptionKey,
  gmClientUrl,
  gmModelIdentity,
  gmSpecsUrl,
  gmDefaultUrl,
  gmRetrieveUrl,
  gmConfiguration,
  gmMsrp,
  gmPostalCode,
  validateGmSnapshot,
} from '../packages/car-catalog/src/gm-import.ts';
import type { GmReference, GmSnapshot, GmRecord } from '../packages/car-catalog/src/gm-import.ts';

const directory = 'data/raw/gm',
  target = 'packages/car-catalog/data/manufacturers/gm.json';
const offline = process.argv.includes('--offline'),
  argument = process.argv.indexOf('--from-captures');
if (!offline && argument < 0)
  throw new Error(
    'GM import requires a reviewed capture manifest: --from-captures <manifest.json>. Public calculators currently reject some requests; partial/fresh captures must not be mislabeled as a complete live refresh.',
  );
const manifestPath =
  argument >= 0 ? process.argv[argument + 1]! : `${directory}/capture-manifest.json`;
const manifest = gmCaptureManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
async function capture(url: string, requestSha256: string | null = null) {
  const source = manifest.sources.find(
    (source) => source.url === url && source.requestSha256 === requestSha256,
  );
  if (!source) return null;
  const bytes = await readFile(`${directory}/${source.sha256}`);
  if (hash(bytes) !== source.sha256) throw new Error(`GM source checksum mismatch: ${url}`);
  return { source, text: bytes.toString('utf8') };
}
const references = new Map<string, GmReference>(),
  hidden = new Map<string, GmReference>();
const snapshot: GmSnapshot = {
  schemaVersion: 1,
  retrievedAt: manifest.retrievedAt,
  postalCode: gmPostalCode,
  lineupSources: [],
  expectedModelKeys: [],
  hiddenReferencesNeedingReview: [],
  models: [],
  records: [],
};
for (const page of manifest.lineupPages) {
  const source = await capture(page.url);
  if (!source) throw new Error('A required GM lineup source is absent.');
  const parsed = gmReferences(source.text, page.brand);
  for (const model of parsed.models) references.set(gmReferenceKey(model), model);
  for (const model of parsed.hidden) hidden.set(gmReferenceKey(model), model);
  snapshot.lineupSources.push(source.source);
}
snapshot.expectedModelKeys = [...references.keys()].sort();
snapshot.hiddenReferencesNeedingReview = [...hidden]
  .filter(([key]) => !references.has(key))
  .map(([, model]) => model);
for (const [key, reference] of [...references].sort(([a], [b]) => a.localeCompare(b))) {
  const matrixPage = await capture(gmMatrixUrl(reference));
  if (!matrixPage) throw new Error(`Missing required GM trim matrix: ${key}`);
  const matrix = gmMatrix(JSON.parse(matrixPage.text)),
    identityPage = await capture(gmClientUrl(reference)),
    specsPage = await capture(gmSpecsUrl(reference));
  const identity = identityPage ? gmModelIdentity(identityPage.text, reference) : null;
  const excluded = /^(express|savana)-cargo$/.test(reference.bodyStyle);
  const model: GmSnapshot['models'][number] = {
    reference,
    key,
    displayName:
      identity?.bodyStyleTitle ??
      reference.bodyStyle.replace(/[-_]/g, ' ').replace(/\b[a-z]/g, (value) => value.toUpperCase()),
    electric:
      Boolean(identity?.evMode) || matrix.options.every((option) => option.engine === 'EN0'),
    expectedKeys: matrix.options.map(gmOptionKey),
    source: matrixPage.source,
    excludedReason: excluded
      ? 'The official selector identifies this body style as Cargo, separately from its Passenger counterpart. Cargo-only Express/Savana bodies are outside the passenger scope; pickups and Passenger vans remain included.'
      : null,
    identitySource: identityPage?.source ?? null,
    specificationsSource: specsPage?.source ?? null,
  };
  snapshot.models.push(model);
  if (excluded) continue;
  let verified = 0;
  for (const option of matrix.options) {
    const request = JSON.stringify({
        style: `en/CA/${key}/${option.styleId}`,
        ss: option.ss,
        postalCode: gmPostalCode,
      }),
      requestSha256 = hash(request);
    let configPage = await capture(gmRetrieveUrl(reference.brand), requestSha256),
      gap: string | null = null;
    if (!configPage) configPage = await capture(gmDefaultUrl(reference, option.styleId));
    let configuration: GmRecord['configuration'] = null;
    if (configPage) {
      try {
        const raw = JSON.parse(configPage.text),
          checked = gmConfiguration(raw, option),
          price = gmMsrp(raw, option);
        configuration = {
          source: configPage.source,
          ss: checked.data.config.ss,
          selectedCodes: checked.data.config.selected,
          msrpCad: price.value,
          priceNote: price.reason,
          bodyStyleTitle: checked.selected.vehicleInfo.bodyStyleTitle,
          orderAvailabilityType: checked.selected.vehicleInfo.orderAvailabilityType,
          attributes: checked.data.config.summary.keyAttributes,
        };
        verified++;
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes('differs from the requested factory matrix identity')
        )
          throw error;
        gap =
          'The captured default style calculation returns a different engine/transmission/axle/battery/propulsion identity. It is not substituted for this exact matrix configuration.';
      }
    }
    if (!configuration && !gap)
      gap =
        manifest.calculationFailures.find((failure) => failure.requestSha256 === requestSha256)
          ?.reason ??
        'No exact configuration calculation was captured. Matrix display prices include charges and cannot be substituted for base MSRP.';
    const trim = matrix.trims.find((trim) => trim.styleId === option.styleId)!;
    snapshot.records.push({
      modelKey: key,
      option,
      engineDescription:
        matrix.engines.find((engine) => engine.id === option.engine)?.description ?? null,
      transmissionDescription:
        matrix.transmissions.find((transmission) => transmission.id === option.transmission)
          ?.description ?? null,
      axleDescription:
        matrix.axleRatios.find((axle) => axle.id === option.axleRatio)?.description ?? null,
      batteryDescription:
        matrix.batteries.find((battery) => battery.id === option.battery)?.description ?? null,
      propulsionDescription:
        matrix.propulsions.find((propulsion) => propulsion.id === option.propulsion)?.description ??
        null,
      bodyDescription:
        matrix.bodyTypes.find((body) => body.id === option.bodyTypeId)?.description ?? null,
      lateAvailabilityNote: trim.lateAvailabilityDisclaimer,
      configuration,
      configurationGap: gap,
    });
  }
  console.log(
    `${key}: ${matrix.options.length} matrix configurations; ${verified} exact calculator responses.`,
  );
}
snapshot.models.sort((a, b) => a.key.localeCompare(b.key));
snapshot.records.sort((a, b) =>
  `${a.modelKey}/${gmOptionKey(a.option)}`.localeCompare(`${b.modelKey}/${gmOptionKey(b.option)}`),
);
const valid = validateGmSnapshot(snapshot),
  output = await format(JSON.stringify(valid), {
    ...(await resolveConfig(target)),
    filepath: target,
  });
if (offline) {
  if (output !== (await readFile(target, 'utf8')))
    throw new Error('GM offline reconstruction differs from the tracked snapshot.');
  console.log(
    `Verified original hashes/date for ${valid.records.length} passenger configurations.`,
  );
} else {
  await mkdir('packages/car-catalog/data/manufacturers', { recursive: true });
  await writeFile(`${target}.tmp`, output);
  await rename(`${target}.tmp`, target);
  console.log(
    `Saved ${valid.records.length} GM passenger matrix configurations; ${valid.records.filter((record) => record.configuration?.msrpCad !== null && record.configuration !== null).length} verified MSRP values. Source/calculator gaps remain explicit.`,
  );
}
