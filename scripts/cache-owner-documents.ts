import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { ownerDocuments } from '../packages/car-catalog/src/maintenance.ts';
const folder = 'data/raw/maintenance',
  profileAt = process.argv.indexOf('--profile'),
  profile = profileAt < 0 ? '' : process.argv[profileAt + 1];
if (!profile || !ownerDocuments.some((d) => d.profile === profile))
  throw new Error('Choose an indexed Canadian profile: --profile hyundai-elantra-2016-ca');
const offline = process.argv.includes('--offline'),
  refresh = process.argv.includes('--refresh');
if (offline && refresh) throw new Error('--offline and --refresh are mutually exclusive.');
const target = `${folder}/document-cache.json`;
await mkdir(folder, { recursive: true });
let cache: Record<string, { etag?: string; checkedAt: string }> = {};
try {
  cache = JSON.parse(await readFile(target, 'utf8'));
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
for (const doc of ownerDocuments.filter((d) => d.profile === profile)) {
  const file = `${folder}/${doc.sha256}`;
  let cached = false;
  try {
    const b = await readFile(file);
    if (b.length !== doc.bytes || createHash('sha256').update(b).digest('hex') !== doc.sha256)
      throw new Error(`Cached document checksum differs: ${doc.id}`);
    cached = true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  if (offline && !cached) throw new Error(`Document is not cached: ${doc.id}`);
  if (cached && !refresh) {
    console.log(`${doc.id}: checksum verified; reused cached chapter.`);
    continue;
  }
  const url = new URL(doc.url);
  if (
    url.origin !== 'https://www.hyundaicanada.com' ||
    !url.pathname.startsWith('/content/dam/hac/') ||
    !url.pathname.endsWith('.pdf')
  )
    throw new Error('Unreviewed document origin/path.');
  const etag = cache[doc.id]?.etag;
  const r = await fetch(doc.url, {
    redirect: 'error',
    headers: cached && etag ? { 'If-None-Match': etag } : {},
    signal: AbortSignal.timeout(45000),
  });
  if (r.status === 304) {
    if (!cached) throw new Error('Document 304 without a verified cached body.');
    cache[doc.id] = { ...cache[doc.id], checkedAt: new Date().toISOString() };
    console.log(`${doc.id}: publisher reports unchanged.`);
    continue;
  }
  if (r.status !== 200 || !r.body) throw new Error(`Document retrieval failed: HTTP ${r.status}`);
  const reader = r.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 20000000) throw new Error('Document exceeds the 20 MB retrieval bound.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks),
    sha = createHash('sha256').update(bytes).digest('hex');
  if (bytes.subarray(0, 5).toString() !== '%PDF-')
    throw new Error('Publisher returned a non-PDF response.');
  if (sha !== doc.sha256 || size !== doc.bytes)
    throw new Error(
      `Publisher document changed (${doc.id}, SHA-256 ${sha}). Review the new revision before changing accepted guidance.`,
    );
  await writeFile(`${file}.tmp`, bytes);
  await rename(`${file}.tmp`, file);
  cache[doc.id] = {
    ...(r.headers.get('etag') ? { etag: r.headers.get('etag')! } : {}),
    checkedAt: new Date().toISOString(),
  };
  console.log(`${doc.id}: retrieved and verified ${size} bytes.`);
}
if (!offline) {
  await writeFile(`${target}.tmp`, JSON.stringify(cache, null, 2) + '\n');
  await rename(`${target}.tmp`, target);
}
