-- ── Red GFI: cartera → mir_ofrecidos sharing ──────────────────────────────
ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS compartir_en_red  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mir_ofrecido_id   uuid REFERENCES mir_ofrecidos(id) ON DELETE SET NULL;

-- Add fotos to mir_ofrecidos so shared cartera properties keep their photos
ALTER TABLE mir_ofrecidos
  ADD COLUMN IF NOT EXISTS fotos             text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cartera_id        uuid REFERENCES cartera_propiedades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS honorario_compartir text;

-- Per-user portal API credentials (override global env vars)
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
