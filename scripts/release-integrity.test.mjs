import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fingerprintSources,
  manifestName,
  releaseIsReady,
  sourceInputs,
  verifyBuiltRelease,
  writeBuildManifest,
} from './release-integrity.mjs';

const temporary = [];
const repository = fileURLToPath(new URL('..', import.meta.url));
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'oss-integrity-test-'));
  temporary.push(root);
  for (const name of sourceInputs) {
    if (name === 'apps/oss' || name === 'packages/car-catalog') {
      await mkdir(path.join(root, name), { recursive: true });
      await writeFile(path.join(root, name, 'input.txt'), 'source');
    } else {
      await mkdir(path.dirname(path.join(root, name)), { recursive: true });
      const content = name === 'package.json' ? '{"version":"1.2.3"}' : 'source';
      await writeFile(path.join(root, name), content);
    }
  }
  for (const name of ['scripts/serve.mjs', 'scripts/release-integrity.mjs'])
    await cp(path.join(repository, name), path.join(root, name));
  await mkdir(path.join(root, 'dist/assets'), { recursive: true });
  await writeFile(path.join(root, 'dist/index.html'), '<script src="/assets/app.js"></script>');
  await writeFile(path.join(root, 'dist/assets/app.js'), 'console.log("release")');
  await writeFile(path.join(root, 'dist/healthz'), '{"status":"ok"}');
  return root;
}
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('production release integrity', () => {
  it('verifies build files, runtime helpers and the source snapshot', async () => {
    const root = await fixture();
    const manifest = await writeBuildManifest(root, await fingerprintSources(root));
    expect((await verifyBuiltRelease(root, { verifySource: true })).version).toBe('1.2.3');
    expect(await releaseIsReady(root, manifest)).toBe(true);
  });

  it.each(['changed', 'added', 'removed'])('rejects %s build files', async (operation) => {
    const root = await fixture();
    await writeBuildManifest(root);
    if (operation === 'changed') await writeFile(path.join(root, 'dist/assets/app.js'), 'tampered');
    if (operation === 'added')
      await writeFile(path.join(root, 'dist/debug.json'), '{"internal":true}');
    if (operation === 'removed') await rm(path.join(root, 'dist/assets/app.js'));
    await expect(verifyBuiltRelease(root)).rejects.toThrow(/integrity check failed/);
  });

  it('rejects a build made from different source even when Git could be clean', async () => {
    const root = await fixture();
    await writeBuildManifest(root);
    await writeFile(path.join(root, 'apps/oss/input.txt'), 'new committed source');
    await expect(verifyBuiltRelease(root, { verifySource: true })).rejects.toThrow(
      'does not match the current source',
    );
  });

  it('refuses to attest a build whose source changed while it ran', async () => {
    const root = await fixture();
    const before = await fingerprintSources(root);
    await writeFile(path.join(root, 'apps/oss/input.txt'), 'changed during build');
    await expect(writeBuildManifest(root, before)).rejects.toThrow(
      'Sources changed during the build',
    );
  });

  it('rejects a mismatched production server', async () => {
    const root = await fixture();
    await writeBuildManifest(root);
    await writeFile(path.join(root, 'scripts/serve.mjs'), 'different runtime');
    await expect(verifyBuiltRelease(root)).rejects.toThrow(
      'runtime file scripts/serve.mjs changed',
    );
  });

  it('fails readiness if an asset disappears or its size changes after startup', async () => {
    const root = await fixture();
    const manifest = await writeBuildManifest(root);
    await writeFile(path.join(root, 'dist/assets/app.js'), 'broken');
    expect(await releaseIsReady(root, manifest)).toBe(false);
    await rm(path.join(root, 'dist/assets/app.js'));
    expect(await releaseIsReady(root, manifest)).toBe(false);
  });

  it('rejects unsafe manifest paths before opening files', async () => {
    const root = await fixture();
    const manifest = await writeBuildManifest(root);
    manifest.files['../outside'] = manifest.files['index.html'];
    await writeFile(path.join(root, 'dist', manifestName), JSON.stringify(manifest));
    await expect(verifyBuiltRelease(root)).rejects.toThrow('Invalid build manifest entry');
  });

  it('rejects HTML with missing asset references', async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, 'dist/index.html'),
      '<script src="/assets/absent.js"></script>',
    );
    await expect(writeBuildManifest(root)).rejects.toThrow('absent release asset');
  });

  it('rejects symlinks rather than silently packaging files outside the release', async () => {
    const root = await fixture();
    await symlink(path.join(root, 'package.json'), path.join(root, 'dist/linked.json'));
    await expect(writeBuildManifest(root)).rejects.toThrow('regular files');
  });

  it('allows a standalone release without source files or Git metadata', async () => {
    const root = await fixture();
    await writeBuildManifest(root);
    await rm(path.join(root, 'apps'), { recursive: true });
    await rm(path.join(root, 'packages'), { recursive: true });
    expect((await verifyBuiltRelease(root)).schemaVersion).toBe(1);
    expect(
      JSON.parse(await readFile(path.join(root, 'dist', manifestName), 'utf8')).sourceFingerprint,
    ).toMatch(/^[a-f0-9]{64}$/);
  });
});
