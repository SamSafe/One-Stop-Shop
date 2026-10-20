import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(file)));
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) files.push(file);
  }
  return files;
}

const failures = [];
for (const directory of ['packages/car-catalog', 'apps/oss', 'apps/garage']) {
  for (const file of await walk(directory)) {
    const source = await readFile(file, 'utf8');
    const imports = [
      ...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g),
    ];
    for (const [, specifier] of imports) {
      const resolved = specifier.startsWith('.')
        ? path.resolve(path.dirname(file), specifier)
        : specifier;
      if (
        directory.startsWith('packages/') &&
        /(?:\/apps\/|@oss\/web|@oss\/garage)/.test(resolved)
      ) {
        failures.push(`${file}: catalog imports application ${specifier}`);
      }
      if (
        directory.startsWith('apps/') &&
        /(?:\/apps\/(?:oss|garage)\/|@oss\/(?:web|garage))/.test(resolved) &&
        !resolved.startsWith(path.resolve(directory) + path.sep)
      ) {
        failures.push(`${file}: app imports another app ${specifier}`);
      }
    }
  }
}
const catalogPackage = JSON.parse(await readFile('packages/car-catalog/package.json', 'utf8'));
if (
  Object.keys(catalogPackage.dependencies ?? {}).some((name) =>
    ['@oss/web', '@oss/garage'].includes(name),
  )
) {
  failures.push('Catalog declares an app dependency.');
}
if (failures.length) throw new Error(failures.join('\n'));
console.log('Package boundaries valid.');
