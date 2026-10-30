import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintSources, writeBuildManifest } from './release-integrity.mjs';
import { precompress } from './precompress.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const fingerprint = await fingerprintSources(root);
async function run(args) {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`Build step failed (${signal ?? code}): npm ${args.join(' ')}`)),
    );
  });
}
await run(['run', 'validate:catalog']);
await run(['run', 'typecheck']);
await run(['run', 'build', '--workspace', '@oss/web']);
await precompress(path.join(root, 'dist'));
const manifest = await writeBuildManifest(root, fingerprint);
console.log(
  `Release integrity recorded: ${Object.keys(manifest.files).length} files, source ${manifest.sourceFingerprint.slice(0, 12)}.`,
);
