import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Por defecto Next.js corta el body de un Server Action en 1MB — muy
      // por debajo de lo que este CRM ya permite subir como base64 (fotos de
      // Mensajería hasta 3MB, que en base64 pesan ~4MB; adjuntos de Correo
      // interno hasta MailSettings.maxAttachmentSizeMb, 10MB por defecto,
      // configurable desde Configuración → Comunicación). Sin este límite
      // más alto, el sendMessageAction de mensajería o el de correo (y
      // saveDraftAction) rechazan la petición ANTES de que corra el código
      // — el envío falla en silencio,
      // sin ningún error visible en la UI, que es justo el bug reportado
      // ("las imágenes en mensajería no se envían"). Si en el futuro se sube
      // maxAttachmentSizeMb bastante más alto, este número debe subir con él.
      bodySizeLimit: "20mb",
    },
  },
  // Next.js (desde la v15) bloquea/advierte sobre peticiones internas del
  // dev server (HMR, Server Actions, assets) cuando el navegador entra por
  // un dominio distinto a localhost — exactamente lo que pasa al probar
  // por un túnel de ngrok. Sin esto, el websocket de recarga en caliente
  // falla en silencio y la página puede recargarse a medio cargar (lo que
  // rompía el logo animado). Se permite el dominio del túnel para que el
  // dev server confíe en esas peticiones igual que confía en localhost.
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.io",
    "*.ngrok.app",
  ],

  // Fase 15 (preparación para producción) — Next.js no agrega estos headers
  // por defecto. Es una herramienta interna detrás de login (no un sitio
  // público), así que el enfoque es defensa básica en profundidad, no una
  // política de CSP estricta que podría romper algo (Recharts, Three.js del
  // logo animado, data: URLs de avatares/adjuntos embebidos) sin más
  // pruebas — de ahí que no se agregue Content-Security-Policy todavía.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
