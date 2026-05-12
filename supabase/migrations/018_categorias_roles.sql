-- Categorías y bonificaciones por usuario
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'standard';
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS bonificacion_pct integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'perfiles_bonificacion_pct_range'
  ) THEN
    ALTER TABLE perfiles ADD CONSTRAINT perfiles_bonificacion_pct_range
      CHECK (bonificacion_pct >= 0 AND bonificacion_pct <= 100);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_perfiles_categoria ON perfiles(categoria);
CREATE INDEX IF NOT EXISTS idx_perfiles_bonificacion ON perfiles(bonificacion_pct);
