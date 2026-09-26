import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KOSMO CRM",
  description: "KOSMO — plataforma CRM para agencias de seguros",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
