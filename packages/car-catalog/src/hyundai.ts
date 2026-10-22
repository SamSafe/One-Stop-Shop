import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Source } from './schema';
import { hyundaiBuildPage, hyundaiTrimsUrl } from './hyundai-import';
import type { HyundaiRecord, HyundaiSnapshot } from './hyundai-import';

const sourceId = (modelSlug: string) => `hyundai-ca-${modelSlug}-factory-configurations`;
const clean = (value: string) =>
  value
    .replace(/[‐‑–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
export function hyundaiFuel(record: HyundaiRecord): Car['fuel'] {
  const identity = `${record.modelName} ${record.trimName} ${record.selectedOptions.map((option) => option.name).join(' ')} ${record.features
    .filter((feature) => /engine|motor/i.test(feature.name))
    .map((feature) => feature.name)
    .join(' ')}`;
  if (/plug.?in|\bPHEV\b/i.test(identity)) return 'Plug-in hybrid';
  if (/\bHEV\b|hybrid/i.test(identity)) return 'Hybrid';
  if (/IONIQ|KONA Electric/i.test(record.modelName)) return 'Electric';
  return 'Gasoline';
}
export function hyundaiDrive(record: HyundaiRecord): Car['drivetrain'] {
  const identity = clean(
    `${record.trimName} ${record.features
      .filter((feature) => /Performance/i.test(feature.section))
      .map((feature) => feature.name)
      .join(' ')}`,
  );
  const values = [
    /\bAWD\b|all[ -]?wheel drive/i.test(identity) ? 'AWD' : null,
    /\bFWD\b|front[ -]?wheel drive/i.test(identity) ? 'FWD' : null,
    /\bRWD\b|rear[ -]?wheel drive/i.test(identity) ? 'RWD' : null,
  ].filter((value): value is 'AWD' | 'FWD' | 'RWD' => value !== null);
  return values.length === 1 ? values[0]! : 'Not verified';
}
export function hyundaiTransmission(record: HyundaiRecord) {
  const matches = record.features.filter(
    (feature) =>
      /Performance/i.test(feature.section) && /transmission|reduction gear/i.test(feature.name),
  );
  return matches.length === 1 ? clean(matches[0]!.name).slice(0, 100) : 'Not verified';
}
export function hyundaiFacts(record: HyundaiRecord): Car['facts'] {
  const unknown = (): Fact => ({
    value: null,
    source: null,
    note: 'Not yet verified for this exact Canadian trim. The model specification table requires source and trim-column reconciliation; optional powertrains and shared columns are not assumed to match.',
  });
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((metric) => [metric, unknown()]),
  ) as Car['facts'];
  facts.msrpCad = {
    value: record.msrpCad,
    source: sourceId(record.modelSlug),
    sourceUrl: record.priceSource.url,
    note: `Exact Canadian trim calculator msrp for ${record.trimId}, with includeDestination=false. Includes this trim's factory package once. Excludes delivery/destination, taxes, levies, dealer fees, paint, accessories, incentives and financing charges. AB/English request; not a dealer quote.${record.optionEstimateCad !== record.msrpCad ? ` The parent option arithmetic gives $${record.optionEstimateCad}; this source conflict needs review. The exact-trim MSRP field is used.` : ''}`,
  };
  const seating = record.features.flatMap((feature) => {
    const value = /^(\d{1,2})[ -]*passenger (?:capacity|seating)\b/i.exec(clean(feature.name))?.[1];
    return value ? [{ value: Number(value), feature }] : [];
  });
  const namedSeats = /\b(\d{1,2})-Passenger\b/i.exec(record.trimName)?.[1];
  const seats = [
    ...new Set([
      ...seating.map((entry) => entry.value),
      ...(namedSeats ? [Number(namedSeats)] : []),
    ]),
  ];
  if (seats.length === 1 && seats[0]! >= 2 && seats[0]! <= 15)
    facts.seats = {
      value: seats[0]!,
      source: sourceId(record.modelSlug),
      sourceUrl: seating.length ? record.featuresSource.url : hyundaiTrimsUrl(record.modelId),
      note: seating.length
        ? `Exact-trim ${seating[0]!.feature.section}: ${clean(seating[0]!.feature.name)}. Optional seating variants remain separate factory trim IDs.`
        : `The manufacturer's exact factory trim name explicitly specifies ${record.trimName}. Detailed seating rows are not yet verified.`,
    };
  else if (seats.length > 1)
    facts.seats.note =
      'Conflicting seating evidence in the exact factory trim name and feature response requires source review.';
  if (hyundaiFuel(record) === 'Electric')
    for (const metric of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
      facts[metric].note =
        'Not applicable to battery-electric propulsion. Gasoline-equivalent consumption is not liquid fuel used. Exact-trim electric consumption remains unverified.';
  return facts;
}
export function addHyundaiRetail(base: Catalog, snapshot: HyundaiSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10);
  const sources: Source[] = snapshot.models.map((model) => ({
    id: sourceId(model.slug),
    title: `${model.year} ${model.name} Canadian factory trims, packages and MSRP`,
    publisher: 'Hyundai Auto Canada',
    url: `${hyundaiBuildPage}?modelId=${model.id}`,
    reviewedAt,
    publishedAt: null,
    locator:
      'Public Canadian build tool: model/year → parent trims → every subTrims factory ID. Exact trimallpurchaseOptions.msrp excludes separately stated delivery and fees. getAllTrimFeatures is requested with the same trim ID and its name is verified. Checksummed responses retain source discrepancies; model-level specification columns are not guessed.',
  }));
  const cars: Car[] = snapshot.records.map((record) => {
    const transmission = hyundaiTransmission(record),
      engine = record.features.find(
        (feature) =>
          /Performance/i.test(feature.section) && /engine|electric motor/i.test(feature.name),
      );
    return {
      id: `hyundai-ca-${record.trimId}`,
      make: 'Hyundai',
      model: record.modelName,
      year: record.year,
      trim: record.trimName,
      variant:
        [engine?.name, transmission === 'Not verified' ? '' : transmission]
          .filter(Boolean)
          .map((value) => clean(value!))
          .join(' · ')
          .slice(0, 200) || undefined,
      market: 'CA',
      bodyStyle: /elantra|sonata/i.test(record.modelName)
        ? 'Sedan'
        : /venue|kona|tucson|santa fe|palisade|ioniq [59]/i.test(record.modelName)
          ? 'SUV'
          : 'Not verified',
      fuel: hyundaiFuel(record),
      drivetrain: hyundaiDrive(record),
      recordKind: 'retail-trim',
      manufacturerConfiguration: {
        id: record.trimId,
        code: record.trimId,
        transmission,
        specificationsUrl: record.featuresSource.url,
      },
      availability: {
        status: record.soldOut ? 'not-checked' : 'manufacturer-listed',
        checkedAt: reviewedAt,
        source: sourceId(record.modelSlug),
        note: record.soldOut
          ? 'Listed in the current Canadian build tool but the parent trim is flagged sold out. Remaining new dealer inventory requires review.'
          : 'Listed in the current Canadian build tool with an exact factory trim/package ID. Dealer stock, delivery dates and older new inventory require confirmation.',
      },
      sourceIds: [sourceId(record.modelSlug)],
      facts: hyundaiFacts(record),
    };
  });
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
