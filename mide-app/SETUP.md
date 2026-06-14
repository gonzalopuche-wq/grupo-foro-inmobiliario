# GFI MIDE — App de relevamiento (medición, plano, 3D y descripción IA)

App **Expo independiente** del `expo-app/` principal. Paquete Android: `com.gfi.mide`.
Sirve para que el corredor releve una propiedad en el teléfono:

1. **Medir ambientes** con la cámara (clinómetro) o a mano.
2. **Armar el plano 2D** a escala.
3. **Recorrido 3D** (extrusión de las paredes).
4. **Descripción automática** del aviso con IA, usando las fotos del recorrido + las medidas.

## 1. Variables de entorno

Copiá `.env.example` a `.env` y completá:

```
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_API_BASE=https://www.foroinmobiliario.com.ar
```

Son las mismas credenciales públicas de Supabase que usa la web. `EXPO_PUBLIC_API_BASE`
apunta al backend Next.js donde vive `/api/mide/descripcion`.

## 2. Migración de base de datos

Corré en Supabase la migración **`supabase/migrations/138_mide_relevamientos.sql`**
(del repo raíz). Crea la tabla `mide_relevamientos` con RLS por corredor.

## 3. Instalar y correr en desarrollo

```bash
cd mide-app
npm install
# Alinear las versiones nativas exactas al SDK 56 (IMPORTANTE):
npx expo install expo-camera expo-gl expo-sensors expo-image-manipulator \
  react-native-svg react-native-gesture-handler
npx expo start
```

> Las versiones en `package.json` son orientativas. `npx expo install` ajusta cada
> paquete nativo a la versión exacta compatible con Expo SDK 56. Confirmá las APIs
> contra https://docs.expo.dev/versions/v56.0.0/ (expo-camera usa `CameraView` +
> `useCameraPermissions`).

### Probar en el teléfono

- La **cámara** y los **sensores de movimiento** (medición con clinómetro) **no
  funcionan en Expo Go web ni en el emulador**: probá en un **build de desarrollo**
  (`eas build --profile development`) o en Expo Go en un teléfono real.

## 4. Cómo se mide con la cámara (clinómetro)

No usamos ARCore/LiDAR (no está disponible en Expo managed). En su lugar:

- El corredor se para contra una pared y apunta la cámara a la **base de la pared de
  enfrente**.
- Con el **ángulo de la cámara** (sensores) y la **altura a la que sostiene el teléfono**
  (ajustable en pantalla, default 1,40 m) se estima la distancia: `d = altura / tan(ángulo)`.
- Es una **estimación asistida**: la medida siempre se puede corregir a mano en la tarjeta
  del ambiente.

> **Fase 2 (opcional):** medición milimétrica con ARCore Depth requiere un módulo nativo
> y un **dev-client custom** (salir de Expo managed). La arquitectura ya deja la medida
> desacoplada (`lib/clinometer.ts`), así que se puede sumar otro proveedor de medición
> sin tocar el resto.

## 5. Build y publicación en Google Play (EAS)

```bash
npm install -g eas-cli
eas login
eas init           # crea/vincula el projectId (primera vez)

# Cargar las env vars en EAS para el build:
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://TU_PROYECTO.supabase.co --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJ... --environment production
eas env:create --name EXPO_PUBLIC_API_BASE --value https://www.foroinmobiliario.com.ar --environment production

eas build --platform android --profile preview      # APK de prueba
eas build --platform android --profile production    # AAB para Play
```

En Play Console (app nueva, **distinta** de `com.gfi.grupoforo`):
- Política de privacidad: `https://www.foroinmobiliario.com.ar/privacidad`
- Data safety: usa cámara (no se sube el video; las fotos se mandan a la IA para
  generar la descripción), email/cuenta, cifrado en tránsito, sin venta de datos.
- Ficha: ícono 512×512, gráfico destacado, capturas (mínimo 2).

## Estructura

```
mide-app/
  App.tsx                  navegación + auth
  state/relevamiento.tsx   estado global (Supabase)
  lib/
    types.ts               modelo (Ambiente, Relevamiento, áreas)
    geometry.ts            layout del plano 2D (row-packing a escala)
    clinometer.ts          medición con cámara (ángulo → distancia)
    api.ts                 fetch autenticado al backend
    supabase.ts / theme.ts
  components/
    AmbienteCard.tsx       tarjeta editable con medidas + foto
    CamaraMedir.tsx        cámara + clinómetro
    CamaraFoto.tsx         cámara para foto del recorrido
  screens/
    LoginScreen, RelevamientosScreen, MedicionScreen,
    PlanoScreen, Tour3DScreen, DescripcionScreen
```

## Alcance de esta versión

- ✅ Medición de ambientes (cámara/clinómetro + manual) y superficie total.
- ✅ Plano 2D a escala (esquemático por bloques).
- ✅ Recorrido 3D (extrusión de paredes, cámara orbital).
- ✅ Descripción automática con IA (Claude vision) desde las fotos + medidas.
- ⏳ Fase 2: medición ARCore Depth, plano con adyacencias reales, exportar a
  `cartera_propiedades`, tour 360°.
