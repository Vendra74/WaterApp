import React from 'react';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { ChoiceGroup } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { resolveLocale, strings, type LanguagePreference } from '@/i18n';
import { deviceLanguageCode } from '@/i18n/device';

export function LanguageScreen() {
  const preference = useAppStore((s) => s.languagePreference);
  const setLanguage = useAppStore((s) => s.setLanguage);
  useAppStore((s) => s.locale); // a própria tela muda de idioma na hora
  const l = strings().language;
  const deviceName = resolveLocale(deviceLanguageCode()) === 'en' ? l.en : l.ptBR;
  return (
    <Screen title={l.title}>
      <ChoiceGroup
        label={l.question}
        options={[
          { value: 'auto', label: l.auto, description: l.autoHint(deviceName) },
          { value: 'pt-BR', label: l.ptBR },
          { value: 'en', label: l.en },
        ]}
        value={preference}
        onChange={(v) => void setLanguage(v as LanguagePreference)}
      />
      <Card tone="alt">
        <AppText muted variant="small">{l.note}</AppText>
      </Card>
    </Screen>
  );
}
