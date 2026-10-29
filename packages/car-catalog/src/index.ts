import landroverData from '../data/manufacturers/landrover.json';
import { validateLandroverSnapshot } from './landrover-import';
import { addLandroverRetail } from './landrover';
import data from '../data/catalog.json';
import snapshot from '../data/nrcan.json';
import links from '../data/retail-rating-links.json';
import reviewedLinks from '../data/reviewed-rating-links.json';
import reviewedSpecifications from '../data/reviewed-specifications.json';
import { addReviewedSpecifications } from './reviewed-specifications';
import subaruData from '../data/manufacturers/subaru.json';
import subaruSpecificationsData from '../data/manufacturers/subaru-specifications.json';
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
import polestarData from '../data/manufacturers/polestar.json';
import bmwData from '../data/manufacturers/bmw.json';
import miniData from '../data/manufacturers/mini.json';
import genesisData from '../data/manufacturers/genesis.json';
import rivianData from '../data/manufacturers/rivian.json';
import lucidData from '../data/manufacturers/lucid.json';
import mercedesData from '../data/manufacturers/mercedes.json';
import mercedesVansData from '../data/manufacturers/mercedes-vans.json';
import vinfastData from '../data/manufacturers/vinfast.json';
import porscheData from '../data/manufacturers/porsche.json';
import astonData from '../data/manufacturers/aston-martin.json';
import mclarenData from '../data/manufacturers/mclaren.json';
import { validateCatalog } from './schema';
import { validateNrcanSnapshot } from './nrcan-schema';
import { expandCatalog, reviewedRatingLinksSchema } from './expand';
import { addSubaruRetail } from './subaru';
import { validateSubaruSnapshot } from './subaru-import';
import { validateSubaruSpecifications } from './subaru-specifications-import';
import { addSubaruSpecifications, assertSubaruRatingEvidence } from './subaru-specifications';
import { validateTciSnapshot } from './tci-import';
import { addTciRetail } from './tci';
import { addHondaRetail, hondaRecordId, hondaSpecifications } from './honda';
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
import { validatePolestarSnapshot } from './polestar-import';
import { addPolestarRetail } from './polestar';
import { validateBmwSnapshot } from './bmw-import';
import { addBmwRetail } from './bmw';
import { validateMiniSnapshot } from './mini-import';
import { addMiniRetail } from './mini';
import { validateGenesisSnapshot } from './genesis-import';
import { addGenesisRetail } from './genesis';
import { validateRivianSnapshot } from './rivian-import';
import { addRivianRetail } from './rivian';
import { validateLucidSnapshot } from './lucid-import';
import { addLucidRetail } from './lucid';
import { validateMercedesSnapshot } from './mercedes-import';
import { addMercedesRetail } from './mercedes';
import { validateMercedesVanStockSnapshot } from './mercedes-vans-import';
import { addMercedesVanStock } from './mercedes-vans';
import { validateVinfastSnapshot } from './vinfast-import';
import { addVinfastOffers } from './vinfast';
import { validatePorscheSnapshot } from './porsche-import';
import { addPorscheRetail } from './porsche';
import { validateAstonSnapshot } from './aston-martin-import';
import { addAstonOffers } from './aston-martin';
import { validateMclarenSnapshot } from './mclaren-import';
import { addMclarenRetail } from './mclaren';

export * from './schema';
export { ratingUrl } from './expand';
export const nrcanSnapshot = validateNrcanSnapshot(snapshot);
export const governmentRatingCount = nrcanSnapshot.records.length;
export const curatedCatalog = validateCatalog(data);
export const subaruSnapshot = validateSubaruSnapshot(subaruData);
export const subaruSpecificationsSnapshot = validateSubaruSpecifications(
  subaruSpecificationsData,
  subaruSnapshot,
);
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
export const polestarSnapshot = validatePolestarSnapshot(polestarData);
export const bmwSnapshot = validateBmwSnapshot(bmwData);
export const miniSnapshot = validateMiniSnapshot(miniData);
export const genesisSnapshot = validateGenesisSnapshot(genesisData);
export const rivianSnapshot = validateRivianSnapshot(rivianData);
export const lucidSnapshot = validateLucidSnapshot(lucidData);
export const mercedesSnapshot = validateMercedesSnapshot(mercedesData);
export const mercedesVanStockSnapshot = validateMercedesVanStockSnapshot(
  mercedesVansData,
  mercedesSnapshot,
);
export const vinfastSnapshot = validateVinfastSnapshot(vinfastData);
export const porscheSnapshot = validatePorscheSnapshot(porscheData);
export const astonSnapshot = validateAstonSnapshot(astonData);
export const mclarenSnapshot = validateMclarenSnapshot(mclarenData);
const previouslyImportedRetail = addMazdaRetail(
  addFordRetail(
    addHondaRetail(
      addTciRetail(
        addSubaruSpecifications(
          addSubaruRetail(curatedCatalog, subaruSnapshot),
          subaruSpecificationsSnapshot,
        ),
        tciSnapshot,
      ),
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
const bmwRetailCatalog = addBmwRetail(
  addPolestarRetail(
    addMitsubishiRetail(
      addVolkswagenRetail(previouslyAddedRetail, volkswagenSnapshot),
      mitsubishiSnapshot,
    ),
    polestarSnapshot,
  ),
  bmwSnapshot,
);
const rivianRetailCatalog = addRivianRetail(
  addGenesisRetail(addMiniRetail(bmwRetailCatalog, miniSnapshot), genesisSnapshot),
  rivianSnapshot,
);
const previouslyListedRetail = addMercedesVanStock(
  addMercedesRetail(addLucidRetail(rivianRetailCatalog, lucidSnapshot), mercedesSnapshot),
  mercedesVanStockSnapshot,
);
const beforeLandrover = addMclarenRetail(
  addAstonOffers(
    addVinfastOffers(addPorscheRetail(previouslyListedRetail, porscheSnapshot), vinfastSnapshot),
    astonSnapshot,
  ),
  mclarenSnapshot,
);
export const landroverSnapshot = validateLandroverSnapshot(landroverData);
export const manufacturerCatalog = addReviewedSpecifications(
  addLandroverRetail(beforeLandrover, landroverSnapshot),
  reviewedSpecifications,
);
export const retailCatalog = validateCatalog({
  ...manufacturerCatalog,
  cars: manufacturerCatalog.cars.filter((car) => car.recordKind === 'retail-trim'),
});
// An audited engine quotation must still match its checked manufacturer capture.
// A future source change requires another review, even if consumption is unchanged.
for (const link of reviewedRatingLinksSchema.parse(reviewedLinks).links) {
  if (link.evidenceProvider === 'subaru-specifications') {
    assertSubaruRatingEvidence(retailCatalog.cars, subaruSpecificationsSnapshot, link);
    continue;
  }
  const record = hondaSnapshot.records.find((record) => hondaRecordId(record) === link.retailId);
  if (
    !record ||
    hondaSpecifications(record).find((spec) => spec.label === 'Engine type')?.value !==
      link.engineEvidence
  )
    throw new Error(`Review the manufacturer engine evidence for ${link.retailId}.`);
}
export const catalog = expandCatalog(manufacturerCatalog, nrcanSnapshot, links, reviewedLinks);
