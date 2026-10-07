import type { Medication } from '@/domain/types';
import { strings } from '@/i18n';
import { formatHHmm, formatISODate, weekdayShort } from '@/i18n/format';

export function describeSchedule(m: Medication): string {
  const s = strings().schedule;
  const days = m.weekdays.length === 0 || m.weekdays.length === 7 ? s.everyDay : m.weekdays.map(weekdayShort).join(', ');
  const when =
    m.scheduleType === 'fixed_times'
      ? s.atTimes(m.times.map(formatHHmm).join(', '))
      : s.everyHours(m.intervalHours ?? 0, formatHHmm(m.intervalAnchor ?? '00:00'));
  const period = m.endDate ? s.until(formatISODate(m.endDate)) : '';
  return `${when}, ${days}${period}`;
}

/**
 * Via de administração para a tela. O valor gravado é o identificador em português ("oral",
 * "tópica"…, ver `KNOWN_ROUTES`); um texto livre vindo da receita é mostrado como está.
 */
export function routeLabel(route: string): string {
  const f = strings().medicationForm;
  const labels: Record<string, string> = { oral: f.routeOral, 'tópica': f.routeTopical, ocular: f.routeOcular, 'inalatória': f.routeInhaled, 'injetável': f.routeInjection, outra: f.routeOther };
  return labels[route] ?? route;
}
