import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric } from './schema';
import type { NrcanRecord, NrcanSnapshot } from './nrcan-schema';
import { z } from 'zod';

export const reviewedRatingLinksSchema = z.strictObject({
  schemaVersion: z.literal(1),
  reviewedAt: z.iso.date(),
  links: z
    .array(
      z
        .strictObject({
          retailId: z.string().min(1),
          evidenceProvider: z.enum(['honda', 'subaru-specifications']).default('honda'),
          recordId: z.number().int().positive(),
          retail: z.strictObject({
            make: z.string(),
            model: z.string(),
            year: z.number().int(),
            fuel: z.string(),
            drivetrain: z.string(),
            transmission: z.string(),
          }),
          rating: z.strictObject({
            model: z.string(),
            engineLitres: z.number(),
            cylinders: z.number().int(),
            transmission: z.string(),
            vehicleType: z.literal('ICE').optional(),
            fuelType: z.enum(['X', 'Z']).optional(),
          }),
          manufacturerSource: z.string().min(1),
          engineEvidence: z.string().min(1),
          engineLayoutEvidence: z.string().min(1).optional(),
          transmissionEvidence: z.string().min(1).optional(),
          drivetrainEvidence: z.string().min(1).optional(),
          note: z.string().min(1),
        })
        .superRefine((link, ctx) => {
          if (
            link.evidenceProvider === 'subaru-specifications' &&
            (!link.engineLayoutEvidence ||
              !link.transmissionEvidence ||
              !link.drivetrainEvidence ||
              !link.rating.vehicleType ||
              !link.rating.fuelType)
          )
            ctx.addIssue({
              code: 'custom',
              message:
                'Subaru rating links require captured engine, cylinder, transmission, drivetrain and rating fuel evidence.',
            });
        }),
    )
    .max(10000),
});

const unknown = (): Fact => ({
  value: null,
  source: null,
  note: 'Not supplied by the government fuel-rating dataset; Canadian retail specifications still need verification.',
});
import { ratingUrl } from './rating-url';
export { ratingUrl } from './rating-url';

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
    const note = `${record.FuelEn}. ${record.VehicleTypeId.startsWith('PHEV') ? 'Fuel-only / charge-sustaining operation. Electric-mode driving is rated separately.' : 'Canadian certification rating; actual consumption varies.'}`;
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
      'Electric-mode consumption. For plug-in hybrid trip estimates, combine the modes used during the trip.',
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
      'NRCan published recharge time for the stated charging conditions. Check equipment and the charge window before comparing vehicles.',
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
  reviewedLinks?: unknown,
): Catalog {
  for (const id of Object.keys(links))
    if (!base.cars.some((car) => car.id === id))
      throw new Error(`Unknown retail rating link: ${id}`);
  const reviewedAt = snapshot.retrievedAt.slice(0, 10);
  const source = `nrcan-search-${reviewedAt}`;
  const records = new Map(snapshot.records.map((record) => [record.RecordId, record]));
  const reviewed = new Map<string, number>();
  if (reviewedLinks !== undefined) {
    const audit = reviewedRatingLinksSchema.parse(reviewedLinks);
    for (const link of audit.links) {
      const car = base.cars.find((car) => car.id === link.retailId);
      const rating = records.get(link.recordId);
      const subaru = link.evidenceProvider === 'subaru-specifications';
      const engineLitres = Number(
        subaru
          ? link.engineEvidence.match(/,\s*(\d+(?:\.\d+)?)-L\b/)?.[1]
          : link.engineEvidence.match(/^(\d+(?:\.\d+)?)-litre\b/)?.[1],
      );
      const cylinders = Number(
        subaru
          ? link.engineLayoutEvidence?.match(/\b(\d+)-cylinder\b/)?.[1]
          : link.engineEvidence
              .match(/(\d+)-cylinder|V(\d+)\b/i)
              ?.slice(1)
              .find(Boolean),
      );
      const speed = link.transmissionEvidence?.match(/\b(\d+)-speed (manual|automatic)\b/i);
      const compatibleTransmission =
        !subaru ||
        (!!rating &&
          (/\bCVT\b/.test(link.transmissionEvidence ?? '')
            ? /^AV\d+$/.test(rating.TransmissionId)
            : !!speed &&
              (speed[2]!.toLowerCase() === 'manual'
                ? rating.TransmissionId === `M${speed[1]}`
                : new RegExp(`^AS?${speed[1]}$`).test(rating.TransmissionId))));
      if (
        !car ||
        !rating ||
        car.recordKind !== 'retail-trim' ||
        reviewed.has(link.retailId) ||
        links[link.retailId] ||
        car.make !== link.retail.make ||
        car.model !== link.retail.model ||
        car.year !== link.retail.year ||
        car.fuel !== link.retail.fuel ||
        car.drivetrain !== link.retail.drivetrain ||
        car.manufacturerConfiguration?.transmission !== link.retail.transmission ||
        !car.sourceIds.includes(link.manufacturerSource) ||
        (subaru
          ? car.make !== 'Subaru' ||
            car.facts.fuelCityL100km.source !== link.manufacturerSource ||
            car.facts.fuelHighwayL100km.source !== link.manufacturerSource
          : car.facts.fuelCombinedL100km.source !== link.manufacturerSource) ||
        rating.Make !== car.make ||
        rating.Year !== car.year ||
        rating.Model !== link.rating.model ||
        rating.EngineSize !== link.rating.engineLitres ||
        rating.NumOfCylinders !== link.rating.cylinders ||
        engineLitres !== rating.EngineSize ||
        cylinders !== rating.NumOfCylinders ||
        !compatibleTransmission ||
        rating.VehicleTypeId !== 'ICE' ||
        !['X', 'Z'].includes(rating.FuelTypeId) ||
        (subaru &&
          (rating.VehicleTypeId !== link.rating.vehicleType ||
            rating.FuelTypeId !== link.rating.fuelType ||
            (car.fuel === 'Hybrid') !== /\bHybrid\b/i.test(link.engineEvidence) ||
            (car.fuel === 'Hybrid') !== /\bHybrid\b/i.test(rating.Model))) ||
        rating.TransmissionEn !== link.rating.transmission ||
        rating.CityGasConsumption !== car.facts.fuelCityL100km.value ||
        rating.HwyGasConsumption !== car.facts.fuelHighwayL100km.value ||
        ((!subaru || car.facts.fuelCombinedL100km.value !== null) &&
          rating.CombGasConsumption !== car.facts.fuelCombinedL100km.value)
      )
        throw new Error(`Review the audited retail-to-rating mapping for ${link.retailId}.`);
      reviewed.set(link.retailId, link.recordId);
    }
  }
  const covered = new Set<number>();
  const retail = base.cars.map((car) => {
    const recordId = links[car.id] ?? reviewed.get(car.id);
    if (!recordId) return car;
    const record = records.get(recordId);
    if (
      !record ||
      record.Year !== car.year ||
      record.Make !== car.make ||
      (car.facts.fuelCombinedL100km.value !== null &&
        record.CombGasConsumption !== car.facts.fuelCombinedL100km.value) ||
      (!reviewed.has(car.id) && car.facts.fuelCombinedL100km.value === null)
    )
      throw new Error(`Review the retail-to-rating mapping for ${car.id}.`);
    // Keep existing public rating IDs after adding joins. Only the original
    // merged ratings (which never had separate public IDs) remain omitted.
    if (links[car.id]) covered.add(recordId);
    const extra = ratingFacts(record, source);
    return {
      ...car,
      governmentRating: metadata(record),
      sourceIds: [...new Set([...car.sourceIds, source])],
      facts: Object.fromEntries(
        Object.entries(car.facts).map(([key, fact]) => [
          key,
          fact.value === null && extra[key as Metric].value !== null ? extra[key as Metric] : fact,
        ]),
      ) as Car['facts'],
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
