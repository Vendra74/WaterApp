import type { HydrationSettings, Profile, TimeRange } from '../types';
import { addDays, atLocalTime, hhmmToMinutes, isWithinRange, startOfLocalDay, weekdayOf } from '../time/time';

export interface HydrationSlot {
  at: Date;
}

export interface HydrationScheduleInput {
  settings: HydrationSettings;
  naps: TimeRange[];
  /** Instante de referência: só retornamos horários futuros. */
  now: Date;
  /** Quantos dias à frente gerar (inclui hoje). */
  days: number;
}

/**
 * Gera os horários de lembrete de hidratação futuros, respeitando:
 *  - janela (início/fim) — pode cruzar a meia-noite;
 *  - pausas para cochilo (se ativado);
 *  - dias da semana;
 *  - modo intervalo (60/90/120...) ou horários específicos.
 * Nunca depende de temporizador ativo: é uma função pura usada para agendar no sistema.
 */
export function generateHydrationSlots(input: HydrationScheduleInput): HydrationSlot[] {
  const { settings, naps, now, days } = input;
  if (!settings.enabled) return [];
  if (settings.weekdays.length === 0) return [];

  const slots: HydrationSlot[] = [];
  const startMin = hhmmToMinutes(settings.windowStart);
  const endMin = hhmmToMinutes(settings.windowEnd);
  const crossesMidnight = endMin <= startMin;

  for (let d = 0; d < days; d++) {
    const day = addDays(startOfLocalDay(now), d);
    if (!settings.weekdays.includes(weekdayOf(day))) continue;

    const dayStart = atLocalTime(day, settings.windowStart);
    const dayEnd = crossesMidnight
      ? atLocalTime(addDays(day, 1), settings.windowEnd)
      : atLocalTime(day, settings.windowEnd);

    const candidates: Date[] = [];
    if (settings.mode === 'interval') {
      const step = Math.max(15, Math.round(settings.intervalMinutes));
      for (let t = dayStart.getTime(); t <= dayEnd.getTime(); t += step * 60_000) {
        candidates.push(new Date(t));
      }
    } else {
      for (const time of settings.times) {
        const min = hhmmToMinutes(time);
        const inWindow = crossesMidnight
          ? isWithinRange(min, startMin, endMin) || min === endMin
          : min >= startMin && min <= endMin;
        if (!inWindow) continue;
        // Em janelas que cruzam meia-noite, horários antes do fim pertencem ao dia seguinte.
        const base = crossesMidnight && min <= endMin ? addDays(day, 1) : day;
        candidates.push(atLocalTime(base, time));
      }
    }

    for (const at of candidates) {
      if (at.getTime() <= now.getTime()) continue;
      if (settings.pauseDuringNaps && isDuringNap(at, naps)) continue;
      slots.push({ at });
    }
  }

  slots.sort((a, b) => a.at.getTime() - b.at.getTime());
  // Dedup por instante exato (proteção contra horários repetidos na configuração).
  return slots.filter((s, i) => i === 0 || s.at.getTime() !== slots[i - 1]!.at.getTime());
}

export function isDuringNap(at: Date, naps: TimeRange[]): boolean {
  const minute = at.getHours() * 60 + at.getMinutes();
  return naps.some((nap) => isWithinRange(minute, hhmmToMinutes(nap.start), hhmmToMinutes(nap.end)));
}

/** Configuração padrão derivada do perfil: janela = acordar → dormir, intervalo 120 min. */
export function defaultHydrationSettings(profile: Pick<Profile, 'wakeTime' | 'sleepTime'>): HydrationSettings {
  return {
    enabled: false,
    mode: 'interval',
    intervalMinutes: 120,
    times: [],
    windowStart: profile.wakeTime,
    windowEnd: profile.sleepTime,
    pauseDuringNaps: true,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    sound: true,
    vibrate: true,
    snoozeMinutes: 15,
    showDetailsOnLockScreen: false,
    caregiverAlertAfterUnconfirmed: 0,
    windowFollowsRoutine: true,
    medicationRepeatMinutes: 10,
    medicationRepeatCount: 2,
  };
}

/**
 * Configurações após a avaliação (inicial ou atualização): ativa os lembretes e, se a janela
 * acompanha a rotina, alinha início/fim a acordar/dormir. Uma janela ajustada manualmente é preservada.
 */
export function settingsAfterAssessment(current: HydrationSettings | null, profile: Pick<Profile, 'wakeTime' | 'sleepTime'>): HydrationSettings {
  const base = current ?? defaultHydrationSettings(profile);
  if (!base.windowFollowsRoutine) return { ...base, enabled: true };
  return { ...base, enabled: true, windowStart: profile.wakeTime, windowEnd: profile.sleepTime };
}

/** Ao salvar a tela de lembretes: a janela só "segue a rotina" se continuar igual a acordar/dormir. */
export function settingsAfterManualEdit(edited: HydrationSettings, profile: Pick<Profile, 'wakeTime' | 'sleepTime'>): HydrationSettings {
  return { ...edited, windowFollowsRoutine: edited.windowStart === profile.wakeTime && edited.windowEnd === profile.sleepTime };
}
