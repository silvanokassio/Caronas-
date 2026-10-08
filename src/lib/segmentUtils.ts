import { TripSegmentType } from '../types';

export function getSegmentLabel(segment?: TripSegmentType): string {
  switch (segment) {
    case 'somente_ida':
      return 'Somente Ida';
    case 'somente_volta':
      return 'Somente Volta';
    case 'ida_e_volta':
    default:
      return 'Ida e Volta';
  }
}

export function getSegmentShortBadge(segment?: TripSegmentType): {
  label: string;
  icon: string;
  badgeClass: string;
} {
  switch (segment) {
    case 'somente_ida':
      return {
        label: 'Só Ida',
        icon: '➡️',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    case 'somente_volta':
      return {
        label: 'Só Volta',
        icon: '⬅️',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    case 'ida_e_volta':
    default:
      return {
        label: 'Ida e Volta',
        icon: '🔄',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
  }
}

export function calculateSegmentPrice(
  basePrice: number,
  passengerSegment?: TripSegmentType,
  rideSegment?: TripSegmentType
): number {
  const safeBase = Number(basePrice) || 0;
  // If ride is round-trip and passenger only takes one way, half the price
  if (
    rideSegment === 'ida_e_volta' &&
    (passengerSegment === 'somente_ida' || passengerSegment === 'somente_volta')
  ) {
    return Math.round((safeBase / 2) * 100) / 100;
  }
  return safeBase;
}
