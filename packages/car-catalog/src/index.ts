import data from '../data/catalog.json';
import snapshot from '../data/nrcan.json';
import links from '../data/retail-rating-links.json';
import { validateCatalog } from './schema';
import { validateNrcanSnapshot } from './nrcan-schema';
import { expandCatalog } from './expand';

export * from './schema';
export { ratingUrl } from './expand';
export const nrcanSnapshot = validateNrcanSnapshot(snapshot);
export const retailCatalog = validateCatalog(data);
export const catalog = expandCatalog(retailCatalog, nrcanSnapshot, links);
