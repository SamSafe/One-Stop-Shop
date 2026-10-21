import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { cp, copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeFiles, verifyBuiltRelease } from './release-integrity.mjs';

// Package locally only. This command never pushes source or contacts a host.
const root = fileURLToPath(new URL('..', import.meta.url));
const exec = promisify(execFile);
async function assertSource(expected) {
  const { stdout: head } = await exec('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  const { stdout: status } = await exec('git', ['status', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (status.trim())
    throw new Error('Commit or preserve outstanding changes before packaging a release.');
  if (expected && head.trim() !== expected)
    throw new Error('Source commit changed while packaging.');
  return head.trim();
}
const sourceCommit = await assertSource();
const release = await verifyBuiltRelease(root, { verifySource: true });
const output = path.join(root, 'artifacts');
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(path.join(tmpdir(), 'oss-release-'));
const staging = path.join(temporary, 'oss');
const metadata = {
  version: release.version,
  sourceCommit,
  sourceFingerprint: release.sourceFingerprint,
  builtAt: new Date().toISOString(),
  market: 'Canada',
  catalogReviewedAt: JSON.parse(
    await readFile(path.join(root, 'packages/car-catalog/data/catalog.json'), 'utf8'),
  ).reviewedAt,
  publication: 'local-only; external publication awaits explicit approval',
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function manifest(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const lines = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) lines.push(...(await manifest(file, relative)));
    else if (entry.isFile()) lines.push(`${hash(await readFile(file))}  ${relative}`);
    else throw new Error(`Unexpected non-file artifact: ${relative}`);
  }
  return lines;
}

try {
  await mkdir(path.join(staging, 'scripts'), { recursive: true });
  await cp(path.join(root, 'dist'), path.join(staging, 'dist'), { recursive: true });
  for (const filename of runtimeFiles)
    await cp(path.join(root, filename), path.join(staging, filename));
  await writeFile(
    path.join(staging, 'package.json'),
    JSON.stringify(
      {
        name: 'oss-production-release',
        private: true,
        version: metadata.version,
        type: 'module',
        engines: { node: '>=22.12.0 <25' },
        scripts: { start: 'node scripts/serve.mjs' },
      },
      null,
      2,
    ) + '\n',
  );
  await writeFile(path.join(staging, 'RELEASE.json'), JSON.stringify(metadata, null, 2) + '\n');
  await writeFile(
    path.join(staging, 'README.txt'),
    'OSS Canadian comparison release\n\nRequires Node 22.12+ or Node 24. No npm install is required.\nRun: node scripts/serve.mjs\nDefault: http://localhost:8080 ; configure HOST and PORT as needed.\nUse HTTPS at your reverse proxy for public production hosting.\n\nVerify files with: sha256sum -c SHA256SUMS\nFull operation/rollback/source instructions are in the source repository docs.\n',
  );
  await writeFile(path.join(staging, 'SHA256SUMS'), (await manifest(staging)).join('\n') + '\n');
  await verifyBuiltRelease(staging);
  await verifyBuiltRelease(root, { verifySource: true });
  await assertSource(sourceCommit);
  const temporaryArchive = path.join(temporary, 'release.tgz');
  await exec('tar', ['-czf', temporaryArchive, '-C', temporary, 'oss']);
  await assertSource(sourceCommit);
  const sha256 = hash(await readFile(temporaryArchive));
  const filename = `oss-v${release.version}-${sourceCommit.slice(0, 8)}-${sha256.slice(0, 12)}.tgz`;
  const archive = path.join(output, filename);
  try {
    await copyFile(temporaryArchive, archive, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== 'EEXIST' || hash(await readFile(archive)) !== sha256) throw error;
  }
  await writeFile(`${archive}.sha256`, `${sha256}  ${filename}\n`);
  const receipt = { ...metadata, archive, sha256 };
  await writeFile(
    path.join(output, 'release-receipt.json'),
    JSON.stringify(receipt, null, 2) + '\n',
  );
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
