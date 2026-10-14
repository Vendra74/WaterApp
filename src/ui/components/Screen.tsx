import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { useTheme } from '../theme';

interface Props {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  /**
   * Telas sem cabeçalho de navegação (abas e boas-vindas): afasta o conteúdo da barra de status do aparelho.
   * Só no Android: no iOS a ScrollView já aplica esse recuo sozinha (contentInsetAdjustmentBehavior) e somar
   * o inset deixaria um espaço dobrado no topo.
   */
  safeTop?: boolean;
}

/**
 * Rola a tela até um elemento ficar inteiro à vista (acima do rodapé fixo). Usado por campos que crescem ao
 * abrir, como a roleta de horário do iOS, que senão fica escondida atrás do botão “Próximo”.
 */
type Reveal = (node: View | null) => void;
const RevealContext = createContext<Reveal>(() => {});
export function useRevealInScreen(): Reveal {
  return useContext(RevealContext);
}

export function Screen({ title, children, footer, scroll = true, safeTop = false }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const offsetY = useRef(0);
  const viewportHeight = useRef(0);
  const margin = t.space(2);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    viewportHeight.current = e.nativeEvent.layout.height;
  }, []);

  const reveal = useCallback<Reveal>(
    (node) => {
      const sv = scrollRef.current;
      const host = sv?.getNativeScrollRef();
      if (!node || !sv || !host || !viewportHeight.current) return;
      // Um quadro depois do layout, para a ScrollView já conhecer o novo tamanho do conteúdo.
      requestAnimationFrame(() => host.measureInWindow((_sx, svTop) => {
        node.measureInWindow((_x, nodeTop, _w, nodeHeight) => {
          const nodeBottom = nodeTop + nodeHeight;
          const viewportBottom = svTop + viewportHeight.current;
          const hiddenBelow = nodeBottom + margin - viewportBottom;
          if (hiddenBelow <= 0) return;
          // Não esconde o topo do elemento para mostrar o fim: se não couber inteiro, alinha o topo.
          const maxShift = Math.max(0, nodeTop - svTop - margin);
          sv.scrollTo({ y: offsetY.current + Math.min(hiddenBelow, maxShift), animated: true });
        });
      }));
    },
    [margin],
  );
  const contextValue = useMemo(() => (scroll ? reveal : () => {}), [scroll, reveal]);

  const content = (
    <View style={{ padding: t.space(2), gap: t.space(2), paddingTop: t.space(2) + (safeTop && Platform.OS === 'android' ? insets.top : 0), paddingBottom: t.space(4) }}>
      {title ? <AppText variant="title">{title}</AppText> : null}
      {children}
    </View>
  );
  return (
    <RevealContext.Provider value={contextValue}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} onLayout={onLayout} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
            {content}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{content}</View>
        )}
        {footer ? (
          <View style={{ padding: t.space(2), paddingBottom: Math.max(insets.bottom, t.space(2)), gap: t.space(1), backgroundColor: t.colors.surface, borderTopWidth: 1, borderTopColor: t.colors.border }}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </RevealContext.Provider>
  );
}
