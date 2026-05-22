-- Agrega columna destacada_web a cartera_propiedades
-- Permite marcar propiedades como destacadas en el sitio web del corredor
ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS destacada_web boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cartera_propiedades_destacada_web
  ON cartera_propiedades(destacada_web) WHERE destacada_web = true;
