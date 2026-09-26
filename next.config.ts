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
};

export default nextConfig;
