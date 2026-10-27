import { z } from 'zod';
import { decodeOwnerDirectory, ownerModelKey } from './owner-directory';
import type { OwnerDirectory, OwnerDirectoryPacket } from './owner-directory';
import type { Catalog } from './schema';
export function parseOwnerCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(value);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      value = '';
    } else value += c;
  }
  if (quoted) throw new Error('Unterminated CSV field.');
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}
export function transmissionLabel(code: string) {
  const m = /^(AS|AM|AV|A|M)(\d*)$/.exec(code);
  if (!m) return code ? `Transmission ${code}` : 'Transmission not specified';
  const label = {
    AS: 'Automatic with selectable gears',
    AM: 'Automated manual',
    AV: 'CVT',
    A: 'Automatic',
    M: 'Manual',
  }[m[1]!]!;
  return m[2]
    ? m[1] === 'AV'
      ? `${label} (${m[2]} simulated gears)`
      : `${label} (${m[2]}-speed)`
    : label;
}
const sourceSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.url().refine((s) => new URL(s).origin === 'https://open.canada.ca'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  capturedAt: z.iso.datetime(),
  records: z.number().int().positive(),
});
export function validateOwnerDirectory(input: unknown, catalog?: Catalog): OwnerDirectory {
  const d = decodeOwnerDirectory(input);
  z.array(sourceSchema).length(6).parse(d.sources);
  if (
    new Set(d.sources.map((s) => s.id)).size !== 6 ||
    new Set(d.models.map(ownerModelKey)).size !== d.models.length
  )
    throw new Error('Duplicate owner directory identity or source.');
  const sources = new Set(d.sources.map((s) => s.id)),
    cars = catalog ? new Map(catalog.cars.map((c) => [c.id, c])) : null;
  for (const m of d.models) {
    if (!Array.isArray(m.sourceIds) || m.sourceIds.some((id) => !sources.has(id)))
      throw new Error('Owner identity has an unknown source.');
    if (!m.sourceIds.length && m.choices.some((c) => !c.catalogId))
      throw new Error('Owner identity lacks provenance.');
    if (new Set(m.choices.map((c) => `${c.catalogId ?? ''}|${c.label}`)).size !== m.choices.length)
      throw new Error('Duplicate owner configuration.');
    for (const choice of m.choices) {
      if (choice.catalogId && cars) {
        const car = cars.get(choice.catalogId);
        if (
          !car ||
          car.recordKind !== 'retail-trim' ||
          car.year !== m.year ||
          car.make.toLowerCase() !== m.make.toLowerCase() ||
          car.model.toLowerCase() !== m.model.toLowerCase()
        )
          throw new Error('Owner catalog reference has a different identity.');
      }
    }
  }
  return d;
}

export function packOwnerDirectory(d: OwnerDirectory): OwnerDirectoryPacket {
  const strings: string[] = [],
    indexes = new Map<string, number>();
  const ref = (s: string) => {
    const found = indexes.get(s);
    if (found !== undefined) return found;
    const index = strings.length;
    strings.push(s);
    indexes.set(s, index);
    return index;
  };
  return {
    version: 1,
    reviewedAt: d.reviewedAt,
    sources: d.sources,
    strings,
    rows: d.models.map((m) => [
      m.year,
      ref(m.make),
      ref(m.model),
      m.choices.map((c) => [ref(c.label), ref(c.engine), c.catalogId ? ref(c.catalogId) : null]),
      m.sourceIds.map((id) => d.sources.findIndex((s) => s.id === id)),
    ]),
  };
}
