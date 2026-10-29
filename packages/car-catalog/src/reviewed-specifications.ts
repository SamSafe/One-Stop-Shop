import { z } from 'zod';
import { metricDefinitions, sourceSchema, validateCatalog } from './schema';
import type { Catalog, Car, Metric } from './schema';

const metric = z
  .string()
  .refine((key) => Object.hasOwn(metricDefinitions, key), 'Unknown specification metric.');
const identifier = sourceSchema.shape.id;
const reviewedFact = z.strictObject({
  value: z.number().finite(),
  note: z.string().min(1).max(1000),
  qualifier: z.literal('up-to').optional(),
});
export const reviewedSpecificationsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sources: z.array(sourceSchema).min(1),
  receipts: z
    .array(
      z
        .strictObject({
          sourceId: identifier,
          url: sourceSchema.shape.url,
          landingUrl: sourceSchema.shape.url,
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          bytes: z.number().int().positive().max(15_000_000),
          retrievedAt: z.iso.datetime({ offset: true }),
          format: z.enum(['pdf', 'json']).default('pdf'),
          pagesReviewed: z.array(z.number().int().positive()).default([]),
          sectionsReviewed: z.array(z.string().min(1)).default([]),
          identityEvidence: z
            .strictObject({
              url: sourceSchema.shape.url,
              sha256: z.string().regex(/^[a-f0-9]{64}$/),
              bytes: z.number().int().positive().max(15_000_000),
              retrievedAt: z.iso.datetime({ offset: true }),
              modelId: z.guid(),
              year: z.number().int().min(1990).max(2100),
              locator: z.string().min(1),
            })
            .optional(),
        })
        .superRefine((receipt, context) => {
          if (receipt.format === 'pdf' && !receipt.pagesReviewed.length)
            context.addIssue({ code: 'custom', message: 'Identify the reviewed PDF pages.' });
          if (
            receipt.format === 'json' &&
            (!receipt.sectionsReviewed.length || !receipt.identityEvidence)
          )
            context.addIssue({
              code: 'custom',
              message: 'Identify the JSON sections and model-year evidence.',
            });
          if (
            receipt.identityEvidence &&
            new URL(receipt.url).searchParams.get('modelId') !== receipt.identityEvidence.modelId
          )
            context.addIssue({
              code: 'custom',
              message: 'Specification model ID and identity evidence disagree.',
            });
        }),
    )
    .min(1),
  reviews: z
    .array(
      z.strictObject({
        sourceId: identifier,
        make: z.string().min(1),
        model: z.string().min(1),
        year: z.number().int().min(1990).max(2100),
        fuel: z.string().min(1),
        recordIds: z.array(identifier).min(1),
        scope: z.string().min(1).max(1000),
        facts: z.record(metric, reviewedFact),
        drivetrain: z
          .strictObject({
            value: z.enum(['FWD', 'RWD', 'AWD', '4WD']),
            note: z.string().min(1).max(1000),
          })
          .optional(),
        conflicts: z
          .array(
            z.strictObject({
              metric,
              previousValue: z.number().finite(),
              previousSource: identifier,
              documentValue: z.number().finite(),
              note: z.string().min(1).max(1000),
            }),
          )
          .default([]),
      }),
    )
    .min(1),
});

export function addReviewedSpecifications(base: Catalog, input: unknown): Catalog {
  const snapshot = reviewedSpecificationsSchema.parse(input);
  const sources = new Map(base.sources.map((source) => [source.id, source]));
  const receipts = new Map<string, (typeof snapshot.receipts)[number]>();
  for (const receipt of snapshot.receipts) {
    if (receipts.has(receipt.sourceId))
      throw new Error(`Duplicate review receipt: ${receipt.sourceId}`);
    receipts.set(receipt.sourceId, receipt);
  }
  for (const source of snapshot.sources) {
    if (sources.has(source.id)) throw new Error(`Duplicate specification source: ${source.id}`);
    const receipt = receipts.get(source.id);
    if (!receipt || receipt.url !== source.url)
      throw new Error(`Missing matching receipt for ${source.id}`);
    if (source.reviewedAt > receipt.retrievedAt.slice(0, 10))
      throw new Error(`Review date is ahead of its capture: ${source.id}`);
    sources.set(source.id, source);
  }
  if (receipts.size !== snapshot.sources.length)
    throw new Error('Specification receipts and sources do not reconcile.');
  const cars = new Map(base.cars.map((car) => [car.id, car]));
  const reviewed = new Set<string>();
  for (const review of snapshot.reviews) {
    const source = snapshot.sources.find((item) => item.id === review.sourceId);
    if (!source) throw new Error(`Missing specification review source: ${review.sourceId}`);
    const identity = receipts.get(source.id)?.identityEvidence;
    if (
      identity &&
      (identity.year !== review.year || source.reviewedAt > identity.retrievedAt.slice(0, 10))
    )
      throw new Error(`Re-review the specification model-year evidence: ${review.sourceId}`);
    function checkRange(key: string, value: number) {
      const definition = metricDefinitions[key as Metric];
      if (value < definition.min || value > definition.max)
        throw new Error(`Reviewed measurement is out of range: ${key}`);
    }
    for (const [key, fact] of Object.entries(review.facts)) checkRange(key, fact.value);
    for (const conflict of review.conflicts) {
      checkRange(conflict.metric, conflict.previousValue);
      checkRange(conflict.metric, conflict.documentValue);
    }
    if (!Object.keys(review.facts).length && !review.conflicts.length && !review.drivetrain)
      throw new Error('An empty specification review cannot change the catalog.');
    if (new Set(review.recordIds).size !== review.recordIds.length)
      throw new Error('Duplicate specification review identity.');
    for (const id of review.recordIds) {
      const previous = cars.get(id);
      if (
        !previous ||
        previous.recordKind !== 'retail-trim' ||
        previous.make !== review.make ||
        previous.model !== review.model ||
        previous.year !== review.year ||
        previous.fuel !== review.fuel
      )
        throw new Error(`Review the exact specification identity: ${id}`);
      const car: Car = {
        ...previous,
        facts: { ...previous.facts },
        sourceIds: [...previous.sourceIds],
      };
      let changed = false;
      function once(key: string) {
        const entry = `${id}/${key}`;
        if (reviewed.has(entry)) throw new Error(`Overlapping specification review: ${entry}`);
        reviewed.add(entry);
      }
      if (review.drivetrain) {
        once('drivetrain');
        if (car.drivetrain !== 'Not verified' && car.drivetrain !== review.drivetrain.value)
          throw new Error(`Known drivetrain conflicts with review: ${id}`);
        if (car.drivetrain === 'Not verified') {
          car.drivetrain = review.drivetrain.value;
          changed = true;
        }
      }
      for (const [key, fact] of Object.entries(review.facts)) {
        once(key);
        const name = key as Metric;
        const current = car.facts[name];
        if (current.value !== null) {
          if (current.value !== fact.value || current.qualifier !== fact.qualifier)
            throw new Error(`Known specification conflicts with review: ${id}/${key}`);
          continue;
        }
        car.facts[name] = { ...fact, source: source.id, sourceUrl: source.url };
        changed = true;
      }
      for (const conflict of review.conflicts) {
        once(conflict.metric);
        const name = conflict.metric as Metric;
        const current = car.facts[name];
        if (
          current.value !== conflict.previousValue ||
          current.source !== conflict.previousSource ||
          conflict.previousValue === conflict.documentValue
        )
          throw new Error(`Re-review the changed specification conflict: ${id}/${name}`);
        if (!sources.has(conflict.previousSource))
          throw new Error(`Missing original conflict source: ${conflict.previousSource}`);
        car.facts[name] = {
          value: null,
          source: source.id,
          sourceUrl: source.url,
          note: conflict.note,
        };
        changed = true;
      }
      if (changed && !car.sourceIds.includes(source.id)) car.sourceIds.push(source.id);
      cars.set(id, car);
    }
  }
  return validateCatalog({
    ...base,
    reviewedAt: [base.reviewedAt, ...snapshot.sources.map((source) => source.reviewedAt)]
      .sort()
      .at(-1)!,
    sources: [...base.sources, ...snapshot.sources],
    cars: base.cars.map((car) => cars.get(car.id)!),
  });
}
