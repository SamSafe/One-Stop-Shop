import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Package locally only. This command never pushes source or contacts a host.
const root = fileURLToPath(new URL('..', import.meta.url));
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const status = execFileSync('git', ['status', '--porcelain'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
if (status) throw new Error('Commit or preserve outstanding changes before packaging a release.');
const output = path.join(root, 'artifacts');
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(path.join(tmpdir(), 'oss-release-'));
const staging = path.join(temporary, 'oss');
const filename = `oss-v1.0.0-${sourceCommit.slice(0, 8)}.tgz`;
const archive = path.join(output, filename);
const metadata = {
  version: '1.0.0',
  sourceCommit,
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
  await cp(path.join(root, 'scripts/serve.mjs'), path.join(staging, 'scripts/serve.mjs'));
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
  execFileSync('tar', ['-czf', archive, '-C', temporary, 'oss']);
  const sha256 = hash(await readFile(archive));
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
