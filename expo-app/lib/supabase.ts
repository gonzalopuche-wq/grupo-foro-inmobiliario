import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Reemplazá estos valores con los de tu proyecto Supabase
// Los encontrás en: Supabase Dashboard → Settings → API
export const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'TU_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
