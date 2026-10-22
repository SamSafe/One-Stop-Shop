import data from '../data/catalog.json';
import snapshot from '../data/nrcan.json';
import links from '../data/retail-rating-links.json';
import subaruData from '../data/manufacturers/subaru.json';
import tciData from '../data/manufacturers/tci.json';
import hondaData from '../data/manufacturers/honda.json';
import fordData from '../data/manufacturers/ford.json';
import mazdaData from '../data/manufacturers/mazda.json';
import hyundaiData from '../data/manufacturers/hyundai.json';
import kiaData from '../data/manufacturers/kia.json';
import gmData from '../data/manufacturers/gm.json';
import nissanData from '../data/manufacturers/nissan.json';
import volkswagenData from '../data/manufacturers/volkswagen.json';
import mitsubishiData from '../data/manufacturers/mitsubishi.json';
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
import { validateKiaSnapshot } from './kia-import';
import { addKiaRetail } from './kia';
import { validateGmSnapshot } from './gm-import';
import { addGmRetail } from './gm';
import { validateNissanSnapshot } from './nissan-import';
import { addNissanRetail } from './nissan';
import { validateVwSnapshot } from './volkswagen-import';
import { addVolkswagenRetail } from './volkswagen';
import { validateMitsubishiSnapshot } from './mitsubishi-import';
import { addMitsubishiRetail } from './mitsubishi';

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
export const kiaSnapshot = validateKiaSnapshot(kiaData);
export const gmSnapshot = validateGmSnapshot(gmData);
export const nissanSnapshot = validateNissanSnapshot(nissanData);
export const volkswagenSnapshot = validateVwSnapshot(volkswagenData);
export const mitsubishiSnapshot = validateMitsubishiSnapshot(mitsubishiData);
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
const previousRetailCatalog = addKiaRetail(
  addHyundaiRetail(previouslyImportedRetail, hyundaiSnapshot),
  kiaSnapshot,
);
const previouslyAddedRetail = addNissanRetail(
  addGmRetail(previousRetailCatalog, gmSnapshot),
  nissanSnapshot,
);
export const retailCatalog = addMitsubishiRetail(
  addVolkswagenRetail(previouslyAddedRetail, volkswagenSnapshot),
  mitsubishiSnapshot,
);
export const catalog = expandCatalog(retailCatalog, nrcanSnapshot, links);
