import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWAInstallBanner from "./components/PWAInstallBanner";
import PWAUpdateToast from "./components/PWAUpdateToast";

export const metadata: Metadata = {
  title: "GFI — Grupo Foro Inmobiliario",
  description: "Plataforma profesional para corredores inmobiliarios de Rosario",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "GFI®" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png?v=3", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png?v=3", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=3", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png?v=3", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#cc0000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GFI" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png?v=3" />
        <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=3" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png?v=3" />
      </head>
      <body suppressHydrationWarning={true}>
        {children}
        <PWAInstallBanner />
        <PWAUpdateToast />
      </body>
    </html>
  );
}
