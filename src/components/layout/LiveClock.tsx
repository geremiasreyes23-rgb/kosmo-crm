"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reloj en tiempo real — reemplaza el nombre/rol que antes se mostraba
 * junto al avatar en el Header (a pedido: "quites lo del nombre y el rol y
 * agregues un reloj en tiempo real"). Arranca vacío y recién muestra la
 * hora dentro de useEffect (client-only): el server no puede saber la hora
 * exacta del reloj del navegador de antemano, así que si arrancara con
 * `new Date()` directo en el render, la hora del HTML del servidor y la del
 * cliente casi nunca coincidirían al hidratar (warning de hydration
 * mismatch en la consola) — con este patrón eso nunca pasa, porque el
 * server siempre renderiza "" para este componente.
 */
export function LiveClock({ className }: { className?: string }) {
  const [time, setTime] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function update() {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
    }
    update();

    // No hace falta actualizar más seguido que una vez por minuto (no se
    // muestran segundos) — se alinea al segundo 0 del próximo minuto para
    // que el cambio de hora se vea justo cuando corresponde, no a los 40s.
    const msToNextMinute = 60000 - (Date.now() % 60000);
    const alignTimeout = setTimeout(() => {
      update();
      intervalRef.current = setInterval(update, 60000);
    }, msToNextMinute);

    return () => {
      clearTimeout(alignTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {time}
    </span>
  );
}
