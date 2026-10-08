/**
 * Date and Time utilities for Ride scheduling, search filtering, and past-ride validation
 */

import { Ride } from '../types';

/**
 * Returns a Javascript Date object for a given ride's date and time string.
 * Accurately parses ISO format, Brazilian format (DD/MM/YYYY), YYYY-MM-DD, and custom times.
 */
export function getRideDateTime(departureDate?: string, departureTime?: string): Date | null {
  if (!departureDate && !departureTime) return null;

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-indexed
  let day = now.getDate();

  if (departureDate) {
    const trimmedDate = departureDate.trim();

    if (trimmedDate.toLowerCase() === 'hoje') {
      year = now.getFullYear();
      month = now.getMonth() + 1;
      day = now.getDate();
    } else if (trimmedDate.toLowerCase() === 'amanhã' || trimmedDate.toLowerCase() === 'amanha') {
      const tom = new Date();
      tom.setDate(tom.getDate() + 1);
      year = tom.getFullYear();
      month = tom.getMonth() + 1;
      day = tom.getDate();
    } else if (trimmedDate.toLowerCase() === 'ontem') {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      year = yest.getFullYear();
      month = yest.getMonth() + 1;
      day = yest.getDate();
    } else if (trimmedDate.includes('T')) {
      const d = new Date(trimmedDate);
      if (!isNaN(d.getTime())) return d;
    } else if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(trimmedDate)) {
      // YYYY-MM-DD or YYYY/MM/DD
      const parts = trimmedDate.split(/[-/.]/);
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(trimmedDate)) {
      // DD/MM/YYYY or DD-MM-YYYY
      const parts = trimmedDate.split(/[-/.]/);
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    } else {
      const d = new Date(trimmedDate);
      if (!isNaN(d.getTime())) return d;
    }
  }

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (departureTime) {
    const trimmedTime = departureTime.trim();
    if (trimmedTime.includes('T')) {
      const d = new Date(trimmedTime);
      if (!isNaN(d.getTime())) return d;
    }
    const timeParts = trimmedTime.split(':');
    if (timeParts.length >= 2) {
      hours = parseInt(timeParts[0], 10) || 0;
      minutes = parseInt(timeParts[1], 10) || 0;
      seconds = parseInt(timeParts[2], 10) || 0;
    }
  }

  const result = new Date(year, month - 1, day, hours, minutes, seconds);
  if (!isNaN(result.getTime())) {
    return result;
  }

  return null;
}

/**
 * Checks whether a ride's date is strictly before today (yesterday or older, i.e. dia -1).
 * Rides from today (regardless of scheduled departure time) return false.
 */
export function isRideBeforeToday(
  ride: { departureDate?: string; departureTime?: string }
): boolean {
  if (!ride) return true;
  return isDateBeforeToday(ride.departureDate, ride.departureTime);
}

/**
 * Determines whether a ride's scheduled date and time has already elapsed.
 * Rides with status 'concluida' or 'cancelada' are always considered past.
 * For general ride searches, any ride from a previous day (dia -1) is considered past.
 * Rides from today remain active throughout the day until concluded or cancelled.
 */
export function isRideInPast(
  ride: { departureDate?: string; departureTime?: string; status?: string },
  allowInProgress: boolean = false
): boolean {
  if (!ride) return true;
  if (ride.status === 'concluida' || ride.status === 'cancelada') return true;
  if (ride.status === 'em_andamento') {
    return !allowInProgress;
  }

  // Trava de data: apenas se for de dias anteriores (dia -1 ou mais antigo)
  if (isDateBeforeToday(ride.departureDate, ride.departureTime)) {
    return true;
  }

  // Viagens de hoje ou futuras não são tratadas como passadas para busca/adesão enquanto não concluídas
  return false;
}

/**
 * Checks whether a ride is from today (any time today) or in the future,
 * and is not concluded or cancelled.
 */
export function isRideUpcomingOrToday(
  ride: { departureDate?: string; departureTime?: string; status?: string }
): boolean {
  if (!ride) return false;
  if (ride.status === 'concluida' || ride.status === 'cancelada') return false;
  if (ride.status === 'em_andamento') return true;

  // Se for de dia anterior (ontem ou mais antigo), não é de hoje nem futura
  if (isDateBeforeToday(ride.departureDate, ride.departureTime)) {
    return false;
  }

  return true;
}

/**
 * Checks whether a given ride's scheduled date/time is before today (yesterday or older).
 */
export function isDateBeforeToday(dateStr?: string, timeStr?: string): boolean {
  if (!dateStr) return false;
  const trimmed = dateStr.trim().toLowerCase();
  if (trimmed === 'ontem') return true;
  if (trimmed === 'hoje' || trimmed === 'amanhã' || trimmed === 'amanha') return false;

  const todayStr = getRelativeDateStr(0); // YYYY-MM-DD para hoje
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed < todayStr;
  }

  const dt = getRideDateTime(dateStr, timeStr);
  if (dt) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return dt.getTime() < startOfToday.getTime();
  }
  return false;
}

/**
 * Checks whether a ride is concluded/cancelled or belongs to previous days (dia -1).
 * Regra: Adesão permitida a qualquer hora do dia em que foi postada,
 * desde que não tenha status concluída (mantendo trava apenas para dia -1 ou status concluído/cancelado).
 */
export function isRideInPastOrConcluded(
  ride: { departureDate?: string; departureTime?: string; status?: string }
): boolean {
  if (!ride) return true;
  if (ride.status === 'concluida' || ride.status === 'cancelada') return true;
  if (isDateBeforeToday(ride.departureDate, ride.departureTime)) return true;
  return false;
}

/**
 * Regra: Possibilitar adesão na viagem a qualquer hora do dia que ela for postada
 * desde que não tenha sido passada para o status concluída.
 * Mantém trava somente se for dia -1 (ontem/passado) ou status concluído/cancelado.
 */
export function canJoinRide(
  ride: { departureDate?: string; departureTime?: string; status?: string }
): boolean {
  return !isRideInPastOrConcluded(ride);
}

/**
 * Regra: Não deve ser permitido sair de viagens concluídas ou de datas passadas (dia -1).
 */
export function canLeaveRide(
  ride: { departureDate?: string; departureTime?: string; status?: string }
): boolean {
  if (!ride) return false;
  if (ride.status === 'concluida' || ride.status === 'cancelada') return false;
  if (isDateBeforeToday(ride.departureDate, ride.departureTime)) return false;
  return true;
}

/**
 * Gets a formatted YYYY-MM-DD date string with an optional day offset
 */
export function getRelativeDateStr(daysOffset: number = 0): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const effectiveTz = !tz || tz === 'UTC' ? 'America/Sao_Paulo' : tz;
    const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: effectiveTz }));
    nowInTz.setDate(nowInTz.getDate() + daysOffset);
    const year = nowInTz.getFullYear();
    const month = String(nowInTz.getMonth() + 1).padStart(2, '0');
    const day = String(nowInTz.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
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
