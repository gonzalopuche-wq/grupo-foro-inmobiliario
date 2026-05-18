-- Migration 084: Campos de MercadoLibre
-- sup_terreno: superficie del lote/terreno (LAND_AREA), distinto de superficie_total
-- forma_terreno: Regular/Irregular/En L — para terrenos y casas
-- acceso_calle: Pavimento/Tierra/Ripio — para propiedades rurales y terrenos

ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS sup_terreno    numeric(10,2),
  ADD COLUMN IF NOT EXISTS forma_terreno  text,
  ADD COLUMN IF NOT EXISTS acceso_calle   text;
