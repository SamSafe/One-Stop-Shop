import data from '../data/catalog.json';
import { validateCatalog } from './schema';

export * from './schema';
export const catalog = validateCatalog(data);
