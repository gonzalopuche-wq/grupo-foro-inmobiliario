# GFI® App — Setup y publicación en Google Play

App nativa (Expo / React Native) de GFI®. Paquete Android: `com.gfi.grupoforo`.

## 1. Configurar Supabase (variables de entorno)

Las credenciales se leen de variables `EXPO_PUBLIC_*` (ya **no** se editan a mano en el código).

Copiá `.env.example` a `.env` y completá con los valores de tu proyecto
(Supabase Dashboard → Settings → API — son los mismos públicos que usa la web):

```
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 2. Correr en desarrollo

```bash
cd expo-app
npm install
npx expo start
```

Escaneá el QR con **Expo Go** en tu celular.

## 3. Build para Google Play (EAS)

Ya hay un `eas.json` con los perfiles `preview` (APK para probar) y `production` (AAB para Play).

```bash
npm install -g eas-cli
eas login
eas init            # crea/vincula el projectId (la primera vez)
```

Cargá las credenciales de Supabase como variables de entorno en EAS (para que el build las tenga):

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://TU_PROYECTO.supabase.co --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJ... --environment production
```

**APK de prueba** (instalable en un teléfono):

```bash
eas build --platform android --profile preview
```

**AAB para Play Store** (lo que se sube a la consola):

```bash
eas build --platform android --profile production
```

## 4. Publicar en Play Console

1. Entrá a https://play.google.com/console y creá la app **"GFI® Grupo Foro Inmobiliario"**.
2. Subí el `.aab` generado por EAS (o automatizá con `eas submit -p android`, ver más abajo).
3. Completá la **ficha de la tienda**: descripción, ícono (512×512), gráfico destacado (1024×500) y **capturas de pantalla** (mínimo 2 de teléfono).
4. **Política de privacidad (obligatoria):** usá la URL pública
   `https://www.foroinmobiliario.com.ar/privacidad` (página ya publicada en la web).
5. Completá el **cuestionario de Seguridad de los datos** (Data safety): la app usa
   email/datos de cuenta y contenido del usuario, cifrado en tránsito, sin venta de datos.
6. Content rating y país/precio (gratis).
7. Enviá a revisión (suele tardar 1–3 días).

### Subida automática (opcional)

Para `eas submit` necesitás una cuenta de servicio de Google Play:

1. Play Console → Configuración → Acceso a la API → crear cuenta de servicio en Google Cloud y darle permiso en Play.
2. Descargá el JSON y guardalo como `expo-app/play-service-account.json` (ya referenciado en `eas.json`, **no lo subas al repo**).
3. `eas submit --platform android --profile production`

## Notas de versión

- Para cada release nuevo, EAS incrementa el `versionCode` automáticamente (perfil `production` con `autoIncrement`).
- Subí el `version` (ej. `1.0.1`) en `app.json` cuando cambie la versión visible.

## Estado de revisión de funciones (ver app)

Pantallas conectadas a Supabase: Login, Dashboard, CRM, MIR (cartera), Comunidad,
Foro, Eventos, Perfil. Las queries fueron alineadas al esquema real (tablas
`forum_topics`, `mensajes_chat`, `eventos`, etc.). Antes de publicar, probá un
login real y recorré cada pestaña con datos cargados.
