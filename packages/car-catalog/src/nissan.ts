import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import { nissanBuildUrl, nissanKey } from './nissan-import';
import type { NissanRecord, NissanSnapshot } from './nissan-import';

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const sourceId = (record: { brand: string; year: number; modelCode: string }) =>
  `${slug(record.brand)}-ca-${record.year}-${record.modelCode}-factory-versions`;
const specId = (record: NissanRecord) => `${sourceId(record)}-specs`;
export const nissanRecordId = (record: NissanRecord) =>
  `${slug(record.brand)}-ca-${record.year}-${record.modelCode}-${slug(record.versionCode)}${record.optionPackage ? `-${slug(record.optionPackage.key)}` : ''}`;
const clean = (value: string) =>
  value
    .replace(/\[\[.*?\]\]/g, '')
    .replace(/[®™]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const normalized = (value: string) => clean(value).toLowerCase().replace(/[–—−]/g, '-');
export function nissanNumber(value: string): number | null {
  const text = value.trim();
  return /^\d+(?:,\d{3})*(?:\.\d+)?$/.test(text) ? Number(text.replace(/,/g, '')) : null;
}
export function nissanMeasurement(value: string, unit: string): number | null {
  const metric = normalized(unit),
    text = value.trim();
  if (/mm.*(?:inches|inch|\bin\b)|\bl\b.*cu\.\s*ft/.test(metric)) {
    const pair = /^([\d,.]+)\s*\(\s*([\d,.]+)\s*\)$/.exec(text);
    if (!pair) return null;
    const si = nissanNumber(pair[1]!),
      imperial = nissanNumber(pair[2]!);
    if (si === null || imperial === null) return null;
    const expected = imperial * (metric.includes('mm') ? 25.4 : 28.316846592);
    return Math.abs(si - expected) <= 2 ? si : null;
  }
  return nissanNumber(text);
}
export function nissanMsrp(record: NissanRecord): { value: number | null; note: string } {
  const disclaimer = clean(record.retailPrice.disclaimer);
  if (
    !/Manufacturer.s Suggested Retail Price \(MSRP\).*following amounts must be added/i.test(
      disclaimer,
    ) ||
    /price shown includes.*freight/i.test(disclaimer)
  )
    return {
      value: null,
      note: `The selector's retail field is ${record.retailPrice.value} CAD, but its disclaimer says the shown price includes freight/PDI and charges. The separate regional amount differs. Base MSRP needs independent reconciliation; no fee-inclusive or ambiguous amount is substituted.${record.optionPackage ? ` The exact-trim ${record.optionPackage.name} surcharge is ${record.optionPackage.price} CAD; the base remains unverified.` : ''}`,
    };
  const surcharge = record.optionPackage ? nissanNumber(record.optionPackage.price) : 0;
  if (surcharge === null)
    return { value: null, note: 'The exact factory equipment surcharge is not verified.' };
  return {
    value: record.retailPrice.value + surcharge,
    note: `Exact Canadian model/version ${nissanKey(record)}, priceList.retail.value${record.optionPackage ? ` plus ${record.optionPackage.name} (${surcharge} CAD)` : ''}. The source explicitly identifies MSRP and states freight/PDI, levies, dealer charges and optional products/accessories are additional. No regional all-in price, paint, accessory, incentive or tax is included. Confirm current pricing with the retailer.`,
  };
}
const drive = (value: string): Car['drivetrain'] | null => {
  const text = value.toUpperCase();
  if (/\bAWD\b|ALL.WHEEL.DRIVE/.test(text)) return 'AWD';
  if (/\b4WD\b|4X4|FOUR.WHEEL.DRIVE/.test(text)) return '4WD';
  if (/\bFWD\b|FRONT.WHEEL.DRIVE/.test(text)) return 'FWD';
  if (/\bRWD\b|REAR.WHEEL.DRIVE/.test(text)) return 'RWD';
  return null;
};
export function nissanDrive(record: NissanRecord): Car['drivetrain'] {
  // Exact technical terminology takes precedence over broad AWD marketing filters (e.g. QX80 4WD).
  return (
    (record.specification && drive(record.specification.driveTrainValue)) ||
    record.filterTags
      .filter((tag) => tag.startsWith('driveTrain:'))
      .map(drive)
      .find((value) => value !== null) ||
    drive(record.displayName) ||
    'Not verified'
  );
}
export function nissanFuel(
  record: NissanRecord,
  model: NissanSnapshot['models'][number],
): Car['fuel'] {
  if (
    /plug.in.hybrid/i.test(record.modelName) ||
    record.filterTags.includes('engineSize:plug-in-hybrid')
  )
    return 'Plug-in hybrid';
  if (/\bhybrid\b/i.test(record.modelName)) return 'Hybrid';
  if (model.electric || record.filterTags.includes('fuelType:electric')) return 'Electric';
  return 'Gasoline';
}
export function nissanTransmission(record: NissanRecord) {
  const named = /\b(\dMT|\dAT|CVT)\b/i.exec(record.versionName)?.[1];
  if (named) return named.toUpperCase();
  const labels =
    record.specification?.fields
      .filter(
        (field) =>
          /transmission|\bCVT\b/i.test(field.value) &&
          /\d.speed (?:automatic|manual)|continuously variable/i.test(field.value),
      )
      .map((field) => clean(field.value)) ?? [];
  return [...new Set(labels)].length === 1 ? labels[0]!.slice(0, 100) : 'Not verified';
}
export function nissanFacts(
  record: NissanRecord,
  model: NissanSnapshot['models'][number],
): Car['facts'] {
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((key) => [
      key,
      {
        value: null,
        source: null,
        note: 'Not published or not yet verified for this exact Canadian version/package. Ambiguous units, alternative arrangements and other model years remain unknown.',
      } satisfies Fact,
    ]),
  ) as Car['facts'];
  const price = nissanMsrp(record);
  facts.msrpCad = {
    value: price.value,
    source: sourceId(record),
    sourceUrl: nissanBuildUrl(record.brand),
    note: price.note,
  };
  if (record.seatingCapacity !== null)
    facts.seats = {
      value: record.seatingCapacity,
      source: sourceId(record),
      sourceUrl: nissanBuildUrl(record.brand),
      note: `Exact ${nissanKey(record)} selector seatingCapacity. Optional seating arrangements require their own configuration.`,
    };
  const spec = record.specification,
    fuel = nissanFuel(record, model);
  function assign(metric: Metric, candidates: { value: number | null; text: string }[], note = '') {
    if (!candidates.length) return;
    const values = [...new Set(candidates.map((candidate) => candidate.value))],
      def = metricDefinitions[metric];
    const value =
      values.length === 1 && values[0] !== null && values[0]! >= def.min && values[0]! <= def.max
        ? values[0]!
        : null;
    facts[metric] = {
      value,
      source: specId(record),
      sourceUrl: spec!.source.url,
      note: `${nissanKey(record)}: ${candidates.map((candidate) => candidate.text).join('; ')}. ${value === null ? 'Source alternatives, inconsistent dual units, out-of-range values or missing unit pairs require review. ' : ''}${note}`.slice(
        0,
        1000,
      ),
    };
  }
  if (spec) {
    const fields = spec.fields.filter(
      (field) =>
        field.specType === 'technical' && !/^\s*(?:N\/A|not applicable|-)?\s*$/i.test(field.value),
    );
    function measurements(metric: Metric, pattern: RegExp, note = '') {
      assign(
        metric,
        fields
          .filter((field) => pattern.test(normalized(field.unit)))
          .map((field) => ({
            value: nissanMeasurement(field.value, field.unit),
            text: `${clean(field.unit)}: ${field.value}`,
          })),
        note,
      );
    }
    measurements('seats', /^seating capacity$/);
    measurements(
      'lengthMm',
      /^(?:exterior - )?overall length.*mm/,
      'License-plate bracket alternatives remain unresolved.',
    );
    measurements(
      'widthMm',
      /^(?:exterior - )?overall width.*mm/,
      'Published width; check the manufacturer mirror convention. Open/folded alternatives are not arbitrarily selected.',
    );
    measurements(
      'heightMm',
      /^(?:exterior - )?overall height.*mm/,
      'Suspension-height alternatives remain unresolved.',
    );
    measurements(
      'frontHeadroomMm',
      /(?:^front headroom.*mm|^head\s*room.*\(front\).*mm|^interior - head room.*mm.*1st row)/,
    );
    measurements(
      'rearHeadroomMm',
      /(?:^rear headroom.*mm|^head\s*room.*\(rear\).*mm|^headroom.*2nd row.*mm|^interior - head room.*mm.*2nd row)/,
    );
    measurements(
      'frontLegroomMm',
      /(?:^leg room.*(?:\(front\)|front).*mm|^interior - leg room.*mm.*1st row)/,
    );
    measurements(
      'rearLegroomMm',
      /(?:^leg room.*(?:\(rear\)|rear|2nd row).*mm|^interior - leg room.*mm.*2nd row)/,
    );
    const third = (facts.seats.value ?? 0) >= 6;
    const cargo = fields.filter(
      (field) =>
        /^cargo (?:capacity|volume)/.test(normalized(field.unit)) &&
        /\bl\b/.test(normalized(field.unit)),
    );
    assign(
      'cargoSeatsUpL',
      cargo
        .filter((field) =>
          third
            ? /3rd row (?:upright|up)/.test(normalized(field.unit))
            : /upright|seats up/.test(normalized(field.unit)),
        )
        .map((field) => ({
          value: nissanMeasurement(field.value, field.unit),
          text: `${clean(field.unit)}: ${field.value}`,
        })),
      'All seating rows upright. Volume standards differ by manufacturer.',
    );
    assign(
      'cargoSeatsDownL',
      cargo
        .filter((field) =>
          third
            ? /2nd.*3rd.*(?:folded|down)/.test(normalized(field.unit))
            : /(?:rear seats|2nd.row).*?(?:down|folded)/.test(normalized(field.unit)),
        )
        .map((field) => ({
          value: nissanMeasurement(field.value, field.unit),
          text: `${clean(field.unit)}: ${field.value}`,
        })),
      'Published volume behind the front row. Confirm practical loading arrangements.',
    );
    if (
      facts.cargoSeatsUpL.value === null &&
      !facts.cargoSeatsUpL.source &&
      cargo.some((field) => !/upright|folded|down|seats up/.test(normalized(field.unit)))
    )
      assign(
        'cargoSeatsUpL',
        cargo
          .filter((field) => !/upright|folded|down|seats up/.test(normalized(field.unit)))
          .map((field) => ({ value: null, text: `${clean(field.unit)}: ${field.value}` })),
        'The published cargo label does not establish the seating arrangement. A generic cargo volume is not substituted for all seats upright.',
      );
    const power = [
      spec.engineName,
      ...spec.fields.filter((field) => field.specType !== 'technical').map((field) => field.value),
    ]
      .filter((value) => !/up to|available|maximum|optional/i.test(value))
      .flatMap((value) =>
        [...value.matchAll(/\b(\d{2,4}(?:\.\d+)?)\s*hp\b/gi)].map((match) => ({
          value: Number(match[1]),
          text: clean(value),
        })),
      );
    assign(
      'horsepower',
      power,
      'Manufacturer engine or combined-system basis is preserved as written; engine and motor power are not added.',
    );
    if (fuel === 'Electric') {
      measurements(
        'electricRangeKm',
        /^range \(km\)/,
        'Manufacturer estimated range; actual range varies.',
      );
      measurements(
        'electricModeLe100km',
        /^combined le\/100\s*km/,
        'Gasoline-equivalent energy, not liquid fuel consumed and not kWh consumption.',
      );
      assign(
        'rechargeHours',
        fields
          .filter((field) => /^charging time level 2.*240v/.test(normalized(field.unit)))
          .map((field) => ({
            value: /^\s*\d+(?:\.\d+)?\s*hrs?\s*$/.test(field.value)
              ? Number.parseFloat(field.value)
              : null,
            text: `${clean(field.unit)}: ${field.value}`,
          })),
        'Level 2 240 V time and published charging window. Actual equipment and conditions vary.',
      );
    }
  }
  if (!['Electric', 'Plug-in hybrid'].includes(fuel)) {
    const selected = Object.fromEntries(
      (['city', 'highway', 'combined'] as const).map((mode) => {
        const exact =
          spec?.fields.filter(
            (field) =>
              field.specType === 'technical' &&
              new RegExp(`^${mode}.*l/100\\s*km`, 'i').test(normalized(field.unit)) &&
              !/le\/100/i.test(field.unit),
          ) ?? [];
        const fallback = record.gradeFuelConsumption?.[mode];
        return [
          mode,
          exact.length
            ? exact.map((field) => ({
                value: nissanNumber(field.value),
                label: field.unit,
                raw: field.value,
                exact: true,
              }))
            : fallback && /l\/100\s*km/i.test(fallback.label) && !/le\/100/i.test(fallback.label)
              ? [
                  {
                    value: nissanNumber(fallback.value),
                    label: fallback.label,
                    raw: fallback.value,
                    exact: false,
                  },
                ]
              : [],
        ];
      }),
    ) as Record<
      'city' | 'highway' | 'combined',
      { value: number | null; label: string; raw: string; exact: boolean }[]
    >;
    const unique = (mode: keyof typeof selected) =>
      selected[mode].length === 1 ? selected[mode][0]!.value : null;
    const city = unique('city'),
      highway = unique('highway'),
      combined = unique('combined');
    const conflict =
      city !== null &&
      highway !== null &&
      combined !== null &&
      (combined < Math.min(city, highway) - 0.1 || combined > Math.max(city, highway) + 0.1);
    for (const [metric, mode] of [
      ['fuelCityL100km', 'city'],
      ['fuelHighwayL100km', 'highway'],
      ['fuelCombinedL100km', 'combined'],
    ] as const) {
      const values = selected[mode];
      if (!values.length) continue;
      const datum = values[0]!,
        value = unique(mode);
      facts[metric] = {
        value: !conflict && value !== null && value >= 1 && value <= 50 ? value : null,
        source: datum.exact ? specId(record) : sourceId(record),
        sourceUrl: datum.exact ? spec!.source.url : nissanBuildUrl(record.brand),
        note: `${nissanKey(record)} ${clean(datum.label)}: ${datum.raw}. ${conflict ? 'Source conflict: combined consumption falls outside the published city/highway interval. All three values require reconciliation.' : 'Exact-version technical field or matching grade code, explicitly labelled L/100 km. Actual consumption varies.'}`,
      };
    }
  } else
    for (const metric of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
      facts[metric].note =
        fuel === 'Electric'
          ? 'Not applicable to battery-electric propulsion. Le/100km is energy equivalence, not liquid fuel consumed.'
          : 'Plug-in operating-mode split needs verification. Published generic fuel fields are not substituted for fuel-only, blended or electric modes.';
  return facts;
}
export function nissanReviewGaps(snapshot: NissanSnapshot) {
  return snapshot.records.flatMap((record) => {
    const model = snapshot.models.find(
        (model) => model.brand === record.brand && model.code === record.modelCode,
      )!,
      facts = nissanFacts(record, model);
    return [
      ...(record.specificationGap
        ? [
            {
              configuration: nissanKey(record),
              field: 'specifications',
              reason: record.specificationGap,
            },
          ]
        : []),
      ...Object.entries(facts)
        .filter(([, fact]) => fact.value === null && fact.source)
        .map(([field, fact]) => ({ configuration: nissanKey(record), field, reason: fact.note! })),
    ];
  });
}
export function addNissanRetail(base: Catalog, snapshot: NissanSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10),
    sources: Source[] = [];
  const cars: Car[] = [];
  for (const model of snapshot.models) {
    const records = snapshot.records.filter(
        (record) => record.brand === model.brand && record.modelCode === model.code,
      ),
      identity = { brand: model.brand, year: model.year, modelCode: model.code };
    sources.push({
      id: sourceId(identity),
      title: `${model.year} ${model.brand} ${model.name} Canadian factory versions and prices`,
      publisher: `${model.brand} Canada`,
      url: nissanBuildUrl(model.brand),
      reviewedAt,
      publishedAt: null,
      locator: `Public build selector selectPageProps.vehicleData, Canadian/en/configurator market; model ${model.code}. Version, grade, EIM, package and NST codes are preserved; all current and previous-year references reconcile. Retail and regional prices remain distinct. Checksummed source captures retained for reconstruction.`,
    });
    if (records.some((record) => record.specification))
      sources.push({
        id: `${sourceId(identity)}-specs`,
        title: `${model.year} ${model.brand} ${model.name} Canadian exact-version specifications`,
        publisher: `${model.brand} Canada`,
        url: model.specificationsReview.source.url,
        reviewedAt,
        publishedAt: null,
        locator: `HELIOS.components.c059E grades/versions, exact model ${model.code}, year, grade and versionKey join. Only matching en_CA paths are accepted. Explicit optional equipment packages are separate configurations. Alternatives, inconsistent units and superseded years require review.`,
      });
    for (const record of records) {
      const label = record.displayName.startsWith(`${record.modelName} `)
        ? record.displayName.slice(record.modelName.length + 1)
        : record.displayName;
      const body: Car['bodyStyle'] = model.vehicleTypes.includes('trucks')
        ? 'Pickup'
        : model.vehicleTypes.includes('crossovers-suvs')
          ? 'SUV'
          : model.vehicleTypes.includes('cars')
            ? 'Sedan'
            : 'Not verified';
      cars.push({
        id: nissanRecordId(record),
        make: record.brand,
        model: record.modelName,
        year: record.year,
        trim: label,
        variant: record.optionPackage?.name,
        market: 'CA',
        bodyStyle: body,
        fuel: nissanFuel(record, model),
        drivetrain: nissanDrive(record),
        recordKind: 'retail-trim',
        manufacturerConfiguration: {
          id: nissanKey(record),
          code: `${record.versionCode}${record.optionPackage ? `/${record.optionPackage.key}` : ''}`,
          transmission: nissanTransmission(record),
          specificationsUrl: record.specification?.source.url ?? nissanBuildUrl(record.brand),
        },
        availability: {
          status: 'manufacturer-listed',
          checkedAt: reviewedAt,
          source: sourceId(record),
          note: 'Listed in the current Canadian build selector or explicitly offered as an exact-version equipment package on its official specifications page. Both listed model years remain included. Dealer stock, delivery dates and older new inventory require confirmation.',
        },
        sourceIds: [sourceId(record), ...(record.specification ? [specId(record)] : [])],
        facts: nissanFacts(record, model),
      });
    }
  }
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
