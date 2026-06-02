-- Migration 129: Campos para ajuste automático de alquileres
-- Agrega periodicidad_ajuste e indice_ajuste a contratos si no existen

ALTER TABLE crm_contratos
  ADD COLUMN IF NOT EXISTS periodicidad_ajuste integer,  -- meses entre ajustes (1, 3, 6, 12)
  ADD COLUMN IF NOT EXISTS indice_ajuste       text,     -- ICL, IPC, IRM, CVS, libre
  ADD COLUMN IF NOT EXISTS proximo_ajuste_at   date;     -- próximo ajuste calculado

CREATE INDEX IF NOT EXISTS idx_contratos_proximo_ajuste ON crm_contratos(proximo_ajuste_at)
  WHERE estado = 'activo';
