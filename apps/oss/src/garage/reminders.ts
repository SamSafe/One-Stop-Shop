import { reminderDue } from './domain';
import type { OwnedVehicle } from './domain';

export const reminderPriority = {
  Overdue: 0,
  'Due now': 1,
  'Due soon': 2,
  'Needs history': 3,
  Upcoming: 4,
};

export function garageReminders(vehicles: OwnedVehicle[], day: string) {
  return vehicles
    .flatMap((vehicle) =>
      vehicle.reminders.map((reminder) => ({
        vehicle,
        reminder,
        due: reminderDue(vehicle, reminder, day),
      })),
    )
    .sort((a, b) => reminderPriority[a.due.status] - reminderPriority[b.due.status]);
}

export type GarageReminder = ReturnType<typeof garageReminders>[number];
export type ReminderFilter = 'attention' | 'due' | 'soon' | 'history';

export function matchesReminderFilter(entry: GarageReminder, filter: ReminderFilter) {
  switch (filter) {
    case 'due':
      return entry.due.status === 'Overdue' || entry.due.status === 'Due now';
    case 'soon':
      return entry.due.status === 'Due soon';
    case 'history':
      return entry.due.status === 'Needs history';
    case 'attention':
      return entry.due.status !== 'Upcoming';
  }
}

// Identifiers contain only letters, digits and hyphens; the dot keeps pairs unambiguous.
export function reminderTargetId(vehicleId: string, reminderId: string) {
  return `garage-reminder-${vehicleId}.${reminderId}`;
}
