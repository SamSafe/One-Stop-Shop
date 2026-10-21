import { z } from 'zod';

export const nrcanEndpoint =
  'https://fcr-prod-appservice-api.azure.cloud.nrcan-rncan.gc.ca/VehiclesPublic';
export const nrcanSearchUrl = 'https://fcr-ccc.nrcan-rncan.gc.ca/en/Search';

// The same public, metric-unit response used by NRCan's vehicle search UI.
// Unused API fields are deliberately stripped; never import personalized costs.
export const nrcanRecordSchema = z.object({
  RecordId: z.number().int().positive(),
  VehicleTypeId: z.enum(['ICE', 'BEV', 'PHEVB', 'PHEVS']),
  Year: z.number().int().min(1990).max(2100),
  Make: z.string().min(1),
  Model: z.string().min(1),
  ClassEn: z.string().min(1),
  EngineSize: z.number().finite().nonnegative(),
  NumOfCylinders: z.number().int().nonnegative(),
  TransmissionEn: z.string().min(1),
  TransmissionId: z.string().min(1),
  FuelEn: z.string().min(1),
  FuelTypeId: z.string().min(1),
  CityGasConsumption: z.number().finite().nonnegative(),
  HwyGasConsumption: z.number().finite().nonnegative(),
  CombGasConsumption: z.number().finite().nonnegative(),
  MotorKw: z.number().finite().nonnegative(),
  CityElectricKwhConsumption: z.number().finite().nonnegative(),
  HwyElectricKwhConsumption: z.number().finite().nonnegative(),
  CombElectricKwhConsumption: z.number().finite().nonnegative(),
  CombElectricLeConsumption: z.number().finite().nonnegative(),
  ElectricModeComb: z.number().finite().nonnegative(),
  RangeElectric: z.number().finite().nonnegative(),
  RangeGas: z.number().finite().nonnegative(),
  RechargeTime: z.number().finite().nonnegative(),
  Co2Emissions: z.number().finite().nonnegative(),
  CityHydrogenConsumption: z.number().finite().nonnegative(),
  HwyHydrogenConsumption: z.number().finite().nonnegative(),
  CombHydrogenConsumption: z.number().finite().nonnegative(),
});
export type NrcanRecord = z.infer<typeof nrcanRecordSchema>;

export const nrcanPageSchema = z.object({
  VehiclesList: z.array(nrcanRecordSchema),
  TotalCountIce: z.number().int().nonnegative(),
  TotalCountBev: z.number().int().nonnegative(),
  TotalCountPhev: z.number().int().nonnegative(),
  NumberOfPagesIce: z.number().int().nonnegative(),
  NumberOfPagesBev: z.number().int().nonnegative(),
  NumberOfPagesPhev: z.number().int().nonnegative(),
});

export const nrcanSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  retrievedAt: z.iso.datetime(),
  modelYears: z.array(z.number().int()).min(1),
  source: z.literal(nrcanEndpoint),
  attribution: z.literal('Natural Resources Canada'),
  license: z.literal('https://open.canada.ca/en/open-government-licence-canada'),
  totals: z.strictObject({ ICE: z.number().int(), BEV: z.number().int(), PHEV: z.number().int() }),
  responses: z.array(
    z.strictObject({
      vehicleType: z.enum(['ICE', 'BEV', 'PHEV']),
      page: z.number().int().positive(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      records: z.number().int().nonnegative(),
    }),
  ),
  records: z.array(nrcanRecordSchema),
});
export type NrcanSnapshot = z.infer<typeof nrcanSnapshotSchema>;

export function ratingType(record: NrcanRecord): 'ICE' | 'BEV' | 'PHEV' {
  return record.VehicleTypeId.startsWith('PHEV') ? 'PHEV' : (record.VehicleTypeId as 'ICE' | 'BEV');
}

export function validateNrcanSnapshot(input: unknown): NrcanSnapshot {
  const result = nrcanSnapshotSchema.parse(input);
  const ids = new Set<number>();
  const counts = { ICE: 0, BEV: 0, PHEV: 0 };
  for (const record of result.records) {
    if (ids.has(record.RecordId)) throw new Error(`Duplicate NRCan record ${record.RecordId}.`);
    if (!result.modelYears.includes(record.Year))
      throw new Error(`Unexpected model year ${record.Year}.`);
    ids.add(record.RecordId);
    counts[ratingType(record)]++;
  }
  for (const type of ['ICE', 'BEV', 'PHEV'] as const) {
    if (counts[type] !== result.totals[type]) {
      throw new Error(
        `Incomplete NRCan ${type}: ${counts[type]} records; expected ${result.totals[type]}.`,
      );
    }
    const pages = result.responses
      .filter((response) => response.vehicleType === type)
      .sort((a, b) => a.page - b.page);
    if (
      pages.some((page, index) => page.page !== index + 1) ||
      pages.reduce((sum, page) => sum + page.records, 0) !== counts[type]
    ) {
      throw new Error(`Incomplete NRCan ${type} response receipts.`);
    }
  }
  return result;
}

export function searchParameters(years: number[], type: 'ICE' | 'BEV' | 'PHEV', page: number) {
  return new URLSearchParams({
    ResultsPerPage: '100',
    VehicleType: type,
    SelectedModelYears: years.join(','),
    SelectedClasses: 'ALL',
    SelectedMakes: 'ALL',
    SelectedModels: 'ALL',
    SelectedTransmissions: 'ALL',
    SelectedFuels: 'ALL',
    SelectedCylinderRanges: 'ALL',
    Units: 'Metric',
    UsePersonalizeValues: 'false',
    PersShowAnnualFuelCost: 'false',
    PersKilometersPerYear: '20000',
    PersPercentageCityDriving: '55',
    PersRegGasoline: '1.6',
    PersPremGasoline: '1.8',
    PersDiesel: '1.7',
    PersElectricity: '0.15',
    PageIndexIce: String(page),
    PageIndexBev: String(page),
    pageIndexPhev: String(page),
    SortBy: 'DefaultSortBy',
    IsAscending: 'true',
  });
}
