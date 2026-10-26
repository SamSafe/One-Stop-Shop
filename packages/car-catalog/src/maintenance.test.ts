import { it, expect } from 'vitest';
import { maintenanceGuidance, ownerResources } from './maintenance';
it('qualifies Toyota guidance to the 2025 Canadian supplement and a visit rather than an oil interval', () => {
  expect(maintenanceGuidance({ make: 'Toyota', model: 'Corolla', year: 2025 })).toMatchObject({
    reminder: { km: 8000, months: 6 },
  });
  expect(maintenanceGuidance({ make: 'Toyota', model: 'Corolla', year: 2026 })).toBeNull();
});
it('keeps Honda Maintenance Minder distinct from distance intervals and unsupported model years', () => {
  expect(maintenanceGuidance({ make: 'Honda', model: 'CR-V Hybrid', year: 2025 })).toMatchObject({
    title: 'Honda Canada · Maintenance Minder A/0',
  });
  expect(
    maintenanceGuidance({ make: 'Honda', model: 'CR-V', year: 2025 })?.reminder,
  ).toBeUndefined();
  expect(maintenanceGuidance({ make: 'Honda', model: 'Prologue', year: 2025 })).toBeNull();
  expect(maintenanceGuidance({ make: 'Honda', model: 'CR-V', year: 2016 })).toBeNull();
  expect(ownerResources('Unknown')).toBeNull();
});

it('uses only the Canadian 2016 Elantra sedan severe-use oil schedule, with separate specs and documents', () => {
  const g = maintenanceGuidance({ make: 'Hyundai', model: 'Elantra', year: 2016 });
  expect(g?.reminder).toMatchObject({ km: 6000, months: 6 });
  expect(g?.documents).toHaveLength(2);
  expect(g?.specifications?.[0]?.value).toBe('4.0 L');
  expect(maintenanceGuidance({ make: 'Hyundai', model: 'Elantra GT', year: 2016 })).toBeNull();
  expect(maintenanceGuidance({ make: 'Hyundai', model: 'Elantra', year: 2017 })).toBeNull();
});
