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
import { formatDateBR, formatTimeBR } from '@/domain/time/time';
import { registerBackgroundTasks } from '@/services/background/backgroundTasks';

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

  const load = async () => setScheduled(await listOwnedScheduled());
  useEffect(() => {
    void load();
    void registerBackgroundTasks().then(setBg);
  }, [notificationState]);

  const test = async (kind: 'hydration' | 'medication') => {
    if (permission !== 'granted') {
      const p = await requestPermission();
      if (p !== 'granted') {
        setMsg('Permissão negada. Abra as configurações do sistema para permitir notificações.');
        return;
      }
    }
    try {
      await ensureCategoriesSafe();
      await scheduleTestNotification(10, kind);
      const list = await listOwnedScheduled();
      const pending = list.filter((s) => s.identifier.startsWith('test@')).length;
      setMsg(`Agendada para daqui a 10 segundos (${pending} teste(s) pendente(s) no sistema). Bloqueie a tela ou saia do aplicativo para conferir.`);
    } catch (e) {
      setMsg(`Erro ao agendar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const testNow = async () => {
    try {
      await presentTestNotificationNow();
      setMsg('Notificação imediata enviada. Se ela não apareceu na barra de status, o problema é de permissão/canal, não do alarme.');
    } catch (e) {
      setMsg(`Erro ao apresentar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <Screen title="Testar notificações">
      <Card tone={permission === 'granted' ? 'success' : 'warning'}>
        <AppText variant="heading">Permissão: {permission === 'granted' ? 'concedida' : permission === 'denied' ? 'negada' : permission === 'unsupported' ? 'não suportada neste ambiente' : 'ainda não pedida'}</AppText>
        {permission !== 'granted' ? <BigButton compact label="Pedir permissão" onPress={() => void requestPermission().then(() => reschedule())} /> : null}
        {permission === 'denied' ? <BigButton compact kind="secondary" label="Abrir configurações do sistema" onPress={() => void Linking.openSettings()} /> : null}
        {!Device.isDevice ? <AppText muted variant="small">Você está em um emulador/simulador. Teste em um aparelho físico para validar de verdade.</AppText> : null}
      </Card>
      {Platform.OS === 'android' ? (
        <Card tone="warning">
          <AppText variant="heading">Alarmes exatos (Android)</AppText>
          <AppText variant="small">
            Sem esta permissão, o Android agrupa os lembretes e pode atrasá-los em vários minutos, e o teste de 10 segundos não aparece.
            Toque abaixo e, na tela do sistema, ative “Permitir definir alarmes e lembretes” para o {'\u201C'}Cuidar{'\u201D'}. Se a opção já estiver ativa, não precisa mudar nada.
          </AppText>
          <BigButton compact label="Permitir alarmes exatos" onPress={() => void openExactAlarmSettings().then((err) => err && setMsg(`Não foi possível abrir a tela do sistema (${err}). Procure “Alarmes e lembretes” nas configurações do aparelho.`))} />
          <BigButton compact kind="secondary" label="Configurações de bateria e notificações do app" onPress={() => void Linking.openSettings()} />
        </Card>
      ) : null}
      {Platform.OS === 'android' ? (
        <Card>
          <AppText variant="heading">Modo Não perturbe</AppText>
          <AppText variant="small">
            Com o Não perturbe ligado (ícone ⊖ na barra de status), o Android silencia o som, a vibração e o aviso na tela de todos os apps.
            Você pode autorizar o {'\u201C'}Cuidar{'\u201D'} a tocar os lembretes de medicamento mesmo assim: toque abaixo e ative o Cuidar na lista.
          </AppText>
          <BigButton compact label="Permitir tocar no Não perturbe (medicamentos)" onPress={() => void openDndAccessSettings().then((err) => err && setMsg(`Não foi possível abrir a tela do sistema (${err}). Procure “Acesso a Não perturbe” nas configurações.`))} />
        </Card>
      ) : null}
      <BigButton kind="secondary" label="Mostrar notificação agora (sem alarme)" icon="⚡" onPress={() => void testNow()} />
      <BigButton label="Testar lembrete de água (10 s)" icon="💧" onPress={() => void test('hydration')} />
      <BigButton kind="secondary" label="Testar lembrete de medicamento (10 s)" icon="💊" onPress={() => void test('medication')} />
      {msg ? <Banner tone="info">{msg}</Banner> : null}
      <Card>
        <AppText variant="heading">Agendados no sistema: {scheduled.length}</AppText>
        {notificationState ? (
          <AppText muted variant="small">
            Última atualização: {notificationState.lastRescheduleAt ? `${formatDateBR(new Date(notificationState.lastRescheduleAt))} ${formatTimeBR(new Date(notificationState.lastRescheduleAt))}` : 'nunca'} · planejadas {notificationState.plannedCount} · agendadas {notificationState.scheduledCount}
            {notificationState.truncated ? ' · limite da plataforma atingido: os lembretes mais distantes serão agendados quando o aplicativo for aberto novamente ou pela tarefa em segundo plano.' : ''}
            {notificationState.lastError ? ` · erro: ${notificationState.lastError}` : ''}
          </AppText>
        ) : null}
        {scheduled.slice(0, 12).map((s) => (
          <AppText key={s.identifier} variant="small">{s.fireAt ? `${formatDateBR(new Date(s.fireAt))} ${formatTimeBR(new Date(s.fireAt))}` : '—'} · {s.kind === 'hydration' ? 'água' : s.kind === 'medication' ? 'medicamento' : s.kind}</AppText>
        ))}
        <BigButton compact kind="secondary" label="Reagendar agora" onPress={() => void reschedule().then(load)} />
      </Card>
      <Card>
        <AppText variant="heading">Limitações conhecidas</AppText>
        <AppText variant="small">• iOS mantém no máximo 64 notificações pendentes por aplicativo. Medicamentos têm prioridade; o restante é agendado quando você abre o aplicativo.</AppText>
        <AppText variant="small">• Android pode atrasar notificações em economia de bateria ou modo “Não perturbe”. Em alguns aparelhos (Xiaomi, Samsung etc.) é preciso liberar o aplicativo nas configurações de bateria.</AppText>
        <AppText variant="small">• Tela bloqueada: alguns aparelhos (Motorola, por exemplo) mostram só uma fileira de ícones, com as mensagens e chamadas na frente. Se a gota do Cuidar não estiver visível, deslize a fileira para o lado e toque na gota para ver o lembrete e os botões.</AppText>
        <AppText variant="small">• Os botões da notificação abrem o aplicativo para confirmar. Nenhum consumo é registrado só por abrir a notificação.</AppText>
        <AppText variant="small">• Leitura em voz alta funciona apenas com o aplicativo aberto.</AppText>
        <AppText variant="small">• Tarefa periódica em segundo plano: {bg ? (bg.periodic ? 'registrada (o sistema decide quando executar)' : `indisponível — ${bg.reason ?? 'sem detalhes'}`) : 'verificando…'}. {Platform.OS === 'ios' ? 'No iOS ela roda a critério do sistema.' : ''}</AppText>
        <AppText variant="small">• Nenhuma entrega é garantida pelo sistema operacional. Mantenha o aplicativo instalado e abra-o com frequência.</AppText>
      </Card>
    </Screen>
  );
}
