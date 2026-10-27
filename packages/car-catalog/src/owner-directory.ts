export interface OwnerChoice {
  label: string;
  engine: string;
  catalogId?: string;
}
export interface OwnerModel {
  year: number;
  make: string;
  model: string;
  choices: OwnerChoice[];
  sourceIds: string[];
}
export interface OwnerDirectory {
  schemaVersion: 1;
  reviewedAt: string;
  sources: {
    id: string;
    title: string;
    url: string;
    sha256: string;
    bytes: number;
    capturedAt: string;
    records: number;
  }[];
  models: OwnerModel[];
}
export const ownerModelKey = (v: Pick<OwnerModel, 'year' | 'make' | 'model'>) =>
  `${v.year}|${v.make.toLowerCase()}|${v.model.toLowerCase()}`;
export function ownerYears(d: OwnerDirectory) {
  return [...new Set(d.models.map((m) => m.year))].sort((a, b) => b - a);
}
export function ownerMakes(d: OwnerDirectory, year: number) {
  return [...new Set(d.models.filter((m) => m.year === year).map((m) => m.make))].sort((a, b) =>
    a.localeCompare(b, 'en-CA'),
  );
}
export function ownerModels(d: OwnerDirectory, year: number, make: string) {
  return d.models
    .filter((m) => m.year === year && m.make === make)
    .sort((a, b) => a.model.localeCompare(b.model, 'en-CA'));
}
export function decodeOwnerDirectory(input: unknown): OwnerDirectory {
  if (!input || typeof input !== 'object') throw new Error('Vehicle lookup data is invalid.');
  const d = input as OwnerDirectory;
  if (
    d.schemaVersion !== 1 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(d.reviewedAt) ||
    !Array.isArray(d.models) ||
    !d.models.length ||
    d.models.length > 50000 ||
    !Array.isArray(d.sources) ||
    d.sources.length !== 6
  )
    throw new Error('Vehicle lookup data is incomplete.');
  for (const m of d.models) {
    if (
      !Number.isInteger(m.year) ||
      m.year < 1995 ||
      m.year > 2100 ||
      typeof m.make !== 'string' ||
      !m.make ||
      m.make.length > 100 ||
      typeof m.model !== 'string' ||
      !m.model ||
      m.model.length > 150 ||
      !Array.isArray(m.choices) ||
      !m.choices.length ||
      m.choices.length > 1000
    )
      throw new Error('Vehicle lookup identity is invalid.');
    for (const c of m.choices) {
      if (
        typeof c.label !== 'string' ||
        !c.label ||
        c.label.length > 350 ||
        typeof c.engine !== 'string' ||
        c.engine.length > 200 ||
        (c.catalogId !== undefined && !/^[a-z0-9-]{1,100}$/.test(c.catalogId))
      )
        throw new Error('Vehicle lookup configuration is invalid.');
    }
  }
  return d;
}
export interface OwnerDirectoryPacket {
  version: 1;
  reviewedAt: string;
  sources: OwnerDirectory['sources'];
  strings: string[];
  rows: [number, number, number, [number, number, number | null][], number[]][];
}
export function unpackOwnerDirectory(input: unknown): OwnerDirectory {
  if (!input || typeof input !== 'object') throw new Error('Vehicle lookup packet is invalid.');
  const p = input as OwnerDirectoryPacket;
  if (
    p.version !== 1 ||
    !Array.isArray(p.strings) ||
    p.strings.length > 100000 ||
    p.strings.some((s) => typeof s !== 'string' || s.length > 350) ||
    !Array.isArray(p.rows) ||
    p.rows.length > 50000 ||
    !Array.isArray(p.sources)
  )
    throw new Error('Vehicle lookup packet is incomplete.');
  const get = (index: number) => {
    if (!Number.isInteger(index) || index < 0 || index >= p.strings.length)
      throw new Error('Vehicle lookup reference is invalid.');
    return p.strings[index]!;
  };
  return decodeOwnerDirectory({
    schemaVersion: 1,
    reviewedAt: p.reviewedAt,
    sources: p.sources,
    models: p.rows.map((row) => {
      if (
        !Array.isArray(row) ||
        row.length !== 5 ||
        !Array.isArray(row[3]) ||
        !Array.isArray(row[4])
      )
        throw new Error('Vehicle lookup row is invalid.');
      return {
        year: row[0],
        make: get(row[1]),
        model: get(row[2]),
        choices: row[3].map((c) => {
          if (!Array.isArray(c) || c.length !== 3)
            throw new Error('Vehicle configuration is invalid.');
          return {
            label: get(c[0]),
            engine: get(c[1]),
            ...(c[2] === null ? {} : { catalogId: get(c[2]) }),
          };
        }),
        sourceIds: row[4].map((index) => {
          if (!Number.isInteger(index) || !p.sources[index])
            throw new Error('Vehicle source reference is invalid.');
          return p.sources[index]!.id;
        }),
      };
    }),
  });
}
