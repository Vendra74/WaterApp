import React from 'react';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { BigButton } from '@/ui/components/BigButton';
import { localizedContent, visibleContent } from '@/domain/content/catalog';
import { useAppStore } from '@/state/appStore';
import { speak } from '@/services/speech/speech';
import { strings } from '@/i18n';
import { formatISODate } from '@/i18n/format';

export function ContentScreen() {
  const demoMode = useAppStore((st) => st.demoMode);
  const s = strings();
  const items = visibleContent(localizedContent(), demoMode);
  return (
    <Screen title={s.content.title}>
      <AppText muted>{s.content.intro}</AppText>
      {items.map((c) => (
        <Card key={c.id} tone={c.status === 'draft' ? 'warning' : 'default'}>
          <AppText variant="heading">{c.title}</AppText>
          {c.status !== 'validated' ? <AppText bold>{s.content.notValidated}</AppText> : null}
          <AppText>{c.body}</AppText>
          <AppText muted variant="small">{s.content.source(c.source, formatISODate(c.reviewedAt))}</AppText>
          <BigButton kind="ghost" compact icon="🔊" label={s.common.readAloud} onPress={() => speak(`${c.title}. ${c.body}`)} />
        </Card>
      ))}
    </Screen>
  );
}
