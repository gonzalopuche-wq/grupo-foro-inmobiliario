-- Crear portal_credenciales si todavía no existe (fue parte de 005 pero puede no haberse aplicado)
CREATE TABLE IF NOT EXISTS portal_credenciales (
  perfil_id     uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  tokko_key     text,
  kiteprop_key  text,
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE portal_credenciales ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'portal_credenciales' AND policyname = 'corredor_sus_credenciales'
  ) THEN
    CREATE POLICY "corredor_sus_credenciales"
      ON portal_credenciales FOR ALL
      USING (auth.uid() = perfil_id);
  END IF;
END $$;

-- Columnas OAuth de MercadoLibre
ALTER TABLE portal_credenciales
  ADD COLUMN IF NOT EXISTS ml_app_id           text,
  ADD COLUMN IF NOT EXISTS ml_app_secret       text,
  ADD COLUMN IF NOT EXISTS ml_access_token     text,
  ADD COLUMN IF NOT EXISTS ml_refresh_token    text,
  ADD COLUMN IF NOT EXISTS ml_token_expires_at timestamptz;
