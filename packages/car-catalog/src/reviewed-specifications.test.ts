import { describe, expect, it } from 'vitest';
import { catalog, curatedCatalog } from './index';
import reviewed from '../data/reviewed-specifications.json';
import { addReviewedSpecifications, reviewedSpecificationsSchema } from './reviewed-specifications';

function fixture() {
  const base = structuredClone(curatedCatalog);
  const car = base.cars[0]!;
  const source = {
    id: 'honda-reviewed-specification-test',
    title: 'Reviewed Canadian specification',
    url: 'https://www.honda.ca/reviewed-specifications.pdf',
    publisher: 'Honda Canada',
    reviewedAt: '2026-10-29',
    publishedAt: null,
    locator: 'Reviewed exact configuration, page 1.',
  };
  const input = {
    schemaVersion: 1,
    sources: [source],
    receipts: [
      {
        sourceId: source.id,
        url: source.url,
        landingUrl: 'https://www.honda.ca/en/civic_sedan/specs',
        sha256: '0'.repeat(64),
        bytes: 1000,
        retrievedAt: '2026-10-29T12:00:00Z',
        pagesReviewed: [1],
      },
    ],
    reviews: [
      {
        sourceId: source.id,
        make: car.make,
        model: car.model,
        year: car.year!,
        fuel: car.fuel,
        recordIds: [car.id],
        scope: 'Exact reviewed factory identity.',
        facts: { horsepower: { value: 200, note: 'Reviewed system output in hp.' } },
        conflicts: [] as {
          metric: string;
          previousValue: number;
          previousSource: string;
          documentValue: number;
          note: string;
        }[],
      },
    ],
  };
  return { base, car, input, source };
}

describe('reviewed specification supplements', () => {
  it('fills an unknown fact with dated provenance while preserving other facts and source dates', () => {
    const { base, car, input, source } = fixture();
    car.facts.horsepower = { value: null, source: null, note: 'Not yet verified.' };
    const before = structuredClone(base);
    const result = addReviewedSpecifications(base, input);
    expect(result.cars[0]!.facts.horsepower).toMatchObject({
      value: 200,
      source: source.id,
      sourceUrl: source.url,
    });
    expect(result.cars[0]!.facts.msrpCad).toEqual(before.cars[0]!.facts.msrpCad);
    expect(result.cars.slice(1)).toEqual(before.cars.slice(1));
    expect(result.sources.slice(0, base.sources.length)).toEqual(base.sources);
    expect(result.reviewedAt).toBe('2026-10-29');
    expect(base).toEqual(before);
  });
  it('keeps an agreeing known fact and rejects an unreviewed replacement', () => {
    const { base, car, input } = fixture();
    input.reviews[0]!.facts.horsepower.value = car.facts.horsepower.value!;
    const result = addReviewedSpecifications(base, input);
    expect(result.cars[0]!.facts.horsepower).toEqual(car.facts.horsepower);
    input.reviews[0]!.facts.horsepower.value += 1;
    expect(() => addReviewedSpecifications(base, input)).toThrow('Known specification conflicts');
  });
  it('withholds a conflicting value only when the original value and source still match', () => {
    const { base, car, input, source } = fixture();
    const original = car.facts.horsepower;
    input.reviews[0]!.facts = {} as (typeof input.reviews)[0]['facts'];
    input.reviews[0]!.conflicts = [
      {
        metric: 'horsepower',
        previousValue: original.value!,
        previousSource: original.source!,
        documentValue: 200,
        note: 'The two official sources disagree; exact output requires checking.',
      },
    ];
    const result = addReviewedSpecifications(base, input);
    expect(result.cars[0]!.facts.horsepower).toMatchObject({ value: null, source: source.id });
    expect(result.cars[0]!.sourceIds).toContain(original.source);
    expect(result.cars[0]!.sourceIds).toContain(source.id);
    car.facts.horsepower.value = 191;
    expect(() => addReviewedSpecifications(base, input)).toThrow(
      'Re-review the changed specification conflict',
    );
  });
  it('rejects a model-year mismatch, a missing ID and a government variant', () => {
    const { base, car, input } = fixture();
    input.reviews[0]!.year = 2025;
    expect(() => addReviewedSpecifications(base, input)).toThrow('exact specification identity');
    input.reviews[0]!.year = car.year!;
    input.reviews[0]!.recordIds = ['missing-configuration'];
    expect(() => addReviewedSpecifications(base, input)).toThrow('exact specification identity');
    input.reviews[0]!.recordIds = [car.id];
    car.recordKind = 'government-rating';
    expect(() => addReviewedSpecifications(base, input)).toThrow('exact specification identity');
  });
  it('rejects missing or mismatched receipts and host lookalikes', () => {
    const { base, input } = fixture();
    input.receipts[0]!.url = 'https://www.honda.ca/another-document.pdf';
    expect(() => addReviewedSpecifications(base, input)).toThrow('matching receipt');
    input.sources[0]!.url = 'https://toyotacanada.scene7.com.example.org/fake.pdf';
    expect(() => addReviewedSpecifications(base, input)).toThrow();
  });
  it('rejects duplicate identities, overlapping reviews and impossible measurements', () => {
    const { base, car, input } = fixture();
    car.facts.horsepower = { value: null, source: null, note: 'Not yet verified.' };
    input.reviews[0]!.recordIds.push(car.id);
    expect(() => addReviewedSpecifications(base, input)).toThrow(
      'Duplicate specification review identity',
    );
    input.reviews[0]!.recordIds.pop();
    input.reviews.push(structuredClone(input.reviews[0]!));
    expect(() => addReviewedSpecifications(base, input)).toThrow(
      'Overlapping specification review',
    );
    input.reviews.pop();
    input.reviews[0]!.facts.horsepower.value = 100000;
    expect(() => addReviewedSpecifications(base, input)).toThrow();
  });
  it('applies the reviewed Canadian tables only to their explicit factory identities', () => {
    const find = (id: string) => catalog.cars.find((car) => car.id === id)!;
    expect(find('toyota-ca-2026-t86-znbb6m-a').facts.rearLegroomMm).toMatchObject({
      value: 759.5,
      source: 'toyota-ca-2026-gr86-interior-review',
    });
    expect(find('toyota-ca-2027-t86-znbb6m-a').facts.rearLegroomMm.value).toBeNull();
    expect(find('toyota-ca-2026-sih-grke1c-a').facts.rearLegroomMm.value).toBe(1013);
    expect(find('toyota-ca-2026-sih-grke1c-m').facts.rearLegroomMm.value).toBeNull();
    expect(find('toyota-ca-2026-sih-grke2c-a').facts.frontHeadroomMm).toMatchObject({
      value: null,
      source: 'toyota-ca-2026-sienna-interior-review',
    });
    expect(find('toyota-ca-2026-rah-bbrahc-a').facts.frontHeadroomMm.value).toBe(991);
    expect(find('toyota-ca-2026-rah-xbrahc-b').facts.frontHeadroomMm.value).toBe(958);
    expect(find('honda-ca-2026-10910-10958').facts.horsepower).toMatchObject({
      value: 200,
      source: 'honda-ca-2026-civic-hybrid-power-review',
    });
    expect(find('mazda-ca-jxln85-aa00').facts.cargoSeatsUpL.value).toBe(889);
    expect(find('mazda-ca-jxtm85-ap00').facts.cargoSeatsDownL.value).toBe(1595);
    expect(find('hyundai-ca-f2e53b16-a921-4851-843d-5f01dd033227').facts.horsepower.value).toBe(
      276,
    );
    expect(
      find('hyundai-ca-2d52d22a-0585-4fc2-a8dd-b6a88a9a6fcb').facts.horsepower.value,
    ).toBeNull();
    expect(find('hyundai-ca-7032886d-45c9-0cae-be15-862c3d9c0e01').facts.horsepower.value).toBe(
      601,
    );
    const hev = find('hyundai-ca-c4a261bd-1520-43ea-8d3b-2b46e5fe57f8');
    const phev = find('hyundai-ca-59f03504-0ce1-4b94-b8d0-2728ce578f73');
    expect(hev.facts.cargoSeatsUpL.value).toBe(1097);
    expect(hev.facts.horsepower.value).toBeNull();
    expect(phev.facts.cargoSeatsUpL.value).toBe(902);
    expect(phev.facts.horsepower.value).toBe(268);
    expect(reviewed.sources).toHaveLength(23);
    expect(
      reviewed.reviews.reduce((n, r) => n + r.recordIds.length * Object.keys(r.facts).length, 0),
    ).toBe(682);
    expect(reviewed.reviews.reduce((n, r) => n + r.recordIds.length * r.conflicts.length, 0)).toBe(
      6,
    );
  });
  it('requires JSON sections, matching model IDs and independently captured year evidence', () => {
    const snapshot = reviewedSpecificationsSchema.parse(reviewed);
    const receipt = snapshot.receipts.find((r) => r.format === 'json')!;
    const review = snapshot.reviews.find((r) => r.sourceId === receipt.sourceId)!;
    snapshot.sources = snapshot.sources.filter((source) => source.id === receipt.sourceId);
    snapshot.receipts = [receipt];
    snapshot.reviews = [review];
    expect(receipt.identityEvidence!.year).toBe(review.year);
    receipt.sectionsReviewed = [];
    expect(() => addReviewedSpecifications(curatedCatalog, snapshot)).toThrow('JSON sections');
    receipt.sectionsReviewed = ['Performance'];
    receipt.identityEvidence!.modelId = '00000000-0000-0000-0000-000000000000';
    expect(() => addReviewedSpecifications(curatedCatalog, snapshot)).toThrow('model ID');
    receipt.identityEvidence!.modelId = new URL(receipt.url).searchParams.get('modelId')!;
    receipt.identityEvidence!.year += 1;
    expect(() => addReviewedSpecifications(curatedCatalog, snapshot)).toThrow(
      'model-year evidence',
    );
  });
  it('fills only unknown drivetrains and guards conflicting categorical evidence', () => {
    const { base, car, input } = fixture();
    car.drivetrain = 'Not verified';
    const review = {
      ...input.reviews[0]!,
      drivetrain: { value: 'AWD', note: 'The reviewed exact column explicitly lists AWD.' },
    };
    const snapshot = { ...input, reviews: [review] };
    review.facts.horsepower.value = car.facts.horsepower.value!;
    expect(addReviewedSpecifications(base, snapshot).cars[0]!.drivetrain).toBe('AWD');
    car.drivetrain = 'FWD';
    expect(() => addReviewedSpecifications(base, snapshot)).toThrow('Known drivetrain conflicts');
  });
});
