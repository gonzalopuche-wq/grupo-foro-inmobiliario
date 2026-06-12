-- Migración 137: color para las Listas de distribución de la Comunidad
-- ─────────────────────────────────────────────────────────────────────────────
-- Las listas de distribución (broadcast) ahora pueden tener un color, para
-- identificarlas de un vistazo (estilo "Listas" de WhatsApp Business).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE listas_distribucion
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#3b82f6';
