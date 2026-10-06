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

export function DataScreen() {
  const nav = useNavigation();
  const { demoMode, sync, refresh, reschedule } = useAppStore();
  const [msg, setMsg] = useState<string | null>(null);
  const [aiConsent, setAiConsentState] = useState(false);
  const canRead = isPrescriptionReadingAvailable();
  useEffect(() => {
    if (canRead) void hasAiConsent().then(setAiConsentState);
  }, [canRead]);

  const exportData = async () => {
    try {
      const uri = await exportAllData();
      setMsg(`Arquivo gerado: ${uri}`);
    } catch (e) {
      setMsg(`Não foi possível exportar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const deleteAll = () =>
    Alert.alert('Apagar todos os dados?', 'Perfil, registros, medicamentos e contatos serão apagados deste aparelho e, se você tiver conta, também do servidor. Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar tudo',
        style: 'destructive',
        onPress: async () => {
          const remote = await deleteRemoteData();
          await deleteAllLocalData();
          await refresh();
          await reschedule();
          setMsg(remote.ok ? 'Dados apagados.' : `Dados locais apagados. Falha ao apagar no servidor: ${remote.error}. Tente novamente com internet.`);
          nav.reset({ index: 0, routes: [{ name: 'Welcome' }] });
        },
      },
    ]);

  return (
    <Screen title="Meus dados">
      <Card>
        <AppText variant="heading">Onde ficam meus dados?</AppText>
        <AppText>Tudo fica neste aparelho. {env.caregiverEnabled ? 'Só é enviado ao servidor o necessário para o cuidador que você autorizou. ' : canRead ? 'Nesta versão só sai do aparelho a foto de receita que você autorizar ler, e ela não fica guardada. ' : 'Nesta versão nada é enviado a servidores. '}Dados de saúde não são incluídos em registros de erro nem em ferramentas de publicidade.</AppText>
        {sync?.configured ? <AppText muted variant="small">Conta: {sync.signedIn ? 'conectada' : 'não conectada'} · pendências de envio: {sync.pending}</AppText> : env.caregiverEnabled ? <AppText muted variant="small">Compartilhamento remoto não configurado neste build.</AppText> : null}
      </Card>
      {canRead ? (
        <Card>
          <AppText variant="heading">Leitura de receita por foto</AppText>
          <Toggle
            label="Autorizo enviar fotos de receita para leitura"
            hint="A foto vai ao servidor do Cuidar e ao serviço de inteligência artificial só para preencher o cadastro; não fica guardada. Desligar retira a autorização."
            value={aiConsent}
            onChange={(v) => { setAiConsentState(v); void setAiConsent(v); }}
          />
        </Card>
      ) : null}
      <BigButton kind="secondary" icon="⬇" label="Exportar meus dados (arquivo)" onPress={() => void exportData()} />
      <BigButton kind="danger" label="Apagar todos os meus dados" onPress={deleteAll} />
      {demoMode ? (
        <Card tone="warning">
          <AppText variant="heading">Modo demonstração</AppText>
          <AppText>Carrega um perfil e registros fictícios, todos identificados como demonstração.</AppText>
          <BigButton compact kind="secondary" label="Carregar dados de demonstração" onPress={() => void loadDemoData().then(refresh).then(reschedule).then(() => setMsg('Dados de demonstração carregados.'))} />
        </Card>
      ) : null}
      {msg ? <Banner tone="info">{msg}</Banner> : null}
      <AppText muted variant="small">A conformidade legal (LGPD) completa exige revisão jurídica específica; este aplicativo implementa os controles técnicos de consentimento, exportação e exclusão.</AppText>
    </Screen>
  );
}
