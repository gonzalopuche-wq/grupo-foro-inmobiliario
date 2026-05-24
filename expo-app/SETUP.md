# GFI® App — Setup

## 1. Configurar Supabase

Editá `lib/supabase.ts` y reemplazá los placeholders:

```ts
export const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'TU_ANON_KEY';
```

Los encontrás en: Supabase Dashboard → Settings → API

## 2. Correr en desarrollo

```bash
cd expo-app
npm install
npx expo start
```

Escaneá el QR con la app **Expo Go** en tu celular.

## 3. Generar APK para Play Store

### Instalar EAS CLI

```bash
npm install -g eas-cli
eas login
```

### Configurar EAS Build

```bash
eas build:configure
```

### Build APK (Android)

```bash
eas build --platform android --profile preview
```

Esto genera un `.apk` que podés subir directamente a Google Play Console.

Para un `.aab` (recomendado para Play Store):

```bash
eas build --platform android --profile production
```

## 4. Publicar en Play Store

1. Entrá a play.google.com/console
2. Crear nueva aplicación → "GFI® Grupo Foro Inmobiliario"
3. Subir el `.aab` generado por EAS
4. Completar ficha de la app (descripción, capturas de pantalla)
5. Enviar para revisión (tarda 1-3 días)
