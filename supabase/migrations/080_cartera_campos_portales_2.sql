-- Migration 080: Más campos de portales
-- tipo_edificio y tipo_agua_caliente detectados en HTML real de Argenprop
-- financia_vendedor: filtro destacado en Argenprop y ZonaProp

ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS tipo_edificio       text,
  ADD COLUMN IF NOT EXISTS tipo_agua_caliente  text,
  ADD COLUMN IF NOT EXISTS financia_vendedor   boolean DEFAULT false;
