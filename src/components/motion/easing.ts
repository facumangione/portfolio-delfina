// Curvas y duraciones compartidas por todas las animaciones, para que el sitio
// se sienta consistente. "cine" arranca rápido y frena muy suave.
export const EASE_CINE = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DURATION = {
  fast: 0.35,
  base: 0.7,
  slow: 1.2,
};
