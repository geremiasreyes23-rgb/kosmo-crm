import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Tipografía global — Inter, elegida por legibilidad a cualquier tamaño
// (x-height alto, formas simples) y consistencia entre Windows/Mac/Linux,
// a diferencia de Century Gothic (que en Mac/Linux cae al fallback del
// sistema por no venir preinstalada). Se carga vía next/font: Next.js la
// auto-hospeda en build (sin llamada a Google en runtime) y expone la
// variable CSS --font-inter, que globals.css usa como valor de
// --font-kosmo — así no hace falta tocar ningún componente que ya
// referencia esa variable.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KOSMO CRM",
  description: "KOSMO — plataforma CRM para agencias de seguros",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
