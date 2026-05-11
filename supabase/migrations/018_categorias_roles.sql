-- Categorías y bonificaciones por usuario
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'standard';
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS bonificacion_pct integer NOT NULL DEFAULT 0;

ALTER TABLE perfiles ADD CONSTRAINT IF NOT EXISTS perfiles_bonificacion_pct_range
  CHECK (bonificacion_pct >= 0 AND bonificacion_pct <= 100);

CREATE INDEX IF NOT EXISTS idx_perfiles_categoria ON perfiles(categoria);
CREATE INDEX IF NOT EXISTS idx_perfiles_bonificacion ON perfiles(bonificacion_pct);
