import type { Catalog } from './schema';

type Scalar = string | number | boolean | null;
type Node = Scalar | [number, number[]];
export type RuntimeCatalog = {
  version: 1;
  shapes: string[][];
  nodes: Node[];
  root: number;
};
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);

// Store repeated facts, notes and field layouts once. The input is the complete
// validated catalog; no manufacturer records or provenance fields are projected
// out. This format is a build artifact, not a second editable catalog.
export function encodeRuntimeCatalog(catalog: Catalog): RuntimeCatalog {
  const nodes: Node[] = [],
    shapes: string[][] = [],
    ids = new Map<string, number>(),
    shapeIds = new Map<string, number>();
  function intern(value: unknown): number {
    let node: Node;
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      node = value;
    else if (Array.isArray(value)) node = [0, value.map(intern)];
    else if (value && typeof value === 'object') {
      const entries = Object.entries(value).filter(([, v]) => v !== undefined),
        keys = entries.map(([k]) => k);
      if (keys.some((k) => forbiddenKeys.has(k))) throw new Error('Invalid runtime catalog field.');
      const signature = JSON.stringify(keys);
      let shape = shapeIds.get(signature);
      if (shape === undefined) {
        shape = shapes.length + 1;
        shapeIds.set(signature, shape);
        shapes.push(keys);
      }
      node = [shape, entries.map(([, v]) => intern(v))];
    } else throw new Error('Runtime catalog contains a non-JSON value.');
    const signature = JSON.stringify(node),
      existing = ids.get(signature);
    if (existing !== undefined) return existing;
    const id = nodes.length;
    nodes.push(node);
    ids.set(signature, id);
    return id;
  }
  const root = intern(catalog);
  return { version: 1, shapes, nodes, root };
}

export function decodeRuntimeCatalog(input: unknown): Catalog {
  const invalid = (): never => {
    throw new Error('The vehicle catalog could not be loaded.');
  };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid();
  const wire = input as Partial<RuntimeCatalog>;
  if (
    wire.version !== 1 ||
    !Array.isArray(wire.shapes) ||
    !Array.isArray(wire.nodes) ||
    wire.shapes.length > 1000 ||
    wire.nodes.length > 2_000_000 ||
    !wire.nodes.length ||
    wire.root !== wire.nodes.length - 1
  )
    return invalid();
  const { shapes, nodes } = wire;
  for (const keys of shapes)
    if (
      !Array.isArray(keys) ||
      keys.length > 1000 ||
      keys.some((k) => typeof k !== 'string' || forbiddenKeys.has(k)) ||
      new Set(keys).size !== keys.length
    )
      return invalid();
  const decoded: unknown[] = [];
  for (const [index, node] of nodes.entries()) {
    if (
      node === null ||
      typeof node === 'string' ||
      typeof node === 'boolean' ||
      (typeof node === 'number' && Number.isFinite(node))
    ) {
      decoded.push(node);
      continue;
    }
    if (
      !Array.isArray(node) ||
      node.length !== 2 ||
      !Number.isInteger(node[0]) ||
      node[0] < 0 ||
      node[0] > shapes.length ||
      !Array.isArray(node[1]) ||
      node[1].some((ref) => !Number.isInteger(ref) || ref < 0 || ref >= index)
    )
      return invalid();
    const [shape, refs] = node;
    if (shape === 0) decoded.push(Object.freeze(refs.map((ref) => decoded[ref])));
    else {
      const keys = shapes[shape - 1]!;
      if (keys.length !== refs.length) return invalid();
      decoded.push(
        Object.freeze(Object.fromEntries(keys.map((key, i) => [key, decoded[refs[i]!]]))),
      );
    }
  }
  const root = decoded[wire.root!];
  if (!root || typeof root !== 'object' || Array.isArray(root)) return invalid();
  const catalog = root as Catalog;
  if (
    catalog.schemaVersion !== 1 ||
    !Array.isArray(catalog.cars) ||
    !Array.isArray(catalog.sources) ||
    typeof catalog.reviewedAt !== 'string'
  )
    return invalid();
  return catalog;
}
