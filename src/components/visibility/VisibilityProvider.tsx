"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Visibilidad por persona en el navegador — la calcula el servidor en el
 * layout (src/lib/visibility-server.ts) y llega aquí como lista de claves
 * ocultas. Fuera del provider no se oculta nada.
 */
const VisibilityContext = createContext<Set<string>>(new Set());

export function VisibilityProvider({ hiddenKeys, children }: { hiddenKeys: string[]; children: ReactNode }) {
  const hidden = useMemo(() => new Set(hiddenKeys), [hiddenKeys]);
  return <VisibilityContext.Provider value={hidden}>{children}</VisibilityContext.Provider>;
}

/** Conjunto de claves ocultas para el usuario en sesión. */
export function useHiddenKeys(): Set<string> {
  return useContext(VisibilityContext);
}

/** Atajo: devuelve una función `visible(key)`. */
export function useVisible(): (key: string) => boolean {
  const hidden = useHiddenKeys();
  return (key: string) => !hidden.has(key);
}
