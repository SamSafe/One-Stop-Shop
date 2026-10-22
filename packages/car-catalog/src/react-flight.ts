// Read the public React Flight data as JSON/text. Remote JavaScript is never evaluated.
export function reactFlight(input: string, label = 'React Flight') {
  const chunks: string[] = [];
  for (const match of input.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    const value: unknown = JSON.parse(match[1]!);
    if (Array.isArray(value) && value[0] === 1 && typeof value[1] === 'string')
      chunks.push(value[1]);
  }
  if (input.includes('<html') && !chunks.length)
    throw new Error(`${label} embedded data is missing.`);
  const bytes = new TextEncoder().encode(chunks.length ? chunks.join('') : input);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const rows = new Map<string, unknown>();
  let offset = 0;
  while (offset < bytes.length) {
    if (bytes[offset] === 10) {
      offset++;
      continue;
    }
    const colon = bytes.indexOf(58, offset);
    if (colon < 0) throw new Error(`Truncated ${label} data row.`);
    const key = decoder.decode(bytes.slice(offset, colon));
    if (!/^[0-9a-f]*$/.test(key)) throw new Error(`Invalid ${label} data row ID.`);
    offset = colon + 1;
    if (bytes[offset] === 84) {
      const comma = bytes.indexOf(44, offset);
      const lengthText = decoder.decode(bytes.slice(offset + 1, comma));
      if (comma < 0 || !/^[0-9a-f]+$/.test(lengthText))
        throw new Error(`Invalid ${label} text length.`);
      const length = parseInt(lengthText, 16),
        end = comma + 1 + length;
      if (end > bytes.length) throw new Error(`Truncated ${label} text.`);
      rows.set(key, decoder.decode(bytes.slice(comma + 1, end)));
      offset = end;
    } else {
      const newline = bytes.indexOf(10, offset),
        end = newline < 0 ? bytes.length : newline;
      const value = decoder.decode(bytes.slice(offset, end));
      offset = end + 1;
      // Import, hint and debug rows are protocol metadata, not vehicle data.
      if (/^[A-Z]/.test(value)) continue;
      rows.set(key, JSON.parse(value));
    }
  }
  function resolve(value: unknown, depth = 0): unknown {
    if (depth > 80) throw new Error(`Cyclic ${label} data reference.`);
    if (value === '$undefined') return undefined;
    if (typeof value === 'string') {
      const reference = /^\$([0-9a-f]+)(?::(.+))?$/.exec(value);
      if (reference) {
        if (!rows.has(reference[1]!)) throw new Error(`Missing ${label} data reference.`);
        let target = rows.get(reference[1]!);
        for (const part of reference[2]?.split(':') ?? []) {
          if (Array.isArray(target) && part === 'props' && target[0] === '$') target = target[3];
          else if (target && typeof target === 'object')
            target = (target as Record<string, unknown>)[part];
          else throw new Error(`Invalid ${label} data reference path.`);
        }
        return resolve(target, depth + 1);
      }
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => resolve(item, depth + 1));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, resolve(item, depth + 1)]),
      );
    return value;
  }
  function property(key: string): unknown {
    const found: unknown[] = [];
    function walk(value: unknown) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        const object = value as Record<string, unknown>;
        if (key in object) found.push(object[key]);
        Object.values(object).forEach(walk);
      }
    }
    [...rows.values()].forEach(walk);
    if (!found.length) throw new Error(`${label} data property missing: ${key}`);
    return resolve(found[0]);
  }
  return { rows, resolve, property };
}
