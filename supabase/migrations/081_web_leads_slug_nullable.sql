-- Migration 081: Hacer slug nullable en web_leads
-- Necesario para leads desde la ficha pública (/inmueble/[id])
-- que se identifican por propiedad_id, no por slug de web corredor

ALTER TABLE web_leads
  ALTER COLUMN slug DROP NOT NULL;
