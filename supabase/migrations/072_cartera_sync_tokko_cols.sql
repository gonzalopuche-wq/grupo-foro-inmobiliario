-- Migration 072: add Tokko sync columns to cartera_sync_portales
-- Ensures the table exists (it may predate these migrations) and adds
-- the tokko_id / tokko_synced_at columns used by the import route.

CREATE TABLE IF NOT EXISTS cartera_sync_portales (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propiedad_id  uuid REFERENCES cartera_propiedades(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE cartera_sync_portales
  ADD COLUMN IF NOT EXISTS tokko_id         text,
  ADD COLUMN IF NOT EXISTS tokko_synced_at  timestamptz;

CREATE INDEX IF NOT EXISTS idx_sync_portales_tokko ON cartera_sync_portales(tokko_id)
  WHERE tokko_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_portales_propiedad
  ON cartera_sync_portales(propiedad_id);
