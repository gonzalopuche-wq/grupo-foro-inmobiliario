import { supabase } from './supabase';

// Base del backend Next.js (donde vive /api/mide/descripcion).
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? 'https://www.foroinmobiliario.com.ar';

/** fetch autenticado contra el backend, con el access token de Supabase. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Sesión expirada. Volvé a iniciar sesión.');

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `Error ${res.status}`);
  }
  return json as T;
}
