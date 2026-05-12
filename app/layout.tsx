import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWAInstallBanner from "./components/PWAInstallBanner";
import PWAUpdateToast from "./components/PWAUpdateToast";

export const metadata: Metadata = {
  title: "GFI — Grupo Foro Inmobiliario",
  description: "Plataforma profesional para corredores inmobiliarios de Rosario",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "GFI" },
  icons: {
    icon: [
      { url: "/logo_gfi.png", type: "image/png" },
    ],
    apple: "/logo_gfi.png",
    shortcut: "/logo_gfi.png",
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
        <link rel="apple-touch-icon" href="/logo_gfi.png" />
        <link rel="icon" type="image/png" href="/logo_gfi.png" />
      </head>
      <body suppressHydrationWarning={true}>
        {children}
        <PWAInstallBanner />
        <PWAUpdateToast />
      </body>
    </html>
  );
}
