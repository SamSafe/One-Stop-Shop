export const buyingStorageKey = 'oss-buying-v1';
export const buyingFileLimit = 2_000_000;
export const reviewDimensions = {
  enjoyment: 'Driving enjoyment',
  comfort: 'Seat comfort',
  rearSpace: 'Rear-seat space',
  visibility: 'Visibility',
};
export type ReviewDimension = keyof typeof reviewDimensions;
export const verdictLabels = {
  consider: 'Still considering',
  unsure: 'Undecided',
  'ruled-out': 'Ruled out',
};
export interface TestDriveReview {
  id: string;
  carId: string;
  vehicleName: string;
  date: string;
  createdAt: string;
  verdict: keyof typeof verdictLabels;
  ratings: Record<ReviewDimension, number | null>;
  notes: string;
}
export interface BuyingWorkspace {
  version: 1;
  revision: string;
  reviews: TestDriveReview[];
}
export function emptyBuyingWorkspace(): BuyingWorkspace {
  return { version: 1, revision: 'initial', reviews: [] };
}

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key)) ||
    keys.some((key) => !(key in value))
  )
    throw new Error('Unsupported or incomplete buying data. Keep the original backup.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, allowEmpty = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim()))
    throw new Error('Invalid text in buying data.');
}
function number(value: unknown, min: number, max: number, nullable = false) {
  if (nullable && value === null) return;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    throw new Error('Invalid number in buying data.');
}
export function parseReview(value: unknown): TestDriveReview {
  const r = object(value, [
    'id',
    'carId',
    'vehicleName',
    'date',
    'createdAt',
    'verdict',
    'ratings',
    'notes',
  ]);
  text(r.id, 100);
  text(r.carId, 100);
  text(r.vehicleName, 500);
  text(r.notes, 4000, true);
  text(r.date, 10);
  if (!/^[a-z0-9-]+$/.test(r.id) || !/^[a-z0-9-]+$/.test(r.carId))
    throw new Error('Invalid review identifier.');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
    !Number.isFinite(Date.parse(r.date)) ||
    new Date(r.date).toISOString().slice(0, 10) !== r.date
  )
    throw new Error('Enter a valid test-drive date.');
  text(r.createdAt, 24);
  if (
    !Number.isFinite(Date.parse(r.createdAt)) ||
    new Date(r.createdAt).toISOString() !== r.createdAt
  )
    throw new Error('Invalid review creation date.');
  if (typeof r.verdict !== 'string' || !Object.hasOwn(verdictLabels, r.verdict))
    throw new Error('Invalid test-drive verdict.');
  const ratings = object(r.ratings, Object.keys(reviewDimensions));
  for (const rating of Object.values(ratings)) number(rating, 1, 5, true);
  return structuredClone(value) as TestDriveReview;
}
export function parseBuyingWorkspace(value: unknown): BuyingWorkspace {
  // Earlier versions also stored a buying brief. Its requirements now live in the
  // catalog filters, so a stored brief is accepted and dropped.
  const legacy = !!value && typeof value === 'object' && 'brief' in value;
  const w = object(
    value,
    legacy ? ['version', 'revision', 'brief', 'reviews'] : ['version', 'revision', 'reviews'],
  );
  if (legacy && w.brief !== null && (typeof w.brief !== 'object' || Array.isArray(w.brief)))
    throw new Error('Unsupported or incomplete buying data. Keep the original backup.');
  if (w.version !== 1)
    throw new Error('Unsupported buying backup version. Keep the original file.');
  text(w.revision, 100);
  if (!Array.isArray(w.reviews) || w.reviews.length > 1000)
    throw new Error('A buying journal can contain up to 1,000 reviews.');
  const reviews = w.reviews.map(parseReview);
  if (new Set(reviews.map((r) => r.id)).size !== reviews.length)
    throw new Error('Duplicate review identifiers in buying data.');
  const result: BuyingWorkspace = {
    version: 1,
    revision: w.revision,
    reviews,
  };
  if (new TextEncoder().encode(JSON.stringify(result)).length > buyingFileLimit)
    throw new Error('Buying data must be smaller than 2 MB.');
  return result;
}
export function readBuyingWorkspace(raw: string | null): BuyingWorkspace {
  if (raw === null) return emptyBuyingWorkspace();
  if (new TextEncoder().encode(raw).length > buyingFileLimit)
    throw new Error('Buying backup is too large.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('That buying backup is not valid JSON. Keep the original file.');
  }
  return parseBuyingWorkspace(value);
}
export function mergeBuyingWorkspace(
  current: BuyingWorkspace,
  incoming: BuyingWorkspace,
): BuyingWorkspace {
  const ids = new Set(current.reviews.map((r) => r.id));
  return parseBuyingWorkspace({
    ...current,
    reviews: [...current.reviews, ...incoming.reviews.filter((r) => !ids.has(r.id))],
  });
}
export function buyingBackup(workspace: BuyingWorkspace): string {
  // Export within the same byte bound enforced by storage and imports.
  return JSON.stringify(parseBuyingWorkspace(workspace));
}
export function latestReview(reviews: TestDriveReview[], carId: string) {
  return reviews
    .filter((r) => r.carId === carId)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id),
    )[0];
}
// Vehicles whose latest dated test-drive verdict rules them out.
export function ruledOutIds(reviews: TestDriveReview[]) {
  return [...new Set(reviews.map((r) => r.carId))].filter(
    (carId) => latestReview(reviews, carId)?.verdict === 'ruled-out',
  );
}
