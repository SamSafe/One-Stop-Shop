import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import { gmBrands, gmClientUrl, gmOptionKey } from './gm-import';
import type { GmRecord, GmSnapshot } from './gm-import';

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const sourceId = (model: GmSnapshot['models'][number]) =>
  `gm-ca-${slug(model.key)}-factory-configurations`;
export const gmRecordId = (record: GmRecord) =>
  `gm-ca-${slug(`${record.modelKey.split('/')[0]}-${record.modelKey.split('/')[2]}-${gmOptionKey(record.option)}`)}`;
const clean = (value: string) =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
export function gmFuel(record: GmRecord, model: GmSnapshot['models'][number]): Car['fuel'] {
  if (record.option.engine === 'EN0' || model.electric) return 'Electric';
  if (/corvette-(?:eray|zr1x)$/.test(model.reference.bodyStyle)) return 'Hybrid';
  if (/diesel|duramax/i.test(record.engineDescription ?? '')) return 'Diesel';
  return 'Gasoline';
}
export function gmDrive(record: GmRecord): Car['drivetrain'] {
  const code = record.option.driveType;
  if (['FWD', 'RWD', 'AWD', '4WD'].includes(code)) return code as Car['drivetrain'];
  const exact = record.configuration?.attributes.find(
    (attribute) => attribute.key === 'drive.type',
  )?.value;
  return exact && ['FWD', 'RWD', 'AWD', '4WD'].includes(exact)
    ? (exact as Car['drivetrain'])
    : 'Not verified';
}
export function gmFacts(record: GmRecord, model: GmSnapshot['models'][number]): Car['facts'] {
  const unknown = (): Fact => ({
    value: null,
    source: null,
    note: 'Not yet verified for this exact Canadian style/engine/transmission/axle/battery/propulsion combination. Default or sibling specifications are not substituted.',
  });
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((metric) => [metric, unknown()]),
  ) as Car['facts'];
  const configuration = record.configuration,
    sourceUrl = configuration
      ? `${gmClientUrl(model.reference).replace(/\/trims$/, '/config')}?styleId=${record.option.styleId}&ss=${encodeURIComponent(configuration.ss)}&postalCode=${gmPostal}`
      : gmClientUrl(model.reference);
  facts.msrpCad = {
    value: configuration?.msrpCad ?? null,
    source: sourceId(model),
    sourceUrl,
    note: configuration
      ? `Factory ${gmOptionKey(record.option)}: ${configuration.priceNote} Factory subtotal/component reconciliation precedes display; fee-inclusive trim-matrix prices are not base MSRP. Confirm current pricing with the retailer.`
      : `${record.configurationGap} The factory identity remains searchable, with MSRP unverified.`,
  };
  function set(
    metric: Metric,
    value: number | undefined,
    attribute: { name: string; value: string | null },
  ) {
    const def = metricDefinitions[metric];
    if (value !== undefined && Number.isFinite(value) && value >= def.min && value <= def.max)
      facts[metric] = {
        value,
        source: sourceId(model),
        sourceUrl,
        note: `Exact configuration ${gmOptionKey(record.option)}, ${attribute.name}: ${attribute.value}. Engine versus total-system basis and manufacturer test qualifications are source-specific.`,
      };
  }
  for (const attribute of configuration?.attributes ?? []) {
    if (/^horsepower(?:\s|@|$)/i.test(attribute.name) && attribute.value) {
      const power = /^(\d+(?:\.\d+)?)(?:\s*@\s*[\d, .~-]+)?\s*$/.exec(attribute.value)?.[1];
      if (power) set('horsepower', Number(power), attribute);
    }
    if (
      /L\s*\/\s*100\s*KM/i.test(attribute.name) &&
      attribute.value &&
      gmFuel(record, model) !== 'Electric'
    ) {
      const pair = /^\s*(\d+(?:\.\d+)?)\s*City\s*\/\s*(\d+(?:\.\d+)?)\s*HWY\s*$/i.exec(
        attribute.value,
      );
      if (pair) {
        set('fuelCityL100km', Number(pair[1]), attribute);
        set('fuelHighwayL100km', Number(pair[2]), attribute);
      }
    }
  }
  if (gmFuel(record, model) === 'Electric')
    for (const metric of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
      facts[metric].note =
        'Not applicable to battery-electric propulsion. Gasoline-equivalent energy is not liquid fuel consumed. Exact Canadian electric consumption/range still needs source reconciliation.';
  return facts;
}
const gmPostal = 'T2P1J9';
function bodyStyle(record: GmRecord, model: GmSnapshot['models'][number]): Car['bodyStyle'] {
  const body = model.reference.bodyStyle;
  if (/passenger$/.test(body)) return 'Van';
  if (/silverado|sierra|colorado|canyon|^hummer$/.test(body)) return 'Pickup';
  if (/^ct[45]/.test(body)) return 'Sedan';
  if (/corvette/.test(body))
    return /convertible/i.test(record.bodyDescription ?? '')
      ? 'Convertible'
      : /coupe/i.test(record.bodyDescription ?? '')
        ? 'Coupe'
        : 'Not verified';
  return body === 'bolt' ? 'Not verified' : 'SUV';
}
export function addGmRetail(base: Catalog, snapshot: GmSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10);
  const sources: Source[] = snapshot.models
    .filter((model) => !model.excludedReason)
    .map((model) => ({
      id: sourceId(model),
      title: `${model.reference.year} ${gmBrands[model.reference.brand].make} ${model.displayName} Canadian factory configurations`,
      publisher: `${gmBrands[model.reference.brand].make} Canada`,
      url: gmClientUrl(model.reference),
      reviewedAt,
      publishedAt: null,
      locator:
        'Canadian build selector and trim-matrix options reconcile with every nested trim configuration. Style, body, drive, engine, transmission, axle, battery and propulsion identities are retained. Exact calculator subtotal/components establish MSRP without freight/fees. Rejected or mismatched calculations remain explicit gaps; additional equipment/package expansion is pending.',
    }));
  const cars: Car[] = snapshot.records.map((record) => {
    const model = snapshot.models.find((model) => model.key === record.modelKey)!;
    const drive = gmDrive(record),
      transmission = clean(record.transmissionDescription ?? 'Not verified');
    const variant = [
      record.bodyDescription,
      record.engineDescription,
      record.propulsionDescription,
      record.batteryDescription,
      record.transmissionDescription,
      record.axleDescription,
      drive === 'Not verified' ? `Drive: ${record.option.driveType}` : '',
    ]
      .filter(Boolean)
      .map((value) => clean(value!))
      .join(' · ')
      .slice(0, 200);
    return {
      id: gmRecordId(record),
      make: gmBrands[model.reference.brand].make,
      model: model.displayName,
      year: model.reference.year,
      trim: record.option.trimName,
      variant: variant || undefined,
      market: 'CA',
      bodyStyle: bodyStyle(record, model),
      fuel: gmFuel(record, model),
      drivetrain: drive,
      recordKind: 'retail-trim',
      manufacturerConfiguration: {
        id: gmOptionKey(record.option),
        code: record.option.mmcPeg,
        transmission: transmission.slice(0, 100),
        specificationsUrl: gmClientUrl(model.reference),
      },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: reviewedAt,
        source: sourceId(model),
        note: `Listed in the Canadian selector and exact factory matrix. Dealer stock, delivery dates, additional equipment combinations and older new inventory need confirmation.${record.lateAvailabilityNote ? ` Source availability qualification: ${clean(record.lateAvailabilityNote)}` : ''}`.slice(
          0,
          1000,
        ),
      },
      sourceIds: [sourceId(model)],
      facts: gmFacts(record, model),
    };
  });
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
