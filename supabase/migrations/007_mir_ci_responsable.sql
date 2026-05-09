-- ── MIR: columna ci_responsable_id en ofrecidos y búsquedas ──────────────────
-- Permite indicar qué corredor matriculado es el C.I. responsable de la
-- publicación (útil cuando la publica un colaborador).

ALTER TABLE mir_ofrecidos
  ADD COLUMN IF NOT EXISTS ci_responsable_id uuid REFERENCES perfiles(id) ON DELETE SET NULL;

ALTER TABLE mir_busquedas
  ADD COLUMN IF NOT EXISTS ci_responsable_id uuid REFERENCES perfiles(id) ON DELETE SET NULL;
