import type { HHmm, ISODate, Weekday } from '@/domain/types';
import { HHMM_REGEX } from '@/domain/time/time';
import { isEnglish } from './locale';
import { strings } from './index';
import { pt, type Strings } from './pt';
import { en } from './en';

/**
 * Formatação de datas e horas para exibição, conforme o idioma. Os valores armazenados continuam
 * sendo "HH:mm" (24 h) e "YYYY-MM-DD": só a apresentação muda. Em inglês (EUA) a hora é "8:05 AM"
 * e a data "10/7/2026"; em português, "08:05" e "07/10/2026".
 */

/** "HH:mm" armazenado → texto para a tela. */
export function formatHHmm(value: HHmm): string {
  if (!isEnglish() || !HHMM_REGEX.test(value)) return value;
  const [h, m] = value.split(':').map(Number);
  return twelveHour(h ?? 0, m ?? 0);
}

/** Hora de um instante (fuso do aparelho) para a tela. */
export function formatClock(date: Date): string {
  if (isEnglish()) return twelveHour(date.getHours(), date.getMinutes());
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Data de um instante (fuso do aparelho) para a tela. */
export function formatDate(date: Date): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  if (isEnglish()) return `${m}/${d}/${y}`;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/** "YYYY-MM-DD" armazenado → data para a tela, sem passar por fuso horário. */
export function formatISODate(day: ISODate): string {
  const [y, m, d] = day.split('-');
  if (!y || !m || !d) return day;
  if (isEnglish()) return `${Number(m)}/${Number(d)}/${y}`;
  return `${d}/${m}/${y}`;
}

/** Intervalo "HH:mm–HH:mm" para a tela (cochilos). */
export function formatRange(start: HHmm, end: HHmm): string {
  return `${formatHHmm(start)}–${formatHHmm(end)}`;
}

export function weekdayShort(day: Weekday): string {
  return strings().weekdayShort[day];
}

export function weekdayLong(day: Weekday): string {
  return strings().weekdayLong[day];
}

function twelveHour(h: number, m: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/**
 * Dose para a tela ("1 comprimido", "2 tablets"). A unidade é texto livre gravado como o usuário
 * digitou (ou como a receita foi lida); aqui só as unidades conhecidas são mostradas no idioma
 * atual, no singular ou plural conforme a quantidade. Uma unidade desconhecida sai como está.
 */
export function formatDose(amount: string, unit: string): string {
  return `${amount} ${formatDoseUnit(unit, amount)}`.trim();
}

export function formatDoseUnit(unit: string, amount: string): string {
  const key = doseUnitKey(unit);
  if (!key) return unit;
  const forms = strings().medicationForm.doseUnits[key];
  return (isSingular(amount) ? forms[0] : forms[1]) ?? unit;
}

type DoseUnitKey = keyof Strings['medicationForm']['doseUnits'];

/** Procura a unidade digitada em todos os idiomas, sem diferenciar maiúsculas nem espaços extras. */
function doseUnitKey(unit: string): DoseUnitKey | null {
  const typed = unit.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!typed) return null;
  for (const dict of [pt, en]) {
    for (const [key, forms] of Object.entries(dict.medicationForm.doseUnits)) {
      if (forms.some((f) => f.toLowerCase() === typed)) return key as DoseUnitKey;
    }
  }
  return null;
}

/** "1", "1.0" e "1,0" são singular; "2", "0,5", "1/2" e "1 a 2" usam o plural. */
function isSingular(amount: string): boolean {
  const n = Number(amount.trim().replace(',', '.'));
  return n === 1;
}
