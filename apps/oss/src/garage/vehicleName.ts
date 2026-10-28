import type { OwnedVehicle } from './domain';
export const vehicleName = (v: OwnedVehicle) => v.nickname || `${v.year} ${v.make} ${v.model}`;
