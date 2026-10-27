import url from 'virtual:oss-owner-directory-url';
import { unpackOwnerDirectory } from '@oss/car-catalog/owner-directory';
import type { OwnerDirectory } from '@oss/car-catalog/owner-directory';
let pending: Promise<OwnerDirectory> | undefined;
export function loadOwnerDirectory() {
  if (!pending)
    pending = fetch(url, { signal: AbortSignal.timeout(15000) })
      .then(async (r) => {
        if (!r.ok) throw new Error('Vehicle lookup could not be loaded.');
        return unpackOwnerDirectory(await r.json());
      })
      .catch((e) => {
        pending = undefined;
        throw e;
      });
  return pending;
}
