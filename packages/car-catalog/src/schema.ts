import { z } from 'zod';

export const metricDefinitions = {
  msrpCad: { label: 'Base MSRP', unit: 'CAD', min: 10000, max: 300000 },
  fuelCityL100km: { label: 'City consumption', unit: 'L/100 km', min: 1, max: 50 },
  fuelHighwayL100km: { label: 'Highway consumption', unit: 'L/100 km', min: 1, max: 50 },
  fuelCombinedL100km: { label: 'Combined consumption', unit: 'L/100 km', min: 1, max: 50 },
  horsepower: { label: 'Power', unit: 'hp', min: 50, max: 1500 },
  seats: { label: 'Seats', unit: 'people', min: 2, max: 9 },
  cargoSeatsUpL: { label: 'Cargo · seats up', unit: 'L', min: 10, max: 4000 },
  cargoSeatsDownL: { label: 'Cargo · seats down', unit: 'L', min: 10, max: 6000 },
  frontHeadroomMm: { label: 'Front headroom', unit: 'mm', min: 600, max: 1600 },
  rearHeadroomMm: { label: 'Rear headroom', unit: 'mm', min: 600, max: 1600 },
  frontLegroomMm: { label: 'Front legroom', unit: 'mm', min: 600, max: 1600 },
  rearLegroomMm: { label: 'Rear legroom', unit: 'mm', min: 600, max: 1600 },
  lengthMm: { label: 'Length', unit: 'mm', min: 2500, max: 8000 },
  widthMm: { label: 'Published width', unit: 'mm', min: 1200, max: 2600 },
  heightMm: { label: 'Height', unit: 'mm', min: 1000, max: 3000 },
} as const;

export type Metric = keyof typeof metricDefinitions;
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
  Object.entries(metricDefinitions).map(([key, def]) => [key, fact(def.min, def.max)]),
) as { [K in Metric]: ReturnType<typeof fact> };

const manufacturerHosts = new Set([
  'www.honda.ca',
  'honda.ca',
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

export const carSchema = z.strictObject({
  id,
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  trim: z.string().min(1).max(100),
  year: z.number().int().min(1990).max(2100),
  market: z.literal('CA'),
  bodyStyle: z.literal('Compact SUV'),
  fuel: z.enum(['Gasoline', 'Hybrid']),
  drivetrain: z.enum(['FWD', 'AWD']),
  sourceIds: z.array(id).min(1),
  facts: z.strictObject(factsShape),
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
      ].join('|');
      if (carIds.has(car.id) || configurations.has(configuration)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate configuration: ${car.id}` });
      }
      carIds.add(car.id);
      configurations.add(configuration);
      for (const sourceId of car.sourceIds) {
        if (!sourceIds.has(sourceId))
          ctx.addIssue({ code: 'custom', message: `Unknown source ${sourceId} on ${car.id}` });
      }
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
