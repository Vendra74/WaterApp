import React from 'react';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { BigButton } from '@/ui/components/BigButton';
import { CONTENT_CATALOG, visibleContent } from '@/domain/content/catalog';
import { useAppStore } from '@/state/appStore';
import { speak } from '@/services/speech/speech';

export function ContentScreen() {
  const demoMode = useAppStore((s) => s.demoMode);
  const items = visibleContent(CONTENT_CATALOG, demoMode);
  return (
    <Screen title="Saiba mais">
      <AppText muted>Textos informativos gerais. Não substituem a orientação da sua equipe de saúde.</AppText>
      {items.map((c) => (
        <Card key={c.id} tone={c.status === 'draft' ? 'warning' : 'default'}>
          <AppText variant="heading">{c.title}</AppText>
          {c.status !== 'validated' ? <AppText bold>NÃO VALIDADO — visível apenas em demonstração</AppText> : null}
          <AppText>{c.body}</AppText>
          <AppText muted variant="small">Fonte: {c.source} · Revisado em {c.reviewedAt.split('-').reverse().join('/')}</AppText>
          <BigButton kind="ghost" compact icon="🔊" label="Ler em voz alta" onPress={() => speak(`${c.title}. ${c.body}`)} />
        </Card>
      ))}
    </Screen>
  );
}
