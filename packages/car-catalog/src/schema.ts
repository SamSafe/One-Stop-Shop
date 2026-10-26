import { z } from 'zod';

import { metricDefinitions } from './metrics';
import type { Metric } from './metrics';
export { metricDefinitions } from './metrics';
export type { Metric } from './metrics';

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const date = z.iso.date();
const fact = (min: number, max: number) =>
  z
    .strictObject({
      value: z.number().finite().min(min).max(max).nullable(),
      source: id.nullable(),
      sourceUrl: z
        .url()
        .refine((value) => {
          const url = new URL(value);
          return (
            url.protocol === 'https:' &&
            manufacturerHosts.has(url.hostname) &&
            !url.username &&
            !url.password
          );
        }, 'Use a reviewed official source URL.')
        .optional(),
      note: z.string().min(1).max(1000).optional(),
    })
    .superRefine((value, ctx) => {
      if (value.value !== null && value.source === null) {
        ctx.addIssue({ code: 'custom', message: 'Known facts require a source.' });
      }
      if (value.value === null && !value.note) {
        ctx.addIssue({ code: 'custom', message: 'Unknown facts require an explanation.' });
      }
    });

const factsShape = Object.fromEntries(
  Object.entries(metricDefinitions).map(([key, def]) => [
    key,
    [
      'electricCombinedKwh100km',
      'electricModeFuelL100km',
      'electricModeLe100km',
      'electricRangeKm',
      'rechargeHours',
      'co2Gkm',
    ].includes(key)
      ? fact(def.min, def.max).default({
          value: null,
          source: null,
          note: 'Not verified for this configuration.',
        })
      : fact(def.min, def.max),
  ]),
) as { [K in Metric]: ReturnType<typeof fact> | z.ZodDefault<ReturnType<typeof fact>> };

const manufacturerHosts = new Set([
  'www.honda.ca',
  'honda.ca',
  'api.honda.ca',
  'www.acura.ca',
  'acura.ca',
  'hondanews.ca',
  'www.hondanews.ca',
  'www.subaru.ca',
  'subaru.ca',
  'm.subaru.ca',
  'www.mazda.ca',
  'mazda.ca',
  'prod.mazda.ca',
  'en.media.mazda.ca',
  'media.mazda.ca',
  'filecache.mediaroom.com',
  'vehicles.nrcan.gc.ca',
  'natural-resources.canada.ca',
  'open.canada.ca',
  'fcr-ccc.nrcan-rncan.gc.ca',
  'www.toyota.ca',
  'toyota.ca',
  'www.lexus.ca',
  'lexus.ca',
  'www.ford.ca',
  'shop.ford.ca',
  'www.lincolncanada.com',
  'shop.lincolncanada.com',
  'www.hyundaicanada.com',
  'www.kia.ca',
  'www.chevrolet.ca',
  'www.gmccanada.ca',
  'www.buick.ca',
  'www.cadillaccanada.ca',
  'www.nissan.ca',
  'www.infiniti.ca',
  'www.vw.ca',
  'oneapi.volkswagen.com',
  'www.mitsubishi-motors.ca',
  'clickshop.mitsubishi-motors.ca',
  'www-graphql.prod.mipulse.co',
  'www.polestar.com',
  'pc-api.polestar.com',
  'www.bmw.ca',
  'configure.bmw.ca',
  'prod.ucp.bmw.cloud',
  'inventory.bmw.ca',
  'www.mini.ca',
  'api.minicdn.ca',
  'www.genesis.com',
  'acquisition.genesis.ca',
  'rivian.com',
  'lucidmotors.com',
  'ext.cpq.lucidmotors.com',
  'buynow.lucidmotors.com',
  'n8xgyscaa3.execute-api.ca-central-1.amazonaws.com',
  'www.mercedes-benz.ca',
  'www.mercedes-benz-vans.ca',
  'nafta-service.mbusa.com',
  'nafta-service.mbvans.com',
  'vinfastauto.ca',
  'www.porsche.com',
  'configurator.porsche.com',
  'configurator.astonmartin.com',
  'www.astonmartin.com',
  'configurator.mclaren.com',
  'www.mclaren.com',
]);

export const sourceSchema = z.strictObject({
  id,
  title: z.string().min(1).max(250),
  url: z.url().refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        manufacturerHosts.has(url.hostname) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, 'Use an HTTPS source on a reviewed official source domain.'),
  publisher: z.string().min(1).max(100),
  reviewedAt: date,
  publishedAt: date.nullable(),
  locator: z.string().min(1).max(1000),
});

export const carSchema = z
  .strictObject({
    id,
    make: z.string().min(1).max(100),
    model: z.string().min(1).max(100),
    trim: z.string().min(1).max(100),
    year: z.number().int().min(1990).max(2100).nullable(),
    modelYearNote: z.string().min(1).max(1000).optional(),
    market: z.literal('CA'),
    bodyStyle: z.enum([
      'Compact SUV',
      'SUV',
      'Sedan',
      'Hatchback',
      'Coupe',
      'Convertible',
      'Wagon',
      'Pickup',
      'Minivan',
      'Van',
      'Not verified',
    ]),
    fuel: z.enum([
      'Gasoline',
      'Hybrid',
      'Gasoline / hybrid',
      'Diesel',
      'Flex-fuel',
      'Electric',
      'Plug-in hybrid',
      'Hydrogen',
    ]),
    drivetrain: z.enum(['FWD', 'RWD', 'AWD', '4WD', 'Not verified']),
    recordKind: z
      .enum(['retail-trim', 'government-rating', 'manufacturer-offer'])
      .default('retail-trim'),
    variant: z.string().min(1).max(200).optional(),
    manufacturerConfiguration: z
      .strictObject({
        id: z.string().min(1).max(100),
        code: z.string().min(1).max(100),
        transmission: z.string().min(1).max(100),
        specificationsUrl: sourceSchema.shape.url.optional(),
      })
      .optional(),
    publishedPrice: z
      .strictObject({
        value: z.number().finite().min(10000).max(10000000),
        currency: z.literal('CAD'),
        basis: z.literal('all-inclusive-before-sales-tax'),
        province: z.enum([
          'AB',
          'BC',
          'MB',
          'NB',
          'NL',
          'NS',
          'NT',
          'NU',
          'ON',
          'PE',
          'QC',
          'SK',
          'YT',
        ]),
        source: id,
        note: z.string().min(1).max(1000),
      })
      .optional(),
    governmentRating: z
      .strictObject({
        recordId: z.number().int().positive(),
        vehicleClass: z.string().min(1),
        engineLitres: z.number().nonnegative(),
        cylinders: z.number().int().nonnegative(),
        transmission: z.string().min(1),
        fuelType: z.string().min(1),
      })
      .optional(),
    availability: z
      .strictObject({
        status: z.enum(['not-checked', 'manufacturer-listed', 'announced', 'discontinued']),
        checkedAt: date.nullable(),
        source: id.nullable(),
        note: z.string().min(1).max(1000),
      })
      .default({
        status: 'not-checked',
        checkedAt: null,
        source: null,
        note: 'Current Canadian retail availability has not been rechecked.',
      }),
    sourceIds: z.array(id).min(1),
    facts: z.strictObject(factsShape),
  })
  .superRefine((car, ctx) => {
    if (car.year === null && (car.recordKind !== 'manufacturer-offer' || !car.modelYearNote))
      ctx.addIssue({
        code: 'custom',
        message: `Unverified model years require a manufacturer offer and explanation: ${car.id}`,
      });
    if (car.recordKind === 'manufacturer-offer' && (car.year !== null || car.governmentRating))
      ctx.addIssue({
        code: 'custom',
        message: `Manufacturer offers have an unverified model year and cannot carry an exact government rating: ${car.id}`,
      });
    if (
      car.recordKind === 'manufacturer-offer' &&
      (car.availability.status !== 'manufacturer-listed' ||
        !car.availability.source ||
        !car.availability.checkedAt ||
        !car.sourceIds.includes(car.availability.source))
    )
      ctx.addIssue({
        code: 'custom',
        message: `Manufacturer offers require dated current listing evidence: ${car.id}`,
      });
  });

export const catalogSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    reviewedAt: date,
    scope: z.string().min(1),
    pricingNote: z.string().min(1),
    sources: z.array(sourceSchema).min(1),
    cars: z.array(carSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const sourceIds = new Set<string>();
    const carIds = new Set<string>();
    const configurations = new Set<string>();
    for (const source of data.sources) {
      if (sourceIds.has(source.id))
        ctx.addIssue({ code: 'custom', message: `Duplicate source: ${source.id}` });
      sourceIds.add(source.id);
      if (
        source.reviewedAt > data.reviewedAt ||
        (source.publishedAt && source.publishedAt > source.reviewedAt)
      ) {
        ctx.addIssue({ code: 'custom', message: `Invalid source dates: ${source.id}` });
      }
    }
    for (const car of data.cars) {
      const configuration = [
        car.make,
        car.model,
        car.year,
        car.trim,
        car.market,
        car.drivetrain,
        car.variant ?? '',
        car.recordKind === 'government-rating'
          ? car.governmentRating?.recordId
          : (car.manufacturerConfiguration?.id ?? ''),
      ].join('|');
      if (car.recordKind === 'government-rating' && !car.governmentRating)
        ctx.addIssue({ code: 'custom', message: `Government rating metadata missing: ${car.id}` });
      if (
        car.availability.status !== 'not-checked' &&
        (!car.availability.source ||
          !car.availability.checkedAt ||
          !car.sourceIds.includes(car.availability.source))
      )
        ctx.addIssue({
          code: 'custom',
          message: `Availability requires dated, referenced evidence: ${car.id}`,
        });
      if (carIds.has(car.id) || configurations.has(configuration)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate configuration: ${car.id}` });
      }
      carIds.add(car.id);
      if (car.availability.checkedAt && car.availability.checkedAt > data.reviewedAt)
        ctx.addIssue({ code: 'custom', message: `Availability check is in the future: ${car.id}` });
      configurations.add(configuration);
      for (const sourceId of car.sourceIds) {
        if (!sourceIds.has(sourceId))
          ctx.addIssue({ code: 'custom', message: `Unknown source ${sourceId} on ${car.id}` });
      }
      if (car.publishedPrice && !car.sourceIds.includes(car.publishedPrice.source))
        ctx.addIssue({ code: 'custom', message: `Unreferenced published price on ${car.id}` });
      for (const [key, datum] of Object.entries(car.facts)) {
        if (datum.source && !car.sourceIds.includes(datum.source)) {
          ctx.addIssue({ code: 'custom', message: `Unreferenced source on ${car.id}.${key}` });
        }
      }
      if (car.facts.seats.value !== null && !Number.isInteger(car.facts.seats.value)) {
        ctx.addIssue({ code: 'custom', message: `Seat count must be an integer: ${car.id}` });
      }
      const up = car.facts.cargoSeatsUpL.value;
      const down = car.facts.cargoSeatsDownL.value;
      if (up !== null && down !== null && down < up) {
        ctx.addIssue({
          code: 'custom',
          message: `Cargo volume decreases with seats folded: ${car.id}`,
        });
      }
    }
  });

export type Fact = z.infer<ReturnType<typeof fact>>;
export type Car = z.infer<typeof carSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Catalog = z.infer<typeof catalogSchema>;

export function validateCatalog(
  input: unknown,
  today = new Date().toISOString().slice(0, 10),
): Catalog {
  const result = catalogSchema.parse(input);
  if (result.reviewedAt > today) throw new Error('Catalog review date is in the future.');
  return result;
}
