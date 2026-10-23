import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import { genesisPublishedPrice, genesisRecordKey, genesisSpecsPage } from './genesis-import';
import type { GenesisRecord, GenesisSnapshot } from './genesis-import';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const genesisRecordId = (r: GenesisRecord) => `genesis-ca-${slug(genesisRecordKey(r))}`;
const priceId = (r: GenesisRecord) => `${genesisRecordId(r)}-pricing`,
  specId = (r: GenesisRecord) => `${genesisRecordId(r)}-specs`;
const plain = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
export function genesisFeatures(r: GenesisRecord) {
  return r.trim.trimKeyFeatures.map((f) => plain(f.enDescription)).join(' · ');
}
export function genesisFuel(r: GenesisRecord): Car['fuel'] {
  if (r.trim.isEv) return 'Electric';
  return /48\s*v|e[- ]supercharg|e[- ]sc\b|electric supercharger/i.test(
    `${r.trim.trimNameEn} ${genesisFeatures(r)}`,
  )
    ? 'Gasoline / hybrid'
    : 'Gasoline';
}
export function genesisFacts(r: GenesisRecord): Car['facts'] {
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((key) => [
      key,
      {
        value: null,
        source: null,
        note: 'Not verified for this exact Canadian model year, trim and factory HSC selection. Other years, motor/boost modes, measurement arrangements and unlabeled consumption units are not substituted.',
      } satisfies Fact,
    ]),
  ) as Car['facts'];
  facts.msrpCad = {
    value: null,
    source: priceId(r),
    note: r.trim.isPreOrder
      ? 'Preorder pricing is not published. Zero is not a vehicle price.'
      : 'The manufacturer labels its vehicle price all-inclusive. A price before bundled delivery/fees is not independently established. The regional published component total is shown separately and is not used as comparable base MSRP.',
  };
  if (r.trim.trimTaxes.some((t) => t.amount === null))
    facts.msrpCad.note +=
      ' A regional all-inclusive total is also unverified because itemized fee amounts are missing.';
  const set = (key: Metric, value: number | null, note: string, technical = true) => {
    const d = metricDefinitions[key];
    if (value !== null && value >= d.min && value <= d.max)
      facts[key] = { value, source: technical ? specId(r) : priceId(r), note };
  };
  const features = genesisFeatures(r),
    specs = r.specification?.rows;
  if (specs) {
    const values = new Map(specs.map((s) => [s.itemNm.trim(), s.itemTxt.trim()]));
    for (const [metric, label] of [
      ['lengthMm', 'Overall Length (mm)'],
      ['widthMm', 'Overall Width (mm)'],
      ['heightMm', 'Overall Height (mm)'],
    ] as const) {
      const raw = values.get(label),
        n = raw && /^\d[\d,]*(?:\.\d+)?$/.test(raw) ? Number(raw.replaceAll(',', '')) : null;
      set(
        metric,
        n,
        `Exact Canadian ${r.trim.modelYear}/${r.trim.extTrimId}: ${label}. ${metric === 'widthMm' ? 'The source does not establish a mirror convention. ' : ''}The table applies to the trim; individual upholstery/HSC measurements are not separately published.`,
      );
    }
    const power = values.get('Max. Power Output (hp/rpm) / (kW)') ?? '';
    const match = !r.trim.isEv ? /^(\d+(?:\.\d+)?)\s*@\s*[\d,]+\s*rpm$/i.exec(power) : null;
    const hp = match ? Number(match[1]) : null;
    set(
      'horsepower',
      hp,
      'Exact Canadian trim output in the published hp/rpm field. EV kW values, separate motor ratings and temporary boost outputs are not treated as normal combined hp.',
    );
    const seating = plain(values.get('Seating') ?? '');
    const seats = /(\d+)\s*[- ]passenger\s+seating/i.exec(seating);
    if (seats)
      set(
        'seats',
        Number(seats[1]),
        'Explicit passenger-seating count in the exact model-year/trim table. Additional factory seating arrangements require separate evidence.',
      );
    const cargo = values.get('Cargo volume (L)');
    if (cargo)
      for (const key of ['cargoSeatsUpL', 'cargoSeatsDownL'] as const)
        facts[key] = {
          value: null,
          source: specId(r),
          note: `The source publishes cargo volume ${cargo} L without a seats-up/down arrangement. It is not assigned to either comparison metric.`,
        };
    for (const key of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
      facts[key].note =
        'The published table labels consumption EPA/AWD without establishing Canadian L/100 km units and mode. These values are not copied into NRCan-style consumption fields.';
  }
  if (facts.horsepower.value === null && !r.trim.isEv) {
    const values = [
      ...new Set([...features.matchAll(/\b(\d{2,4})\s*hp\b/gi)].map((m) => Number(m[1]))),
    ];
    if (values.length === 1)
      set(
        'horsepower',
        values[0]!,
        `Exact Canadian ${r.trim.modelYear}/${r.trim.extTrimId} factory key feature explicitly publishes this hp output. No sibling or latest-year headline is substituted.`,
        false,
      );
  }
  if (facts.seats.value === null) {
    const seats = /(\d+)\s*[- ]passenger\s+seating/i.exec(features);
    if (seats)
      set(
        'seats',
        Number(seats[1]),
        'Explicit passenger-seating count in this exact factory trim’s key features.',
        false,
      );
  }
  return facts;
}
export function genesisReviewGaps(snapshot: GenesisSnapshot) {
  return snapshot.records.flatMap((r) => [
    ...Object.entries(genesisFacts(r))
      .filter(([, f]) => f.value === null)
      .map(([field, f]) => ({
        brand: 'Genesis',
        configuration: genesisRecordKey(r),
        field,
        reason: f.note!,
      })),
    ...(r.trim.trimTaxes.some((t) => t.amount === null)
      ? [
          {
            brand: 'Genesis',
            configuration: genesisRecordKey(r),
            field: 'regional-price-components',
            reason:
              'Itemized Alberta fee amounts are null. Missing fees are not treated as zero and no all-inclusive component total is displayed.',
          },
        ]
      : []),
    ...(r.specificationGap
      ? [
          {
            brand: 'Genesis',
            configuration: genesisRecordKey(r),
            field: 'specification-identity',
            reason: r.specificationGap,
          },
        ]
      : []),
    ...(r.colour && r.colour.exteriorPrice > 0
      ? [
          {
            brand: 'Genesis',
            configuration: genesisRecordKey(r),
            field: 'minimum-paint-charge',
            reason: `The current allowed palette for HSC ${r.colour.hsc} has a minimum exterior charge of ${r.colour.exteriorPrice} CAD, included in the displayed component total. A zero-paint headline is not substituted.`,
          },
        ]
      : []),
  ]);
}
export function addGenesisRetail(base: Catalog, snapshot: GenesisSnapshot): Catalog {
  const date = snapshot.retrievedAt.slice(0, 10),
    families = new Map(snapshot.families.map((f) => [f.model.modelGuid, f]));
  const sources: Source[] = [],
    cars: Car[] = [];
  for (const r of snapshot.records) {
    const id = genesisRecordId(r),
      t = r.trim,
      f = families.get(r.familyKey)!,
      price = genesisPublishedPrice(r),
      featureText = genesisFeatures(r),
      sourceIds = [priceId(r)],
      multiple = r.expectedHscs.length > 1;
    sources.push({
      id: priceId(r),
      title: `${t.modelYear} Genesis ${t.modelNameEn} ${t.trimNameEn} Canadian price and ordering identity`,
      publisher: 'Genesis Motors Canada',
      url: f.source.url,
      reviewedAt: date,
      publishedAt: null,
      locator: `Exact trim GUID ${t.guid}, external trim ${t.extTrimId}, model year ${t.modelYear}. Manufacturer all-inclusive vehicle amount, itemized Alberta fees and exact compatible palette charges remain separate from normalized base MSRP. Price source is the public factory selector; ${r.colour ? `palette/HSC ${r.colour.hsc}, ${r.colour.exteriorName}/${r.colour.interiorName}.` : 'preorder price is unpublished.'}`,
    });
    const colourId = `${id}-colours`;
    sourceIds.push(colourId);
    sources.push({
      id: colourId,
      title: `${t.modelYear} Genesis ${t.extTrimId} compatible factory HSC and colour charges`,
      publisher: 'Genesis Motors Canada',
      url: r.colourSource.url,
      reviewedAt: date,
      publishedAt: null,
      locator:
        'Each distinct mapped factory HSC remains represented. The displayed provincial component total uses an explicitly compatible minimum-charge exterior/interior pair for this HSC. Cosmetic alternatives sharing the same HSC are not separate retail trims.',
    });
    if (r.specification) {
      sourceIds.push(specId(r));
      sources.push({
        id: specId(r),
        title: `${t.modelYear} Genesis ${t.modelNameEn} ${t.trimNameEn} exact Canadian specifications`,
        publisher: 'Genesis Motors Canada',
        url: genesisSpecsPage,
        reviewedAt: date,
        publishedAt: null,
        locator: `Public Canadian specification selector ${r.specification.modelCode}, ${r.specification.label}. Every response row must retain the exact modelTrim and production model year. An older brochure attachment does not replace current-year rows; ambiguous power, cargo and EPA-mode values remain unknown.`,
      });
    }
    const transmission =
      /\b(\d+)[- ]speed automatic/i.exec(featureText)?.[0] ??
      (!t.isEv
        ? 'Automatic not independently specified'
        : 'Electric transmission not independently specified');
    const model = t.modelNameEn;
    cars.push({
      id,
      make: 'Genesis',
      model,
      trim: t.trimNameEn,
      year: t.modelYear,
      market: 'CA',
      bodyStyle:
        t.bodyTypeEn === 'Sedan' ? 'Sedan' : t.bodyTypeEn === 'SUV' ? 'SUV' : 'Not verified',
      fuel: genesisFuel(r),
      drivetrain: /All[- ]Wheel Drive|\bAWD\b/i.test(
        `${featureText} ${t.trimNameEn} ${r.specification?.label ?? ''}`,
      )
        ? 'AWD'
        : 'Not verified',
      recordKind: 'retail-trim',
      variant: multiple ? `${transmission} · ${r.colour!.interiorName}` : transmission,
      manufacturerConfiguration: {
        id: genesisRecordKey(r),
        code: `${t.extTrimId}/${r.colour?.hsc || 'preorder'}`,
        transmission,
        specificationsUrl: genesisSpecsPage,
      },
      ...(price === null
        ? {}
        : {
            publishedPrice: {
              value: price,
              currency: 'CAD' as const,
              basis: 'all-inclusive-before-sales-tax' as const,
              province: 'AB' as const,
              source: priceId(r),
              note: `Published vehicle amount plus itemized Alberta fees and compatible ${r.colour!.exteriorName}/${r.colour!.interiorName} charges. Sales tax, registration, insurance and additional products are excluded; incentives are not deducted. This regional amount is separate from base MSRP.`,
            },
          }),
      availability: {
        status: t.isPreOrder ? 'announced' : 'manufacturer-listed',
        checkedAt: date,
        source: priceId(r),
        note: t.isPreOrder
          ? 'The Canadian factory selector marks this model as preorder with no published vehicle price. Delivery and final configuration remain unverified.'
          : 'This exact model year/trim and compatible factory HSC appear in the Canadian build-and-order selector. Dealer inventory, delivery and additional optional selections remain unverified.',
      },
      sourceIds,
      facts: genesisFacts(r),
    });
  }
  return validateCatalog({
    ...base,
    reviewedAt: date > base.reviewedAt ? date : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
