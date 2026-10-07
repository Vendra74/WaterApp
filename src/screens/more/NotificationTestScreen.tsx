import React, { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import { Screen } from '@/ui/components/Screen';
import { AppText } from '@/ui/components/AppText';
import { BigButton } from '@/ui/components/BigButton';
import { Card } from '@/ui/components/Card';
import { Banner } from '@/ui/components/Fields';
import { useAppStore } from '@/state/appStore';
import { ensureCategories, listOwnedScheduled, openDndAccessSettings, openExactAlarmSettings, presentTestNotificationNow, requestPermission, scheduleTestNotification } from '@/services/notifications/notificationService';
import { registerBackgroundTasks } from '@/services/background/backgroundTasks';
import { APP_NAME } from '@/config/branding';
import { strings } from '@/i18n';
import { formatClock, formatDate } from '@/i18n/format';

async function ensureCategoriesSafe() {
  try {
    await ensureCategories();
  } catch {
    // erro de categoria não impede o teste; o agendamento reporta separadamente
  }
}

export function NotificationTestScreen() {
  const { permission, notificationState, reschedule } = useAppStore();
  const [scheduled, setScheduled] = useState<{ identifier: string; fireAt: string | null; kind: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [bg, setBg] = useState<{ periodic: boolean; notification: boolean; reason?: string } | null>(null);
  const n = strings().notificationTest;

  const load = async () => setScheduled(await listOwnedScheduled());
  useEffect(() => {
    void load();
    void registerBackgroundTasks().then(setBg);
  }, [notificationState]);

  const test = async (kind: 'hydration' | 'medication') => {
    if (permission !== 'granted') {
      const p = await requestPermission();
      if (p !== 'granted') {
        setMsg(n.permissionDenied);
        return;
      }
    }
    try {
      await ensureCategoriesSafe();
      await scheduleTestNotification(10, kind);
      const list = await listOwnedScheduled();
      const pending = list.filter((s) => s.identifier.startsWith('test@')).length;
      setMsg(n.scheduled(pending));
    } catch (e) {
      setMsg(n.scheduleError(e instanceof Error ? e.message : String(e)));
    }
  };

  const testNow = async () => {
    try {
      await presentTestNotificationNow();
      setMsg(n.presentedNow);
    } catch (e) {
      setMsg(n.presentError(e instanceof Error ? e.message : String(e)));
    }
  };

  const permissionLabel =
    permission === 'granted' ? n.permGranted : permission === 'denied' ? n.permDenied : permission === 'unsupported' ? n.permUnsupported : n.permUndetermined;
  const when = (iso: string) => `${formatDate(new Date(iso))} ${formatClock(new Date(iso))}`;
  const bgState = bg ? (bg.periodic ? n.bgRegistered : n.bgUnavailable(bg.reason ?? n.bgNoDetails)) : n.bgChecking;

  return (
    <Screen title={n.title}>
      <Card tone={permission === 'granted' ? 'success' : 'warning'}>
        <AppText variant="heading">{n.permission(permissionLabel)}</AppText>
        {permission !== 'granted' ? <BigButton compact label={n.askPermission} onPress={() => void requestPermission().then(() => reschedule())} /> : null}
        {permission === 'denied' ? <BigButton compact kind="secondary" label={n.openSystemSettings} onPress={() => void Linking.openSettings()} /> : null}
        {!Device.isDevice ? <AppText muted variant="small">{n.emulator}</AppText> : null}
      </Card>
      {Platform.OS === 'android' ? (
        <Card tone="warning">
          <AppText variant="heading">{n.exactTitle}</AppText>
          <AppText variant="small">{n.exactBody(APP_NAME)}</AppText>
          <BigButton compact label={n.allowExact} onPress={() => void openExactAlarmSettings().then((err) => { if (err) { console.warn('exact alarm settings', err); setMsg(n.exactFailed); } })} />
          <BigButton compact kind="secondary" label={n.batterySettings} onPress={() => void Linking.openSettings()} />
        </Card>
      ) : null}
      {Platform.OS === 'android' ? (
        <Card>
          <AppText variant="heading">{n.dndTitle}</AppText>
          <AppText variant="small">{n.dndBody(APP_NAME)}</AppText>
          <BigButton compact label={n.allowDnd} onPress={() => void openDndAccessSettings().then((err) => { if (err) { console.warn('dnd access settings', err); setMsg(n.dndFailed); } })} />
        </Card>
      ) : null}
      {Platform.OS === 'ios' ? (
        <Card>
          <AppText variant="heading">{n.focusTitle}</AppText>
          <AppText variant="small">{n.focusBody(APP_NAME)}</AppText>
          <BigButton compact label={n.openAppSettings(APP_NAME)} onPress={() => void Linking.openSettings()} />
        </Card>
      ) : null}
      <BigButton kind="secondary" label={n.showNow} icon="⚡" onPress={() => void testNow()} />
      <BigButton label={n.testWater} icon="💧" onPress={() => void test('hydration')} />
      <BigButton kind="secondary" label={n.testMedication} icon="💊" onPress={() => void test('medication')} />
      {msg ? <Banner tone="info">{msg}</Banner> : null}
      <Card>
        <AppText variant="heading">{n.scheduledCount(scheduled.length)}</AppText>
        {notificationState ? (
          <AppText muted variant="small">
            {n.lastUpdate(notificationState.lastRescheduleAt ? when(notificationState.lastRescheduleAt) : n.never, notificationState.plannedCount, notificationState.scheduledCount)}
            {notificationState.truncated ? n.truncated : ''}
            {notificationState.lastError ? n.error(notificationState.lastError) : ''}
          </AppText>
        ) : null}
        {scheduled.slice(0, 12).map((s) => (
          <AppText key={s.identifier} variant="small">{s.fireAt ? when(s.fireAt) : '—'} · {s.kind === 'hydration' ? n.kindWater : s.kind === 'medication' ? n.kindMedication : s.kind}</AppText>
        ))}
        <BigButton compact kind="secondary" label={n.rescheduleNow} onPress={() => void reschedule().then(load)} />
      </Card>
      <Card>
        <AppText variant="heading">{n.limitsTitle}</AppText>
        <AppText variant="small">{n.limit1}</AppText>
        <AppText variant="small">{n.limit2}</AppText>
        <AppText variant="small">{n.limit3(APP_NAME)}</AppText>
        <AppText variant="small">{n.limit4}</AppText>
        <AppText variant="small">{n.limit5}</AppText>
        <AppText variant="small">{n.bgTask(bgState, Platform.OS === 'ios')}</AppText>
        <AppText variant="small">{n.limit6}</AppText>
      </Card>
    </Screen>
  );
}
