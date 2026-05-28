-- Migration 106: agregar prioridad a crm_recordatorios + índice de título

ALTER TABLE crm_recordatorios
  ADD COLUMN IF NOT EXISTS prioridad text NOT NULL DEFAULT 'media'
    CHECK (prioridad IN ('alta','media','baja')),
  ADD COLUMN IF NOT EXISTS contacto_nombre text,
  ADD COLUMN IF NOT EXISTS negocio_titulo text;
