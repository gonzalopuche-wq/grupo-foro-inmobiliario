import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Las credenciales se leen de variables de entorno EXPO_PUBLIC_* (Expo las inyecta
// en el build). Configuralas en un `.env` local (ver .env.example) y como variables
// de entorno en EAS para los builds de Google Play.
//   EXPO_PUBLIC_SUPABASE_URL
//   EXPO_PUBLIC_SUPABASE_ANON_KEY
// Son los mismos valores públicos que usa la web (NEXT_PUBLIC_SUPABASE_*).
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[GFI] Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Copiá .env.example a .env y completalos (o seteálos en EAS).'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
