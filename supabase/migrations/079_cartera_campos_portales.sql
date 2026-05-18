-- Migration 079: Campos de portales inmobiliarios en cartera_propiedades
-- Campos adicionales detectados en Argenprop, ZonaProp y MercadoLibre
-- que GFI no tenía: tipo de piso, calefacción, gas, vista y uso profesional

ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS tipo_piso        text,
  ADD COLUMN IF NOT EXISTS tipo_calefaccion text,
  ADD COLUMN IF NOT EXISTS tipo_gas         text,
  ADD COLUMN IF NOT EXISTS tipo_vista       text,
  ADD COLUMN IF NOT EXISTS uso_profesional  boolean DEFAULT false;
