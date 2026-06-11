# Publicar la PWA en Google Play como TWA (alternativa a la app Expo)

Un **TWA (Trusted Web Activity)** empaqueta la PWA (la web) como app nativa de Android,
mostrando el sitio a pantalla completa sin barra del navegador. Es la vía más rápida para
tener **toda** la plataforma en Play sin mantener pantallas nativas aparte.

Requisitos ya listos en este repo:
- `public/manifest.json` (nombre, íconos 192/512, `display: standalone`, `theme_color`).
- Service worker / PWA instalable.
- `public/.well-known/assetlinks.json` (falta solo completar la huella SHA-256, ver abajo).

## Opción A — PWABuilder (la más simple, sin instalar nada)

1. Entrá a https://www.pwabuilder.com e ingresá `https://www.foroinmobiliario.com.ar`.
2. Revisá el reporte de PWA (manifest + service worker) y tocá **Package for stores → Android**.
3. Configurá:
   - **Package ID**: `com.gfi.grupoforo`
   - **App name**: GFI® Grupo Foro Inmobiliario
   - Signing key: dejá que PWABuilder genere una, o usá la de Play App Signing.
4. Descargá el `.aab` + el `assetlinks.json` que te da (con la huella correcta).

## Opción B — Bubblewrap (CLI de Google)

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://www.foroinmobiliario.com.ar/manifest.json
# package id: com.gfi.grupoforo
bubblewrap build      # genera app-release-bundle.aab
```

## Completar el Digital Asset Links (obligatorio para que abra sin barra)

1. Subí el `.aab` a Play Console → activá **Play App Signing**.
2. En Play Console → **Configuración → Integridad de la app → firma de apps**, copiá la
   huella **SHA-256** del certificado.
3. Pegala en `public/.well-known/assetlinks.json` reemplazando `REEMPLAZAR_CON_SHA256_DE_FIRMA_DE_PLAY`
   y deployá la web. Verificá que `https://www.foroinmobiliario.com.ar/.well-known/assetlinks.json`
   devuelva el JSON.

> Si la huella no coincide, la app abre con la barra del navegador (Custom Tab) en vez de
> pantalla completa. Con `assetlinks.json` correcto, abre como app nativa.

## Play Console (igual que la app Expo)

- Política de privacidad: `https://www.foroinmobiliario.com.ar/privacidad`
- Capturas, gráfico destacado, cuestionario de Data safety, content rating.

## ¿Expo o TWA?

- **TWA**: toda la web en Play, mantenimiento cero (se actualiza con la web). Requiere conexión.
- **Expo**: app nativa, mejor rendimiento y push nativas, pero hay que portar cada pantalla.

Podés publicar **las dos** (con el mismo `package_name` no: usá uno distinto si querés ambas,
ej. `com.gfi.grupoforo.web`).
