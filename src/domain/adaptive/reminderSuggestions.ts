import type { HHmm, HydrationLog, HydrationSettings, ISODateTime, Medication, MedicationOccurrence, TimeRange } from '../types';
import { formatTimeBR, hhmmToMinutes, minutesToHHmm, toISODate } from '../time/time';
import { isDuringNap } from '../hydration/schedule';

/**
 * Lembretes que aprendem com o horário real.
 *
 * O aplicativo observa quando a pessoa de fato registra água ou confirma um medicamento e, quando
 * há um padrão consistente de atraso ou adiantamento em relação ao lembrete, SUGERE ajustar o
 * horário do aviso. Regras:
 *
 *  - Tudo é calculado no aparelho, só com os registros locais. Nada sai do telefone.
 *  - É sempre uma sugestão: nada muda sem a pessoa tocar em "mudar". Uma sugestão recusada não
 *    volta a aparecer por um tempo (ver `filterDismissed`).
 *  - Exige repetição: poucos registros ou poucos dias distintos não geram sugestão.
 *  - Para medicamentos a tolerância é pequena (padrão 60 min) e só vale para horários fixos: o
 *    horário vem da prescrição e o app não sugere trocas grandes nem "compensar" doses.
 *  - A estatística é a mediana dos desvios, que ignora dias atípicos.
 */

export interface SuggestionThresholds {
  /** Quantos dias para trás considerar. */
  lookbackDays: number;
  /** Mínimo de registros que batem com o lembrete. */
  minSamples: number;
  /** Mínimo de dias distintos entre esses registros. */
  minDistinctDays: number;
  /** Desvio mediano mínimo (min) para valer a pena sugerir. */
  minShiftMinutes: number;
  /** Desvio máximo (min) que a sugestão pode propor. */
  maxShiftMinutes: number;
  /** Até que distância (min) do lembrete um registro ainda "pertence" a ele. */
  matchWindowMinutes: number;
}

export const HYDRATION_TIME_THRESHOLDS: SuggestionThresholds = {
  lookbackDays: 14,
  minSamples: 5,
  minDistinctDays: 4,
  minShiftMinutes: 20,
  maxShiftMinutes: 90,
  matchWindowMinutes: 90,
};

export const HYDRATION_WINDOW_THRESHOLDS: SuggestionThresholds = {
  lookbackDays: 14,
  minSamples: 5,
  minDistinctDays: 5,
  minShiftMinutes: 30,
  maxShiftMinutes: 120,
  matchWindowMinutes: 180,
};

export const MEDICATION_TIME_THRESHOLDS: SuggestionThresholds = {
  lookbackDays: 14,
  minSamples: 5,
  minDistinctDays: 4,
  minShiftMinutes: 20,
  maxShiftMinutes: 60,
  matchWindowMinutes: 120,
};

/** Distância mínima entre dois horários do mesmo tipo após o ajuste. */
const MIN_GAP_MINUTES = 30;
/** Dias em que uma sugestão recusada fica escondida. */
export const DISMISS_DAYS = 14;

interface SuggestionBase {
  /** Identifica a sugestão de forma estável (para lembrar recusas). */
  key: string;
  from: HHmm;
  to: HHmm;
  samples: number;
  days: number;
}

export type ReminderSuggestion =
  | ({ kind: 'hydration_time' } & SuggestionBase)
  | ({ kind: 'hydration_window_start' } & SuggestionBase)
  | ({ kind: 'medication_time'; medicationId: string; medicationName: string } & SuggestionBase);

export interface SuggestionInput {
  settings: HydrationSettings;
  naps: TimeRange[];
  logs: HydrationLog[];
  medications: Medication[];
  occurrences: MedicationOccurrence[];
  now: Date;
}

/** Todas as sugestões possíveis, da mais relevante (mais registros) para a menos. */
export function computeReminderSuggestions(input: SuggestionInput): ReminderSuggestion[] {
  const { settings, naps, logs, medications, occurrences, now } = input;
  if (!settings.suggestReminderAdjustments) return [];
  const out: ReminderSuggestion[] = [];
  if (settings.enabled) {
    if (settings.mode === 'times') out.push(...suggestHydrationTimes(settings, naps, logs, now));
    else out.push(...suggestHydrationWindowStart(settings, naps, logs, now));
  }
  for (const med of medications) out.push(...suggestMedicationTimes(med, occurrences, now));
  return out.sort((a, b) => b.samples - a.samples);
}

export function suggestHydrationTimes(
  settings: HydrationSettings,
  naps: TimeRange[],
  logs: HydrationLog[],
  now: Date,
  th: SuggestionThresholds = HYDRATION_TIME_THRESHOLDS,
): ReminderSuggestion[] {
  const times = [...new Set(settings.times)].sort();
  if (times.length === 0) return [];
  const since = sinceDate(now, th.lookbackDays);
  const minutesOf = times.map(hhmmToMinutes);

  // Cada registro pertence ao lembrete mais próximo (se estiver dentro da janela de correspondência).
  const samplesByTime = new Map<HHmm, { offset: number; day: string }[]>();
  for (const log of logs) {
    if (log.deletedAt !== null) continue;
    const at = new Date(log.at);
    if (at.getTime() < since.getTime() || at.getTime() > now.getTime()) continue;
    const minute = at.getHours() * 60 + at.getMinutes();
    let best = -1;
    let bestDist = Infinity;
    minutesOf.forEach((m, i) => {
      const dist = Math.abs(minute - m);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    if (best < 0 || bestDist > th.matchWindowMinutes) continue;
    const key = times[best]!;
    const list = samplesByTime.get(key) ?? [];
    list.push({ offset: minute - minutesOf[best]!, day: toISODate(at) });
    samplesByTime.set(key, list);
  }

  const out: ReminderSuggestion[] = [];
  for (const time of times) {
    const samples = closestPerDay(samplesByTime.get(time) ?? []);
    const shift = consistentShift(samples, th);
    if (shift === null) continue;
    const target = hhmmToMinutes(time) + shift;
    if (!insideWindow(target, settings)) continue;
    if (settings.pauseDuringNaps && isDuringNap(dateAtMinute(now, target), naps)) continue;
    const others = times.filter((t) => t !== time).map(hhmmToMinutes);
    if (others.some((o) => Math.abs(o - target) < MIN_GAP_MINUTES)) continue;
    out.push({ kind: 'hydration_time', key: `hyd:${time}`, from: time, to: minutesToHHmm(target), samples: samples.length, days: distinctDays(samples) });
  }
  return out;
}

/**
 * No modo "de tanto em tanto tempo" o que se aprende é o início do período: se o primeiro registro
 * do dia vem consistentemente bem depois (ou antes) de "Começar às", vale sugerir mover o início.
 */
export function suggestHydrationWindowStart(
  settings: HydrationSettings,
  naps: TimeRange[],
  logs: HydrationLog[],
  now: Date,
  th: SuggestionThresholds = HYDRATION_WINDOW_THRESHOLDS,
): ReminderSuggestion[] {
  const startMin = hhmmToMinutes(settings.windowStart);
  const endMin = hhmmToMinutes(settings.windowEnd);
  if (endMin <= startMin) return []; // janela que cruza a meia-noite: fora do escopo desta sugestão
  const since = sinceDate(now, th.lookbackDays);
  const today = toISODate(now);

  const firstByDay = new Map<string, number>();
  for (const log of logs) {
    if (log.deletedAt !== null) continue;
    const at = new Date(log.at);
    if (at.getTime() < since.getTime() || at.getTime() > now.getTime()) continue;
    const day = toISODate(at);
    if (day === today) continue; // o dia de hoje ainda não acabou
    const minute = at.getHours() * 60 + at.getMinutes();
    const cur = firstByDay.get(day);
    if (cur === undefined || minute < cur) firstByDay.set(day, minute);
  }
  const samples = [...firstByDay.entries()]
    .map(([day, minute]) => ({ day, offset: minute - startMin }))
    .filter((s) => Math.abs(s.offset) <= th.matchWindowMinutes);
  const shift = consistentShift(samples, th);
  if (shift === null) return [];
  const target = startMin + shift;
  if (target < 0 || target > endMin - 60) return [];
  if (settings.pauseDuringNaps && isDuringNap(dateAtMinute(now, target), naps)) return [];
  return [{ kind: 'hydration_window_start', key: 'hydwin:start', from: settings.windowStart, to: minutesToHHmm(target), samples: samples.length, days: samples.length }];
}

export function suggestMedicationTimes(
  med: Medication,
  occurrences: MedicationOccurrence[],
  now: Date,
  th: SuggestionThresholds = MEDICATION_TIME_THRESHOLDS,
): ReminderSuggestion[] {
  if (!med.active || med.scheduleType !== 'fixed_times') return [];
  const since = sinceDate(now, th.lookbackDays);
  const times = [...new Set(med.times)].sort();
  const out: ReminderSuggestion[] = [];
  for (const time of times) {
    const samples: { offset: number; day: string }[] = [];
    for (const o of occurrences) {
      if (o.medicationId !== med.id || o.status !== 'taken' || !o.takenAt) continue;
      const planned = new Date(o.plannedAt);
      if (planned.getTime() < since.getTime() || planned.getTime() > now.getTime()) continue;
      if (formatTimeBR(planned) !== time) continue;
      const offset = Math.round((new Date(o.takenAt).getTime() - planned.getTime()) / 60_000);
      if (Math.abs(offset) > th.matchWindowMinutes) continue;
      samples.push({ offset, day: toISODate(planned) });
    }
    const shift = consistentShift(closestPerDay(samples), th);
    if (shift === null) continue;
    const target = hhmmToMinutes(time) + shift;
    if (target < 0 || target > 23 * 60 + 59) continue;
    const others = times.filter((t) => t !== time).map(hhmmToMinutes);
    if (others.some((o) => Math.abs(o - target) < MIN_GAP_MINUTES)) continue;
    out.push({
      kind: 'medication_time',
      key: `med:${med.id}:${time}`,
      medicationId: med.id,
      medicationName: med.name,
      from: time,
      to: minutesToHHmm(target),
      samples: samples.length,
      days: distinctDays(samples),
    });
  }
  return out;
}

/** Recusas recentes: a mesma sugestão (mesma chave) fica escondida por `DISMISS_DAYS`. */
export function filterDismissed(
  suggestions: ReminderSuggestion[],
  dismissed: Record<string, ISODateTime>,
  now: Date,
  days = DISMISS_DAYS,
): ReminderSuggestion[] {
  return suggestions.filter((s) => {
    const at = dismissed[s.key];
    if (!at) return true;
    return now.getTime() - new Date(at).getTime() > days * 86_400_000;
  });
}

/** Aplica uma sugestão de água às configurações (função pura; o chamador salva). */
export function applyHydrationSuggestion(settings: HydrationSettings, s: ReminderSuggestion): HydrationSettings {
  if (s.kind === 'hydration_time') {
    const times = [...new Set(settings.times.map((t) => (t === s.from ? s.to : t)))].sort();
    return { ...settings, times };
  }
  if (s.kind === 'hydration_window_start') {
    return { ...settings, windowStart: s.to, windowFollowsRoutine: false };
  }
  return settings;
}

/** Aplica uma sugestão de medicamento ao cadastro (função pura; o chamador salva). */
export function applyMedicationSuggestion(med: Medication, s: ReminderSuggestion): Medication {
  if (s.kind !== 'medication_time' || s.medicationId !== med.id) return med;
  const times = [...new Set(med.times.map((t) => (t === s.from ? s.to : t)))].sort();
  return { ...med, times };
}

export interface SuggestionText {
  title: string;
  body: string;
  accept: string;
  reject: string;
}

/** Texto em pt-BR para a interface. Descreve o que foi observado; não dá orientação clínica. */
export function describeSuggestion(s: ReminderSuggestion): SuggestionText {
  const later = hhmmToMinutes(s.to) > hhmmToMinutes(s.from);
  const when = later ? 'depois' : 'antes';
  if (s.kind === 'hydration_time') {
    return {
      title: 'Ajustar o lembrete de água?',
      body: `Nos últimos dias você registrou água por volta das ${s.to}, ${when} do lembrete das ${s.from}. Quer mudar o lembrete para ${s.to}?`,
      accept: `Mudar para ${s.to}`,
      reject: `Manter ${s.from}`,
    };
  }
  if (s.kind === 'hydration_window_start') {
    return {
      title: 'Começar os lembretes mais ' + (later ? 'tarde' : 'cedo') + '?',
      body: `Nos últimos dias o seu primeiro registro de água foi por volta das ${s.to}, ${when} do início dos lembretes às ${s.from}. Quer começar os lembretes às ${s.to}?`,
      accept: `Começar às ${s.to}`,
      reject: `Manter ${s.from}`,
    };
  }
  return {
    title: `Ajustar o aviso de ${s.medicationName}?`,
    body: `Nos últimos dias você confirmou ${s.medicationName} por volta das ${s.to}, ${when} do aviso das ${s.from}. Quer mudar o aviso para ${s.to}? O horário combinado com quem prescreveu continua valendo; se tiver dúvida, pergunte a essa pessoa.`,
    accept: `Mudar para ${s.to}`,
    reject: `Manter ${s.from}`,
  };
}

// ---- auxiliares -------------------------------------------------------------------------------

interface Sample {
  offset: number;
  day: string;
}

/** Em cada dia, só o registro mais próximo do lembrete conta (evita que um dia pese mais). */
function closestPerDay(samples: Sample[]): Sample[] {
  const byDay = new Map<string, Sample>();
  for (const s of samples) {
    const cur = byDay.get(s.day);
    if (!cur || Math.abs(s.offset) < Math.abs(cur.offset)) byDay.set(s.day, s);
  }
  return [...byDay.values()];
}

/**
 * Desvio consistente (mediana) em minutos, arredondado a 5, ou null quando não há base suficiente
 * ou o desvio é pequeno. Nunca ultrapassa `maxShiftMinutes`.
 */
export function consistentShift(samples: Sample[], th: SuggestionThresholds): number | null {
  if (samples.length < th.minSamples) return null;
  if (distinctDays(samples) < th.minDistinctDays) return null;
  const med = median(samples.map((s) => s.offset));
  const rounded = Math.round(med / 5) * 5;
  if (Math.abs(rounded) < th.minShiftMinutes) return null;
  return Math.sign(rounded) * Math.min(Math.abs(rounded), th.maxShiftMinutes);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function distinctDays(samples: Sample[]): number {
  return new Set(samples.map((s) => s.day)).size;
}

function sinceDate(now: Date, days: number): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

function dateAtMinute(now: Date, minuteOfDay: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
}

function insideWindow(minute: number, settings: HydrationSettings): boolean {
  const start = hhmmToMinutes(settings.windowStart);
  const end = hhmmToMinutes(settings.windowEnd);
  if (minute < 0 || minute > 23 * 60 + 59) return false;
  if (end <= start) return minute >= start || minute <= end;
  return minute >= start && minute <= end;
}
