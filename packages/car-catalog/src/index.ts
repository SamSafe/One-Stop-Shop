import data from '../data/catalog.json';
import snapshot from '../data/nrcan.json';
import links from '../data/retail-rating-links.json';
import subaruData from '../data/manufacturers/subaru.json';
import tciData from '../data/manufacturers/tci.json';
import hondaData from '../data/manufacturers/honda.json';
import fordData from '../data/manufacturers/ford.json';
import mazdaData from '../data/manufacturers/mazda.json';
import hyundaiData from '../data/manufacturers/hyundai.json';
import { validateCatalog } from './schema';
import { validateNrcanSnapshot } from './nrcan-schema';
import { expandCatalog } from './expand';
import { addSubaruRetail } from './subaru';
import { validateSubaruSnapshot } from './subaru-import';
import { validateTciSnapshot } from './tci-import';
import { addTciRetail } from './tci';
import { addHondaRetail } from './honda';
import { validateHondaSnapshot } from './honda-import';
import { validateFordSnapshot } from './ford-import';
import { addFordRetail } from './ford';
import { addMazdaRetail } from './mazda';
import { validateMazdaSnapshot } from './mazda-import';
import { validateHyundaiSnapshot } from './hyundai-import';
import { addHyundaiRetail } from './hyundai';

export * from './schema';
export { ratingUrl } from './expand';
export const nrcanSnapshot = validateNrcanSnapshot(snapshot);
export const curatedCatalog = validateCatalog(data);
export const subaruSnapshot = validateSubaruSnapshot(subaruData);
export const tciSnapshot = validateTciSnapshot(tciData);
export const hondaSnapshot = validateHondaSnapshot(hondaData);
export const fordSnapshot = validateFordSnapshot(fordData);
export const mazdaSnapshot = validateMazdaSnapshot(mazdaData);
export const hyundaiSnapshot = validateHyundaiSnapshot(hyundaiData);
const previouslyImportedRetail = addMazdaRetail(
  addFordRetail(
    addHondaRetail(
      addTciRetail(addSubaruRetail(curatedCatalog, subaruSnapshot), tciSnapshot),
      hondaSnapshot,
    ),
    fordSnapshot,
  ),
  mazdaSnapshot,
);
export const retailCatalog = addHyundaiRetail(previouslyImportedRetail, hyundaiSnapshot);
export const catalog = expandCatalog(retailCatalog, nrcanSnapshot, links);
