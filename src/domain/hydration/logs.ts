import type { HydrationLog } from '../types';
import { toISODate } from '../time/time';

/** Soma do volume registrado em um dia local (ignora registros excluídos). */
export function totalForDay(logs: HydrationLog[], day: Date): number {
  const key = toISODate(day);
  return logs
    .filter((l) => l.deletedAt === null && toISODate(new Date(l.at)) === key)
    .reduce((sum, l) => sum + l.volumeMl, 0);
}

export interface DailyTotal {
  day: string; // YYYY-MM-DD
  totalMl: number;
  count: number;
}

export function totalsByDay(logs: HydrationLog[]): DailyTotal[] {
  const map = new Map<string, DailyTotal>();
  for (const l of logs) {
    if (l.deletedAt !== null) continue;
    const day = toISODate(new Date(l.at));
    const cur = map.get(day) ?? { day, totalMl: 0, count: 0 };
    cur.totalMl += l.volumeMl;
    cur.count += 1;
    map.set(day, cur);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Evita registro duplicado acidental: mesmo volume e bebida em menos de `windowSeconds`.
 * O chamador decide se pede confirmação ao usuário.
 */
export function looksLikeDuplicate(
  existing: HydrationLog[],
  candidate: Pick<HydrationLog, 'at' | 'volumeMl' | 'beverage'>,
  windowSeconds = 90,
): boolean {
  const t = new Date(candidate.at).getTime();
  return existing.some(
    (l) =>
      l.deletedAt === null &&
      l.volumeMl === candidate.volumeMl &&
      l.beverage === candidate.beverage &&
      Math.abs(new Date(l.at).getTime() - t) < windowSeconds * 1000,
  );
}

export function isValidVolume(volumeMl: number): boolean {
  return Number.isFinite(volumeMl) && volumeMl > 0 && volumeMl <= 2000;
}
