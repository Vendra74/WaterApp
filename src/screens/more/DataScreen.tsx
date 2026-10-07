import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner, Toggle } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { deleteAllLocalData, exportAllData } from '@/services/export/dataExport';
import { deleteRemoteData } from '@/services/sync/careService';
import { loadDemoData } from '@/services/demo/demoData';
import { hasAiConsent, isPrescriptionReadingAvailable, setAiConsent } from '@/services/ai/prescriptionReader';
import { env } from '@/config/env';
import { APP_NAME } from '@/config/branding';
import { strings } from '@/i18n';

export function DataScreen() {
  const nav = useNavigation();
  const { demoMode, sync, refresh, reschedule } = useAppStore();
  const [msg, setMsg] = useState<string | null>(null);
  const [aiConsent, setAiConsentState] = useState(false);
  const s = strings();
  const d = s.data;
  const canRead = isPrescriptionReadingAvailable();
  useEffect(() => {
    if (canRead) void hasAiConsent().then(setAiConsentState);
  }, [canRead]);

  const exportData = async () => {
    try {
      const uri = await exportAllData();
      setMsg(d.exported(uri));
    } catch (e) {
      setMsg(d.exportFailed(e instanceof Error ? e.message : String(e)));
    }
  };

  const deleteAll = () =>
    Alert.alert(d.deleteTitle, d.deleteBody, [
      { text: s.common.cancel, style: 'cancel' },
      {
        text: d.deleteAll,
        style: 'destructive',
        onPress: async () => {
          const remote = await deleteRemoteData();
          await deleteAllLocalData();
          await refresh();
          await reschedule();
          setMsg(remote.ok ? d.deleted : d.deletedLocalOnly(remote.error ?? ''));
          nav.reset({ index: 0, routes: [{ name: 'Welcome' }] });
        },
      },
    ]);

  return (
    <Screen title={d.title}>
      <Card>
        <AppText variant="heading">{d.whereTitle}</AppText>
        <AppText>{d.whereIntro}{env.caregiverEnabled ? d.whereCaregiver : canRead ? d.wherePhoto : d.whereNothing}{d.whereOutro}</AppText>
        {sync?.configured ? <AppText muted variant="small">{d.account(sync.signedIn, sync.pending)}</AppText> : env.caregiverEnabled ? <AppText muted variant="small">{d.notConfigured}</AppText> : null}
      </Card>
      {canRead ? (
        <Card>
          <AppText variant="heading">{d.photoTitle}</AppText>
          <Toggle
            label={d.photoConsent}
            hint={d.photoConsentHint(APP_NAME)}
            value={aiConsent}
            onChange={(v) => { setAiConsentState(v); void setAiConsent(v); }}
          />
        </Card>
      ) : null}
      <BigButton kind="secondary" icon="⬇" label={d.export} onPress={() => void exportData()} />
      <BigButton kind="danger" label={d.deleteButton} onPress={deleteAll} />
      {demoMode ? (
        <Card tone="warning">
          <AppText variant="heading">{d.demoTitle}</AppText>
          <AppText>{d.demoBody}</AppText>
          <BigButton compact kind="secondary" label={d.loadDemo} onPress={() => void loadDemoData().then(refresh).then(reschedule).then(() => setMsg(d.demoLoaded))} />
        </Card>
      ) : null}
      {msg ? <Banner tone="info">{msg}</Banner> : null}
      <AppText muted variant="small">{d.legal}</AppText>
    </Screen>
  );
}
