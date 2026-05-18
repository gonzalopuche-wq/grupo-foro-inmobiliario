-- Migration 082: Tipo de cochera
-- Detectado en Propia (garage_coverage_type): cubierta / semicubierta / descubierta

ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS tipo_cochera text;
