-- Migración 133: Push notifications nativas (Expo) para la app de Google Play
-- ─────────────────────────────────────────────────────────────────────────────
-- La app registra su Expo Push Token acá. Un cron (/api/cron/push-expo) envía
-- push por las notificaciones aún no despachadas (notificaciones.push_enviada).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expo_push_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id  uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  plataforma text,
  creado_at  timestamptz NOT NULL DEFAULT now(),
  usado_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expo_push_tokens_perfil ON expo_push_tokens(perfil_id);

ALTER TABLE expo_push_tokens ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expo_push_tokens' AND policyname = 'expo_push_own') THEN
    CREATE POLICY expo_push_own ON expo_push_tokens
      FOR ALL USING (perfil_id = auth.uid()) WITH CHECK (perfil_id = auth.uid());
  END IF;
END $$;

-- Registro del token vía función SECURITY DEFINER: permite reasignar el token al
-- usuario actual aunque en ese dispositivo lo hubiera registrado otro usuario antes
-- (la policy de la tabla sigue siendo estricta "solo lo propio").
CREATE OR REPLACE FUNCTION registrar_push_token(p_token text, p_plataforma text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  INSERT INTO expo_push_tokens (perfil_id, token, plataforma, usado_at)
  VALUES (auth.uid(), p_token, p_plataforma, now())
  ON CONFLICT (token) DO UPDATE
    SET perfil_id = auth.uid(), plataforma = EXCLUDED.plataforma, usado_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION registrar_push_token(text, text) TO authenticated;

-- Marca para no reenviar push de la misma notificación.
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS push_enviada boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_notificaciones_push_pend ON notificaciones(push_enviada) WHERE push_enviada = false;
