import type { Medication } from '@/domain/types';
import { WEEKDAY_LABELS_PT } from '@/domain/time/time';

export function describeSchedule(m: Medication): string {
  const days = m.weekdays.length === 0 || m.weekdays.length === 7 ? 'todos os dias' : m.weekdays.map((d) => WEEKDAY_LABELS_PT[d]).join(', ');
  const when = m.scheduleType === 'fixed_times' ? `às ${m.times.join(', ')}` : `a cada ${m.intervalHours} h a partir das ${m.intervalAnchor}`;
  const period = m.endDate ? ` até ${m.endDate.split('-').reverse().join('/')}` : '';
  return `${when}, ${days}${period}`;
}
