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

-- Marca para no reenviar push de la misma notificación.
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS push_enviada boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_notificaciones_push_pend ON notificaciones(push_enviada) WHERE push_enviada = false;
