/**
 * Date and Time utilities for Ride scheduling, search filtering, and past-ride validation
 */

import { Ride } from '../types';

/**
 * Returns a Javascript Date object for a given ride's date and time string
 */
export function getRideDateTime(departureDate?: string, departureTime?: string): Date | null {
  if (!departureDate && !departureTime) return null;

  if (departureTime && departureTime.includes('T')) {
    const d = new Date(departureTime);
    if (!isNaN(d.getTime())) return d;
  }

  const dateStr = departureDate || new Date().toISOString().split('T')[0];
  let timeStr = departureTime || '00:00';
  if (timeStr.length === 5) {
    timeStr = `${timeStr}:00`;
  }

  const isoCandidate = `${dateStr}T${timeStr}`;
  const d = new Date(isoCandidate);
  if (!isNaN(d.getTime())) return d;

  return null;
}

/**
 * Determines whether a ride's scheduled date and time has already elapsed.
 * Rides with status 'concluida' or 'cancelada' are always considered past.
 * Rides with status 'em_andamento' are actively running.
 * Rides with status 'agendada' whose scheduled date/time < current instant are considered in the past.
 */
export function isRideInPast(ride: { departureDate?: string; departureTime?: string; status?: string }): boolean {
  if (!ride) return true;
  if (ride.status === 'concluida' || ride.status === 'cancelada') return true;
  if (ride.status === 'em_andamento') return false;

  const dt = getRideDateTime(ride.departureDate, ride.departureTime);
  if (!dt) return false;

  return dt.getTime() < Date.now();
}

/**
 * Gets a formatted YYYY-MM-DD date string with an optional day offset
 */
export function getRelativeDateStr(daysOffset: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets an upcoming time HH:MM formatted string rounded to nearest 5 minutes
 */
export function getUpcomingTimeStr(hoursOffset: number = 1, fixedMinutes?: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hoursOffset);
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = fixedMinutes !== undefined 
    ? String(fixedMinutes).padStart(2, '0') 
    : String(Math.floor(d.getMinutes() / 5) * 5).padStart(2, '0');
  return `${hours}:${mins}`;
}

/**
 * Formats a YYYY-MM-DD date into friendly Portuguese representation
 * e.g. "Hoje", "Amanhã", "Qui, 28/08"
 */
export function formatRideFriendlyDate(dateStr?: string): string {
  if (!dateStr) return '';
  
  const today = getRelativeDateStr(0);
  const tomorrow = getRelativeDateStr(1);
  const yesterday = getRelativeDateStr(-1);

  if (dateStr === today) return 'Hoje';
  if (dateStr === tomorrow) return 'Amanhã';
  if (dateStr === yesterday) return 'Ontem';

  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    return `${capitalizedDay}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}

/**
 * Comprehensive verification for searching and filtering rides by Day and Hour
 */
export interface DateTimeFilterOptions {
  dateMode: 'all_future' | 'today' | 'tomorrow' | 'this_week' | 'custom';
  customDate?: string;
  timeMode: 'all' | 'from_now' | 'morning' | 'afternoon' | 'night' | 'custom';
  customTime?: string;
  allowPast?: boolean;
}

export function matchesDateTimeFilter(ride: Ride, filters: DateTimeFilterOptions): boolean {
  const isPast = isRideInPast(ride);

  // If past rides are not explicitly allowed, reject past rides
  if (!filters.allowPast && isPast) {
    return false;
  }

  const todayStr = getRelativeDateStr(0);
  const tomorrowStr = getRelativeDateStr(1);
  const rideDate = ride.departureDate || todayStr;
  const rideTime = ride.departureTime || '00:00';

  // 1. Check Date filter
  if (filters.dateMode === 'today') {
    if (rideDate !== todayStr) return false;
  } else if (filters.dateMode === 'tomorrow') {
    if (rideDate !== tomorrowStr) return false;
  } else if (filters.dateMode === 'this_week') {
    const dNow = new Date();
    const dEndOfWeek = new Date();
    dEndOfWeek.setDate(dNow.getDate() + 7);
    const rideDt = getRideDateTime(rideDate, rideTime);
    if (!rideDt || rideDt > dEndOfWeek) return false;
  } else if (filters.dateMode === 'custom' && filters.customDate) {
    if (rideDate !== filters.customDate) return false;
  }

  // 2. Check Time filter
  const [rH, rM] = rideTime.split(':').map(Number);
  const rideTotalMins = (rH || 0) * 60 + (rM || 0);

  if (filters.timeMode === 'from_now') {
    if (rideDate === todayStr) {
      const now = new Date();
      const currentTotalMins = now.getHours() * 60 + now.getMinutes();
      if (rideTotalMins < currentTotalMins) return false;
    }
  } else if (filters.timeMode === 'morning') {
    // 05:00 - 11:59
    if (rH < 5 || rH >= 12) return false;
  } else if (filters.timeMode === 'afternoon') {
    // 12:00 - 17:59
    if (rH < 12 || rH >= 18) return false;
  } else if (filters.timeMode === 'night') {
    // 18:00 - 23:59
    if (rH < 18) return false;
  } else if (filters.timeMode === 'custom' && filters.customTime) {
    const [cH, cM] = filters.customTime.split(':').map(Number);
    const minFilterMins = (cH || 0) * 60 + (cM || 0);
    if (rideTotalMins < minFilterMins) return false;
  }

  return true;
}
