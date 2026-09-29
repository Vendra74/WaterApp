import * as Speech from 'expo-speech';

/**
 * Leitura em voz alta dentro do aplicativo (pt-BR). Só funciona com o app aberto:
 * não prometemos avisos falados em segundo plano, pois as plataformas não garantem isso.
 */
export function speak(text: string): void {
  try {
    Speech.stop();
    Speech.speak(text, { language: 'pt-BR', rate: 0.9, pitch: 1.0 });
  } catch {
    // TTS indisponível: falha silenciosa; o texto continua visível na tela.
  }
}

export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    // ignorar
  }
}
