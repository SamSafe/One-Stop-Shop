import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric } from './schema';
import type { NrcanRecord, NrcanSnapshot } from './nrcan-schema';

const unknown = (): Fact => ({
  value: null,
  source: null,
  note: 'Not supplied by the government fuel-rating dataset; Canadian retail specifications still need verification.',
});
export const ratingUrl = (recordId: number) =>
  `https://fcr-ccc.nrcan-rncan.gc.ca/en/VehicleReport/${recordId}`;

export function fuelForRating(record: NrcanRecord): Car['fuel'] {
  if (record.VehicleTypeId === 'BEV') return 'Electric';
  if (record.VehicleTypeId.startsWith('PHEV')) return 'Plug-in hybrid';
  if (record.FuelTypeId === 'D') return 'Diesel';
  if (record.FuelTypeId === 'E') return 'Flex-fuel';
  if (record.FuelTypeId === 'H') return 'Hydrogen';
  if (/\bHybrid\b|\bHEV\b/i.test(record.Model)) return 'Hybrid';
  return 'Gasoline / hybrid'; // The API groups ICE and HEV; do not guess from low consumption.
}

export function ratingFacts(record: NrcanRecord, source: string): Car['facts'] {
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((key) => [key, unknown()]),
  ) as Car['facts'];
  function set(key: Metric, value: number, note: string, zeroAllowed = false) {
    if (value > 0 || (zeroAllowed && value === 0))
      facts[key] = { value, source, sourceUrl: ratingUrl(record.RecordId), note };
  }
  if (record.VehicleTypeId !== 'BEV' && record.FuelTypeId !== 'H') {
    const note = `${record.FuelEn}. ${record.VehicleTypeId.startsWith('PHEV') ? 'Fuel-only / charge-sustaining operation, not a blended electric-and-fuel journey.' : 'Canadian certification rating; actual consumption varies.'}`;
    set('fuelCityL100km', record.CityGasConsumption, note);
    set('fuelHighwayL100km', record.HwyGasConsumption, note);
    set('fuelCombinedL100km', record.CombGasConsumption, note);
  }
  if (record.VehicleTypeId !== 'ICE') {
    if (record.VehicleTypeId.startsWith('PHEV'))
      set(
        'electricModeFuelL100km',
        record.ElectricModeComb,
        'Some plug-in hybrids burn fuel during charge-depleting electric operation. Included alongside electricity in the energy estimate.',
        true,
      );
    set(
      'electricCombinedKwh100km',
      record.CombElectricKwhConsumption,
      'Electric-mode consumption. For plug-in hybrids, this is not a whole-journey energy estimate.',
    );
    set(
      'electricModeLe100km',
      record.CombElectricLeConsumption,
      'Gasoline-equivalent energy consumption in electric operation. Le is not litres of gasoline consumed.',
    );
    set(
      'electricRangeKm',
      record.RangeElectric,
      'Published electric-mode range; temperature, speed, loading and charging affect actual range.',
    );
    set(
      'rechargeHours',
      record.RechargeTime,
      'NRCan published recharge time; charging equipment and test conditions vary. This is not a universal fast-charge time.',
    );
  }
  set(
    'co2Gkm',
    record.Co2Emissions,
    'Published certification tailpipe emissions; excludes upstream fuel/electricity production.',
    true,
  );
  return facts;
}

function metadata(record: NrcanRecord): NonNullable<Car['governmentRating']> {
  return {
    recordId: record.RecordId,
    vehicleClass: record.ClassEn,
    engineLitres: record.EngineSize,
    cylinders: record.NumOfCylinders,
    transmission: record.TransmissionEn,
    fuelType: record.FuelEn,
  };
}

export function expandCatalog(
  base: Catalog,
  snapshot: NrcanSnapshot,
  links: Record<string, number>,
): Catalog {
  for (const id of Object.keys(links))
    if (!base.cars.some((car) => car.id === id))
      throw new Error(`Unknown retail rating link: ${id}`);
  const reviewedAt = snapshot.retrievedAt.slice(0, 10);
  const source = `nrcan-search-${reviewedAt}`;
  const records = new Map(snapshot.records.map((record) => [record.RecordId, record]));
  const covered = new Set<number>();
  const retail = base.cars.map((car) => {
    const recordId = links[car.id];
    if (!recordId) return car;
    const record = records.get(recordId);
    if (
      !record ||
      record.Year !== car.year ||
      record.Make !== car.make ||
      record.CombGasConsumption !== car.facts.fuelCombinedL100km.value
    )
      throw new Error(`Review the retail-to-rating mapping for ${car.id}.`);
    covered.add(recordId);
    const extra = ratingFacts(record, source);
    return {
      ...car,
      governmentRating: metadata(record),
      sourceIds: [...car.sourceIds, source],
      facts: { ...extra, ...car.facts, co2Gkm: extra.co2Gkm },
    };
  });
  const ratings = snapshot.records
    .filter((record) => !covered.has(record.RecordId))
    .map((record) => ({
      id: `nrcan-${record.RecordId}`,
      year: record.Year,
      make: record.Make,
      model: record.Model,
      trim: 'Retail trim not specified',
      market: 'CA',
      bodyStyle: 'Not verified',
      fuel: fuelForRating(record),
      drivetrain: /\bAWD\b/.test(record.Model)
        ? 'AWD'
        : /\b4WD\b|\b4X4\b/i.test(record.Model)
          ? '4WD'
          : /\bFWD\b/.test(record.Model)
            ? 'FWD'
            : /\bRWD\b/.test(record.Model)
              ? 'RWD'
              : 'Not verified',
      recordKind: 'government-rating',
      governmentRating: metadata(record),
      availability: {
        status: 'not-checked',
        checkedAt: null,
        source: null,
        note: 'Published in the Canadian rating database. Exact retail trims and current availability have not yet been reconciled with the manufacturer.',
      },
      sourceIds: [source],
      facts: ratingFacts(record, source),
    }));
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    scope:
      'Canadian passenger-vehicle expansion: retail configurations and NRCan 2025–2027 rating variants. Full retail-trim and current-availability coverage is still in progress.',
    sources: [
      ...base.sources,
      {
        id: source,
        title: `Canadian ${snapshot.modelYears.join(' / ')} vehicle ratings`,
        url: 'https://fcr-ccc.nrcan-rncan.gc.ca/en/Search',
        publisher: 'Natural Resources Canada',
        reviewedAt,
        publishedAt: null,
        locator: `${snapshot.records.length} unique metric-unit public search records. Each imported numeric fact links to its exact vehicle report. Ratings do not establish current retail availability or trim coverage.`,
      },
    ],
    cars: [...retail, ...ratings],
  });
}
