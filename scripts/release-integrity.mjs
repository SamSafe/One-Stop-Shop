import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

export const manifestName = 'build-manifest.json';
export const runtimeFiles = ['scripts/serve.mjs', 'scripts/release-integrity.mjs'];
export const sourceInputs = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'apps/oss',
  'packages/car-catalog',
  'scripts/build.mjs',
  'scripts/serve.mjs',
  'scripts/release-integrity.mjs',
  'scripts/package-release.mjs',
];

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const safePath = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  !/[\\\0\r\n]/.test(value) &&
  !path.posix.isAbsolute(value) &&
  value.split('/').every((part) => part && part !== '.' && part !== '..');

async function digestFile(filename) {
  const bytes = await readFile(filename);
  return { bytes: bytes.length, sha256: hash(bytes) };
}

async function collect(directory, prefix = '', skipDependencies = false) {
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    if (skipDependencies && ['node_modules', '.git', 'dist'].includes(entry.name)) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!safePath(relative)) throw new Error(`Invalid artifact path: ${relative}`);
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await collect(filename, relative, skipDependencies)));
    else if (entry.isFile()) result.push([relative, await digestFile(filename)]);
    else throw new Error(`Release inputs must be regular files: ${relative}`);
  }
  return result;
}

export async function fingerprintSources(root) {
  const inputs = [];
  for (const input of sourceInputs) {
    const filename = path.join(root, input);
    const info = await stat(filename);
    if (info.isDirectory()) inputs.push(...(await collect(filename, input, true)));
    else inputs.push([input, await digestFile(filename)]);
  }
  return hash(JSON.stringify(inputs));
}

function validateManifest(manifest) {
  if (
    !isRecord(manifest) ||
    manifest.schemaVersion !== 1 ||
    typeof manifest.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?(?:\+[\da-zA-Z.-]+)?$/.test(manifest.version) ||
    typeof manifest.sourceFingerprint !== 'string' ||
    !/^[a-f0-9]{64}$/.test(manifest.sourceFingerprint) ||
    !isRecord(manifest.files) ||
    !isRecord(manifest.runtimeFiles)
  ) {
    throw new Error('Invalid build manifest. Run npm run build.');
  }
  for (const entries of [manifest.files, manifest.runtimeFiles]) {
    if (Object.keys(entries).length > 2000) throw new Error('Build manifest is too large.');
    for (const [name, record] of Object.entries(entries)) {
      if (
        !safePath(name) ||
        !isRecord(record) ||
        !Number.isSafeInteger(record.bytes) ||
        record.bytes < 0 ||
        typeof record.sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(record.sha256)
      ) {
        throw new Error(`Invalid build manifest entry: ${name}`);
      }
    }
  }
  if (
    JSON.stringify(Object.keys(manifest.runtimeFiles).sort()) !==
      JSON.stringify([...runtimeFiles].sort()) ||
    !Object.hasOwn(manifest.files, 'index.html') ||
    !Object.hasOwn(manifest.files, 'healthz') ||
    Object.hasOwn(manifest.files, manifestName)
  ) {
    throw new Error('Build manifest is missing required release files.');
  }
  return manifest;
}

async function assertHtmlReferences(root, files) {
  const html = await readFile(path.join(root, 'dist/index.html'), 'utf8');
  for (const match of html.matchAll(/\b(?:src|href)=["'](\/[^"']+)["']/g)) {
    const name = match[1].slice(1).split(/[?#]/)[0];
    if (!safePath(name) || !Object.hasOwn(files, name)) {
      throw new Error(`HTML references an absent release asset: ${name}`);
    }
  }
}

export async function writeBuildManifest(root, expectedFingerprint) {
  const sourceFingerprint = await fingerprintSources(root);
  if (expectedFingerprint && sourceFingerprint !== expectedFingerprint) {
    throw new Error('Sources changed during the build. Rebuild the committed source.');
  }
  const files = Object.fromEntries(
    (await collect(path.join(root, 'dist'))).filter(([name]) => name !== manifestName),
  );
  const runtime = Object.fromEntries(
    await Promise.all(
      runtimeFiles.map(async (name) => [name, await digestFile(path.join(root, name))]),
    ),
  );
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const manifest = validateManifest({
    schemaVersion: 1,
    version,
    sourceFingerprint,
    runtimeFiles: runtime,
    files,
  });
  await assertHtmlReferences(root, files);
  if ((await fingerprintSources(root)) !== sourceFingerprint)
    throw new Error('Sources changed during the build.');
  const filename = path.join(root, 'dist', manifestName);
  await writeFile(`${filename}.tmp`, JSON.stringify(manifest, null, 2) + '\n');
  await rename(`${filename}.tmp`, filename);
  return manifest;
}

export async function verifyBuiltRelease(root, { verifySource = false } = {}) {
  let manifest;
  try {
    manifest = validateManifest(
      JSON.parse(await readFile(path.join(root, 'dist', manifestName), 'utf8')),
    );
  } catch (error) {
    throw new Error(`Build integrity check failed: ${error.message}`, { cause: error });
  }
  const actual = Object.fromEntries(
    (await collect(path.join(root, 'dist'))).filter(([name]) => name !== manifestName),
  );
  if (
    JSON.stringify(Object.keys(actual).sort()) !==
    JSON.stringify(Object.keys(manifest.files).sort())
  ) {
    throw new Error('Build integrity check failed: release file list changed.');
  }
  for (const [name, expected] of Object.entries(manifest.files)) {
    const found = actual[name];
    if (found.bytes !== expected.bytes || found.sha256 !== expected.sha256) {
      throw new Error(`Build integrity check failed: ${name} changed.`);
    }
  }
  for (const [name, expected] of Object.entries(manifest.runtimeFiles)) {
    const actual = await digestFile(path.join(root, name));
    if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) {
      throw new Error(`Build integrity check failed: runtime file ${name} changed.`);
    }
  }
  await assertHtmlReferences(root, manifest.files);
  if (verifySource && (await fingerprintSources(root)) !== manifest.sourceFingerprint) {
    throw new Error('Build does not match the current source. Run npm run build.');
  }
  return manifest;
}

export async function releaseIsReady(root, manifest) {
  try {
    return (
      await Promise.all(
        Object.entries(manifest.files).map(async ([name, expected]) => {
          const info = await stat(path.join(root, 'dist', name));
          return info.isFile() && info.size === expected.bytes;
        }),
      )
    ).every(Boolean);
  } catch {
    return false;
  }
}
