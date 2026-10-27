import ownerData from '../packages/car-catalog/data/owner-directory.json';
import {
  validateOwnerDirectory,
  packOwnerDirectory,
} from '../packages/car-catalog/src/owner-directory-import.ts';
import { catalog, governmentRatingCount } from '../packages/car-catalog/src/index.ts';
import { writeFile } from 'node:fs/promises';
import { encodeRuntimeCatalog, decodeRuntimeCatalog } from '../packages/car-catalog/src/runtime.ts';

const ownerDirectory = packOwnerDirectory(validateOwnerDirectory(ownerData, catalog));
const packed = encodeRuntimeCatalog(catalog);
if (JSON.stringify(decodeRuntimeCatalog(packed)) !== JSON.stringify(catalog))
  throw new Error('The runtime catalog differs from the validated source catalog.');
// A machine-readable result for Vite. Source validation and encoding run in this
// Node/tsx process; no manufacturer code reaches the browser.
const serialized = JSON.stringify({ packed, governmentRatingCount, ownerDirectory });
if (process.argv[2]) await writeFile(process.argv[2], serialized);
else process.stdout.write(serialized);
