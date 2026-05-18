-- Migration 083: Campos pendientes de Propia + planos de ZonaProp
-- situacion: enum Vacía/Habitada/Alquilada (más rico que el boolean habitada)
-- tipo_cielorraso: detectado en Propia (ceiling_type_id)
-- tipo_acceso: detectado en Propia (access_id)
-- planos: array de URLs de imágenes de planos, detectado en ZonaProp

ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS situacion       text,
  ADD COLUMN IF NOT EXISTS tipo_cielorraso text,
  ADD COLUMN IF NOT EXISTS tipo_acceso     text,
  ADD COLUMN IF NOT EXISTS planos          text[];
