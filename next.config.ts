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
  // Deshabilita features innecesarias
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()" },
  // XSS Protection (legacy browsers)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // DNS Prefetch Control
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      // Solo recursos del mismo origen por defecto
      "default-src 'self'",
      // Scripts: propio + Vercel analytics + scripts inline necesarios para Next.js
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://cdn.vercel-insights.com",
      // Estilos: propio + Google Fonts + inline (necesario para styled-jsx)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fuentes: propio + Google Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Imágenes: propio + data URIs + servicios externos usados en GFI
      "img-src 'self' data: blob: https: http:",
      // Conexiones fetch/XHR/WebSocket
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://dolarapi.com https://argentinadatos.com https://api.openweathermap.org https://api.mercadolibre.com https://api.bcra.gob.ar https://apis.datos.gob.ar https://api.anthropic.com https://vercel.live",
      // Frames: solo Vercel preview
      "frame-src 'self' https://vercel.live",
      // Manifest y workers
      "manifest-src 'self'",
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Aplicar a todas las rutas
        source: "/:path*",
        headers: securityHeaders,
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
