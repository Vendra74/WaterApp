import type { HHmm, ISODate, ISODateTime, Weekday } from '../types';

export const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidHHmm(value: string): value is HHmm {
  return HHMM_REGEX.test(value);
}

export function hhmmToMinutes(value: HHmm): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToHHmm(minutes: number): HHmm {
  const total = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Retorna a data local (YYYY-MM-DD) de um instante. */
export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Combina uma data local com um horário HH:mm, no fuso do dispositivo. */
export function atLocalTime(day: Date, time: HHmm): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h ?? 0, m ?? 0, 0, 0);
  return d;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function weekdayOf(date: Date): Weekday {
  return date.getDay() as Weekday;
}

export function iso(date: Date): ISODateTime {
  return date.toISOString();
}

export function parseISODate(day: ISODate): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

/**
 * Verifica se um horário (em minutos do dia) está dentro de um intervalo, que pode
 * cruzar a meia-noite (ex.: 22:00 → 06:00).
 */
export function isWithinRange(minuteOfDay: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return false;
  if (startMin < endMin) return minuteOfDay >= startMin && minuteOfDay < endMin;
  return minuteOfDay >= startMin || minuteOfDay < endMin;
}

/** Hora local no formato de armazenamento "HH:mm" (24 h). Para exibir, use `formatClock` de `@/i18n/format`. */
export function formatTimeBR(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Data local "DD/MM/AAAA" (formato brasileiro). Para exibir, use `formatDate` de `@/i18n/format`. */
export function formatDateBR(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}
