-- Migration 068: fix crm_propiedades_guardadas schema gaps
--
-- Migration 034 created crm_propiedades_guardadas with basic columns.
-- Migration 066 tried to redefine it with CREATE TABLE IF NOT EXISTS (no-op).
-- This migration adds all the columns the application expects that 034 lacks.
-- Uses ADD COLUMN IF NOT EXISTS so it's safe to run even if some were added manually.

-- ── crm_propiedades_guardadas: add missing columns ────────────────────────────

ALTER TABLE crm_propiedades_guardadas
  ADD COLUMN IF NOT EXISTS portal               text,
  ADD COLUMN IF NOT EXISTS disponible           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fecha_baja           timestamptz,
  ADD COLUMN IF NOT EXISTS precio_anterior      numeric,
  ADD COLUMN IF NOT EXISTS precio_actualizado_at timestamptz,
  ADD COLUMN IF NOT EXISTS descripcion          text,
  ADD COLUMN IF NOT EXISTS portal_id            text;

-- Backfill disponible = true for any existing rows (safe since DEFAULT handles new rows)
UPDATE crm_propiedades_guardadas SET disponible = true WHERE disponible IS NULL;

-- Index for scraper cron (fetches by disponible + portal)
CREATE INDEX IF NOT EXISTS idx_crm_pg_disponible ON crm_propiedades_guardadas(disponible) WHERE disponible = true;

-- ── crm_busqueda_alertas: add missing leida column ───────────────────────────
-- Migration 034 created crm_busqueda_alertas without leida; 066 added it in
-- a no-op CREATE TABLE IF NOT EXISTS.

ALTER TABLE crm_busqueda_alertas
  ADD COLUMN IF NOT EXISTS leida boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_crm_ba_no_leida ON crm_busqueda_alertas(corredor_id) WHERE leida = false;
