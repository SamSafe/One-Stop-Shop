// Reviewed Canadian owner guidance. Directory links are not exact vehicle schedules.
// Keep this module small: browser use must not load ingestion code or complete manuals.
export type ManufacturerReminderKey =
  | 'toyota-2025-visit'
  | 'hyundai-2016-elantra-oil-severe'
  | 'hyundai-2016-elantra-tires'
  | 'hyundai-2016-elantra-lights'
  | 'hyundai-2016-elantra-coolant-check'
  | 'hyundai-2016-elantra-battery'
  | 'hyundai-2016-elantra-rotation';
export interface ManufacturerReminder {
  key: ManufacturerReminderKey;
  title: string;
  km: number;
  months: number;
  label: string;
  setupNote: string;
}
export interface MaintenanceTask extends Omit<ManufacturerReminder, 'km' | 'months'> {
  km: number | null;
  months: number | null;
  sourceUrl: string;
  locator: string;
  reviewedAt: string;
}
export const ownerDocuments = [
  {
    id: 'hyundai-elantra-2016-ca-maintenance',
    profile: 'hyundai-elantra-2016-ca',
    title: '2016 Canadian Elantra · Maintenance',
    url: 'https://www.hyundaicanada.com/content/dam/hac/images/Feature/OwnersSection/Manuals/English/2016/Elantra/MDFL%20CANe%207.pdf',
    sha256: '84ae79797b3f7b43edc29b667cdf651dc9e7acd38b06dac3cd6e6435b083cb50',
    bytes: 10181309,
    reviewedAt: '2026-10-26',
    pages: 91,
  },
  {
    id: 'hyundai-elantra-2016-ca-specifications',
    profile: 'hyundai-elantra-2016-ca',
    title: '2016 Canadian Elantra · Specifications',
    url: 'https://www.hyundaicanada.com/content/dam/hac/images/Feature/OwnersSection/Manuals/English/2016/Elantra/MDFL%20CANe%208.pdf',
    sha256: 'f9bfc645a847c56ee60ed408204c50ad518bb9bb8a0cc63a5bdb781b6ff62c06',
    bytes: 642777,
    reviewedAt: '2026-10-26',
    pages: 7,
  },
] as const;
export interface MaintenanceGuidance {
  title: string;
  note: string;
  sourceTitle: string;
  sourceUrl: string;
  locator: string;
  reviewedAt: string;
  manualsUrl: string;
  reminder?: ManufacturerReminder;
  specifications?: { label: string; value: string; note: string; url: string; locator: string }[];
  documents?: typeof ownerDocuments;
}
export function maintenanceGuidance(vehicle: {
  make: string;
  model: string;
  year: number;
}): MaintenanceGuidance | null {
  const make = vehicle.make.trim().toLowerCase(),
    model = vehicle.model.trim().toLowerCase();
  if (make === 'toyota' && vehicle.year === 2025)
    return {
      title: 'Toyota Canada · 2025 service visits',
      note: 'Toyota specifies a maintenance visit every 6 months or 8,000 km, whichever comes first. This is a general visit cadence, not an oil-change interval or a complete schedule. Use the model-specific schedule for individual tasks and driving conditions.',
      sourceTitle: '2025 Toyota Canada Owner’s Manual Supplement',
      sourceUrl:
        'https://certified.toyota.ca/content/dam/toyota/pdf/2025_owners_supplement_en.pdf#page=25',
      locator: 'Printed page 24 · Required maintenance',
      reviewedAt: '2026-10-26',
      manualsUrl: 'https://www.toyota.ca/en/owners/manuals/',
      reminder: {
        key: 'toyota-2025-visit',
        title: 'Maintenance visit',
        km: 8000,
        months: 6,
        label: 'Toyota Canada · general service visit',
        setupNote:
          'Enter the last completed visit, or the in-service date and starting odometer for a new vehicle.',
      },
    };
  if (make === 'hyundai' && vehicle.year === 2016 && /^elantra(?: gl)?$/.test(model))
    return {
      title: '2016 Elantra · Canadian maintenance',
      note: 'The Canadian manual specifies oil and filter replacement every 6,000 km or 6 months under severe use, whichever comes first. Conditions include short trips in freezing weather, road salt, very cold weather and stop-and-go driving. Hyundai Canada directs owners to the severe-use schedule. Other tasks have their own conditions and intervals.',
      sourceTitle: 'Hyundai Canada · 2016 Elantra owner’s manual',
      sourceUrl: ownerDocuments[0].url + '#page=19',
      locator: 'Chapter 7, page 19 · Severe usage',
      reviewedAt: '2026-10-26',
      manualsUrl: 'https://www.hyundaicanada.com/en/owners-section/manuals',
      reminder: {
        key: 'hyundai-2016-elantra-oil-severe',
        title: 'Engine oil and filter',
        km: 6000,
        months: 6,
        label: 'Hyundai Canada · severe-use oil schedule',
        setupNote:
          'Enter the last oil and filter change. Check the severe-driving conditions in the linked manual. This reminder covers oil and filter only.',
      },
      documents: ownerDocuments,
      specifications: [
        {
          label: 'Engine oil · drain and refill',
          value: '4.0 L',
          note: 'Published for Nu 1.8 and Nu 2.0 engines. Confirm the engine fitted to your car.',
          url: ownerDocuments[1].url + '#page=4',
          locator: 'Chapter 8, page 4',
        },
        {
          label: 'Engine oil · published specification',
          value: 'API SM / ILSAC GF-4 or above',
          note: 'The manual recommends SAE 5W-20 for fuel economy and lists 5W-30 and 10W-30 alternatives in its temperature chart. Check that chart and current product compatibility.',
          url: ownerDocuments[1].url + '#page=5',
          locator: 'Chapter 8, pages 4–5',
        },
        {
          label: 'Brake fluid · published specification',
          value: 'DOT-3 or DOT-4',
          note: 'FMVSS 116. This specification does not imply a replacement interval.',
          url: ownerDocuments[1].url + '#page=4',
          locator: 'Chapter 8, page 4',
        },
      ],
    };
  const hondaStart = /^(civic)(\b| )/.test(model)
    ? 2016
    : /^(cr-v)(\b| )/.test(model)
      ? 2017
      : /^(accord|odyssey)(\b| )/.test(model)
        ? 2018
        : /^(pilot|passport)(\b| )/.test(model)
          ? 2019
          : /^(hr-v)(\b| )/.test(model)
            ? 2023
            : model === 'prelude'
              ? 2026
              : null;
  if (make === 'honda' && hondaStart !== null && vehicle.year >= hondaStart && vehicle.year <= 2026)
    return {
      title: 'Honda Canada · Maintenance Minder A/0',
      note: 'Follow the Maintenance Minder message in your vehicle. Honda Canada describes a service alert at 15% oil life. A fixed kilometre countdown is not inferred. The A/0 schedule also lists time limits and exceptional-use requirements; check the schedule and your exact owner’s manual.',
      sourceTitle: 'Honda Canada · Keeping Maintenance on Schedule',
      sourceUrl: 'https://www.honda.ca/en/service-parts/maintenance-schedules',
      locator: 'Maintenance Minder A/0 applicability and linked Canadian schedule',
      reviewedAt: '2026-10-26',
      manualsUrl: 'https://www.honda.ca/en/owners/manuals',
    };
  return null;
}
// Fixed owner checks supplement the severe-use oil interval. Conditional and
// dashboard-driven work is not converted into invented recurring intervals.
export function maintenanceTasks(vehicle: {
  make: string;
  model: string;
  year: number;
}): MaintenanceTask[] {
  const guidance = maintenanceGuidance(vehicle);
  if (!guidance?.reminder) return [];
  const tasks: MaintenanceTask[] = [
    {
      ...guidance.reminder,
      sourceUrl: guidance.sourceUrl,
      locator: guidance.locator,
      reviewedAt: guidance.reviewedAt,
    },
  ];
  if (guidance.reminder.key !== 'hyundai-2016-elantra-oil-severe') return tasks;
  const source = ownerDocuments[0].url;
  const checks: MaintenanceTask[] = [
    {
      key: 'hyundai-2016-elantra-tires',
      title: 'Tire pressure and condition',
      km: null,
      months: 1,
      label: 'Hyundai Canada · monthly owner check',
      setupNote:
        'Check all tires, including the spare, as described in the manual. This is an inspection, not a tire replacement interval.',
      sourceUrl: source + '#page=7',
      locator: 'Chapter 7, page 7 · At least monthly',
      reviewedAt: '2026-10-27',
    },
    {
      key: 'hyundai-2016-elantra-lights',
      title: 'Exterior lights check',
      km: null,
      months: 1,
      label: 'Hyundai Canada · monthly owner check',
      setupNote: 'Check exterior lights, including stoplights, turn signals and hazard lights.',
      sourceUrl: source + '#page=7',
      locator: 'Chapter 7, page 7 · At least monthly',
      reviewedAt: '2026-10-27',
    },
    {
      key: 'hyundai-2016-elantra-coolant-check',
      title: 'Engine coolant level check',
      km: null,
      months: 1,
      label: 'Hyundai Canada · monthly owner check',
      setupNote:
        'Follow the manual’s cool-engine precautions. This level check is separate from coolant replacement.',
      sourceUrl: source + '#page=7',
      locator: 'Chapter 7, page 7 · At least monthly',
      reviewedAt: '2026-10-27',
    },
    {
      key: 'hyundai-2016-elantra-battery',
      title: 'Clean battery and terminals',
      km: null,
      months: 12,
      label: 'Hyundai Canada · annual owner maintenance',
      setupNote: 'Follow the battery safety and cleaning instructions in the manual.',
      sourceUrl: source + '#page=8',
      locator: 'Chapter 7, page 8 · At least once a year',
      reviewedAt: '2026-10-27',
    },
    {
      key: 'hyundai-2016-elantra-rotation',
      title: 'Tire rotation',
      km: 12000,
      months: 6,
      label: 'Hyundai Canada · scheduled tire rotation',
      setupNote:
        'The regular schedule lists rotation every 12,000 km or 6 months. Follow the manual’s tire-rotation instructions and equipment restrictions.',
      sourceUrl: source + '#page=9',
      locator: 'Chapter 7, pages 9–18 · Scheduled maintenance',
      reviewedAt: '2026-10-27',
    },
  ];
  return [...tasks, ...checks];
}

export function ownerResources(make: string) {
  switch (make.trim().toLowerCase()) {
    case 'toyota':
      return {
        manuals: 'https://www.toyota.ca/en/owners/manuals/',
        schedule: 'https://www.toyota.ca/en/owners/maintenance-schedule/',
      };
    case 'hyundai':
      return {
        manuals: 'https://www.hyundaicanada.com/en/owners-section/manuals',
        schedule: 'https://www.hyundaicanada.com/en/owners-section/maintenance',
      };
    case 'honda':
      return {
        manuals: 'https://www.honda.ca/en/owners/manuals',
        schedule: 'https://www.honda.ca/en/service-parts/maintenance-schedules',
      };
    default:
      return null;
  }
}
