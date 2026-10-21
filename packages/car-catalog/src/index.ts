import data from '../data/catalog.json';
import snapshot from '../data/nrcan.json';
import links from '../data/retail-rating-links.json';
import subaruData from '../data/manufacturers/subaru.json';
import tciData from '../data/manufacturers/tci.json';
import { validateCatalog } from './schema';
import { validateNrcanSnapshot } from './nrcan-schema';
import { expandCatalog } from './expand';
import { addSubaruRetail } from './subaru';
import { validateSubaruSnapshot } from './subaru-import';
import { validateTciSnapshot } from './tci-import';
import { addTciRetail } from './tci';

export * from './schema';
export { ratingUrl } from './expand';
export const nrcanSnapshot = validateNrcanSnapshot(snapshot);
export const curatedCatalog = validateCatalog(data);
export const subaruSnapshot = validateSubaruSnapshot(subaruData);
export const tciSnapshot = validateTciSnapshot(tciData);
export const retailCatalog = addTciRetail(
  addSubaruRetail(curatedCatalog, subaruSnapshot),
  tciSnapshot,
);
export const catalog = expandCatalog(retailCatalog, nrcanSnapshot, links);
