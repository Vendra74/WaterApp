import { createContext, useContext } from 'react';
import type { AccessibilityPrefs } from '@/domain/types';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  danger: string;
  onDanger: string;
  warning: string;
  warningBg: string;
  success: string;
  successBg: string;
  border: string;
  focus: string;
}

/** Paleta padrão com contraste ≥ 4.5:1 para texto; a versão de alto contraste eleva para ≥ 7:1. */
export const LIGHT: Palette = {
  background: '#F6F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EAF2FA',
  text: '#14202B',
  textMuted: '#4A5A68',
  primary: '#0B5FA5',
  onPrimary: '#FFFFFF',
  secondary: '#E3EEF8',
  onSecondary: '#0B3D6B',
  danger: '#B3261E',
  onDanger: '#FFFFFF',
  warning: '#7A4E00',
  warningBg: '#FFF4DB',
  success: '#1B5E20',
  successBg: '#E6F4EA',
  border: '#C6D0DA',
  focus: '#FFB300',
};

export const HIGH_CONTRAST: Palette = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F2F2',
  text: '#000000',
  textMuted: '#1A1A1A',
  primary: '#003A75',
  onPrimary: '#FFFFFF',
  secondary: '#FFFFFF',
  onSecondary: '#003A75',
  danger: '#8A0000',
  onDanger: '#FFFFFF',
  warning: '#4D3000',
  warningBg: '#FFF1C2',
  success: '#0B3D12',
  successBg: '#DDF5E1',
  border: '#000000',
  focus: '#FF8F00',
};

export interface Theme {
  colors: Palette;
  fontScale: number;
  highContrast: boolean;
  reduceMotion: boolean;
  space: (n: number) => number;
  font: (base: number) => number;
  radius: number;
  touchMin: number;
}

export function buildTheme(prefs: AccessibilityPrefs): Theme {
  const colors = prefs.highContrast ? HIGH_CONTRAST : LIGHT;
  return {
    colors,
    fontScale: prefs.fontScale,
    highContrast: prefs.highContrast,
    reduceMotion: prefs.reduceMotion,
    space: (n) => n * 8,
    font: (base) => Math.round(base * prefs.fontScale),
    radius: 14,
    touchMin: 64,
  };
}

export const DEFAULT_PREFS: AccessibilityPrefs = { fontScale: 1.25, highContrast: false, speakReminders: false, reduceMotion: false };

export const ThemeContext = createContext<Theme>(buildTheme(DEFAULT_PREFS));
export const useTheme = (): Theme => useContext(ThemeContext);
