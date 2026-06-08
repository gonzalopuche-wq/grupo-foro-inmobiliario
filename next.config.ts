import type { NextConfig } from "next";

const securityHeaders = [
  // Evita clickjacking — no permite embeber en iframes externos
  { key: "X-Frame-Options", value: "DENY" },
  // Evita MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Fuerza HTTPS por 2 años, incluye subdominios
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Controla info del referrer
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deshabilita features innecesarias — incluye clipboard-read/write para terceros
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self), interest-cohort=(), clipboard-read=(), clipboard-write=(self), payment=()" },
  // XSS Protection (legacy browsers)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // DNS Prefetch Control
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Evita que ventanas abiertas desde GFI puedan acceder a window.opener
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Evita que otros sitios carguen recursos de GFI (imágenes, scripts)
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      // Solo recursos del mismo origen por defecto
      "default-src 'self'",
      // Scripts: propio + Vercel analytics + Google Analytics + scripts inline necesarios para Next.js
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://cdn.vercel-insights.com https://www.googletagmanager.com https://www.google-analytics.com",
      // Estilos: propio + Google Fonts + inline (necesario para styled-jsx)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fuentes: propio + Google Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Imágenes: propio + data URIs + servicios externos usados en GFI
      "img-src 'self' data: blob: https: http:",
      // Conexiones fetch/XHR/WebSocket
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://dolarapi.com https://argentinadatos.com https://api.openweathermap.org https://api.mercadolibre.com https://api.bcra.gob.ar https://apis.datos.gob.ar https://api.anthropic.com https://vercel.live https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://nominatim.openstreetmap.org https://*.ingest.sentry.io",
      // Frames: Vercel preview + Google Calendar embed
      "frame-src 'self' https://vercel.live https://calendar.google.com",
      // Audio y video (blob: para preview local, supabase para reproducción post-envío)
      "media-src 'self' blob: https://*.supabase.co",
      // Manifest y workers
      "manifest-src 'self'",
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

// Endurecimiento extra para el panel de administración: contenido sensible que
// no debe indexarse, cachearse ni archivarse en ningún lado. La protección real
// de los datos la dan Supabase RLS (devuelve 403 a quien no es admin) y el
// chequeo de sesión; estos headers cierran las vías de fuga del lado servidor.
const adminHardeningHeaders = [
  // Ningún buscador/crawler indexa, archiva ni muestra snippets del panel.
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
  // Nada de caché en navegador, proxies ni CDN para datos sensibles.
  { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Aplicar a todas las rutas
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Panel admin: sin indexación ni caché (incluye /admin y subrutas)
        source: "/admin/:path*",
        headers: adminHardeningHeaders,
      },
    ];
  },

  // Dominios de imágenes permitidos
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "openweathermap.org" },
      { protocol: "https", hostname: "**.openweathermap.org" },
      { protocol: "https", hostname: "http2.mlstatic.com" },
      { protocol: "https", hostname: "**.mlstatic.com" },
      { protocol: "https", hostname: "**.zonaprop.com.ar" },
      { protocol: "https", hostname: "**.argenprop.com" },
    ],
  },

  // Opciones de seguridad adicionales
  poweredByHeader: false, // Oculta X-Powered-By: Next.js
};

export default nextConfig;
