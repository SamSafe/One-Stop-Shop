import type { Car } from '@oss/car-catalog';

// Broad browsing categories are distinct from NRCan's precise size classes.
export function vehicleBodyStyle(car: Car): string {
  if (car.bodyStyle !== 'Not verified')
    return car.bodyStyle === 'Compact SUV' ? 'SUV' : car.bodyStyle;
  const ratingClass = car.governmentRating?.vehicleClass ?? '';
  if (/^Sport utility vehicle:/i.test(ratingClass)) return 'SUV';
  if (/^Pickup truck:/i.test(ratingClass)) return 'Pickup';
  if (/^Minivan/i.test(ratingClass)) return 'Minivan';
  if (/^Station wagon:/i.test(ratingClass)) return 'Wagon';
  if (/^Van:/i.test(ratingClass)) return 'Van';
  return 'Not verified';
}
