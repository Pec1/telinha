export interface ScreenCandidate {
  identity: string;
  isLocal: boolean;
}

/**
 * Qual tela fica em destaque: a escolhida pelo espectador, se ainda estiver no ar; senão a
 * primeira tela de outra pessoa (quem assiste quer ver os outros); por último a própria.
 */
export function pickFocusedIdentity(screens: ScreenCandidate[], selected: string | null): string | null {
  if (selected && screens.some((s) => s.identity === selected)) return selected;
  return (screens.find((s) => !s.isLocal) ?? screens[0])?.identity ?? null;
}
