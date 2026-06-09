-- Migración 132: Sesión única por dispositivo (corredor inmobiliario)
-- ─────────────────────────────────────────────────────────────────────────────
-- Si el corredor inicia sesión en un dispositivo nuevo, el anterior queda
-- desplazado y se desconecta. Mecanismo: cada dispositivo guarda un id de sesión
-- local (localStorage) y al loguearse lo escribe en perfiles.sesion_activa_id
-- (pisando el del dispositivo anterior). El cliente compara periódicamente su id
-- local con el de la BD; si no coincide, cierra sesión.
--
-- La política RLS perfiles_update_own (migración 023) ya permite que el usuario
-- actualice su propia fila, así que no hace falta una policy nueva.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS sesion_activa_id text;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS sesion_activa_at timestamptz;
