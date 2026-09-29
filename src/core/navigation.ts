import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Hoje: undefined;
  Medicamentos: undefined;
  Histórico: undefined;
  Mais: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  Assessment: { resume?: boolean; editing?: boolean } | undefined;
  AssessmentSummary: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  HydrationLog: { fromNotification?: boolean } | undefined;
  MedicationForm: { id?: string } | undefined;
  MedicationDetail: { id: string };
  OccurrenceAction: { occurrenceId: string };
  Profile: undefined;
  ReminderSettings: undefined;
  Caregiver: undefined;
  CaredPerson: { ownerId: string; name: string; permission: 'view' | 'edit' };
  Help: undefined;
  NotificationTest: undefined;
  Data: undefined;
  Content: undefined;
  Contacts: undefined;
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
