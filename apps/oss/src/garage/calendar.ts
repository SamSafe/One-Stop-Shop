import { reminderDue } from './domain';
import type { Garage } from './domain';
import { vehicleName } from './vehicleName';

const escape = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
// RFC 5545 folds content lines at 75 octets, preserving UTF-8 code points.
function fold(value: string): string {
  const lines: string[] = [];
  let line = '';
  for (const char of value) {
    if (new TextEncoder().encode(line + char).length > 75) {
      lines.push(line);
      line = ' ';
    }
    line += char;
  }
  lines.push(line);
  return lines.join('\r\n');
}

export function garageCalendar(garage: Garage, now = new Date()) {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  let count = 0;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OSS//Garage maintenance//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const vehicle of garage.vehicles) {
    for (const reminder of vehicle.reminders) {
      const { dueOn, dueKm } = reminderDue(vehicle, reminder);
      if (!dueOn) continue;
      // Export the next actual date, not an invented recurring completion.
      const end = new Date(`${dueOn}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      const description = [
        `Vehicle: ${vehicleName(vehicle)}`,
        dueKm === null
          ? ''
          : `Also due at ${dueKm.toLocaleString('en-CA')} km; whichever comes first.`,
        'Based on service history recorded in OSS. Review your manual and current odometer. This calendar is a snapshot; export again after recording service. Notifications depend on your calendar app.',
      ]
        .filter(Boolean)
        .join('\n');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${vehicle.id}.${reminder.id}@oss.local`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dueOn.replaceAll('-', '')}`,
        `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll('-', '')}`,
        `SUMMARY:${escape(`${reminder.title} · ${vehicleName(vehicle)}`)}`,
        `DESCRIPTION:${escape(description)}`,
        'END:VEVENT',
      );
      count++;
    }
  }
  lines.push('END:VCALENDAR');
  return { count, content: lines.map(fold).join('\r\n') + '\r\n' };
}
