import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/core/navigation';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Banner, ProgressBar } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { visibleSteps } from './steps';
import type { Profile } from '@/domain/types';
import { emptyProfile } from '@/services/usecases/profile';
import { speak } from '@/services/speech/speech';
import { strings } from '@/i18n';

export function AssessmentScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Assessment'>>();
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);

  const [draft, setDraft] = useState<Profile>(() => {
    if (route.params?.resume === false && profile && !profile.assessmentCompleted) return { ...emptyProfile(), id: profile.id, createdAt: profile.createdAt };
    return profile ?? emptyProfile();
  });
  const steps = useMemo(() => visibleSteps(draft), [draft]);
  const [index, setIndex] = useState(() => (route.params?.resume ? Math.min(profile?.assessmentStep ?? 0, steps.length - 1) : 0));
  const [error, setError] = useState<string | null>(null);
  const step = steps[Math.min(index, steps.length - 1)]!;
  const update = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }));
  const s = strings();

  useEffect(() => {
    setError(null);
    if (draft.accessibility.speakReminders) speak(step.title);
  }, [step.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = async (extra: Partial<Profile> = {}) => {
    await updateProfile({ ...draft, ...extra });
  };

  const next = async () => {
    const msg = step.validate?.(draft) ?? null;
    if (msg) {
      setError(msg);
      return;
    }
    if (index >= steps.length - 1) {
      await persist({ assessmentStep: steps.length });
      nav.navigate('AssessmentSummary');
      return;
    }
    setIndex(index + 1);
    void persist({ assessmentStep: index + 1 });
  };

  const back = () => {
    if (index === 0) nav.goBack();
    else setIndex(index - 1);
  };

  const saveForLater = async () => {
    await persist({ assessmentStep: index });
    nav.goBack();
  };

  return (
    <Screen
      title={s.assessment.title}
      footer={
        <View style={{ gap: 8 }}>
          <BigButton label={index >= steps.length - 1 ? s.assessment.seeSummary : s.common.next} icon="→" onPress={() => void next()} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <BigButton kind="secondary" compact label={s.common.back} style={{ flex: 1 }} onPress={back} />
            <BigButton kind="ghost" compact label={s.assessment.saveForLater} style={{ flex: 1 }} onPress={() => void saveForLater()} />
          </View>
        </View>
      }
    >
      <ProgressBar current={index + 1} total={steps.length} />
      <AppText variant="heading" accessibilityLiveRegion="polite">{step.title}</AppText>
      {step.help ? <AppText muted>{step.help}</AppText> : null}
      {step.render({ draft, update })}
      {error ? <Banner tone="warning">{error}</Banner> : null}
    </Screen>
  );
}
