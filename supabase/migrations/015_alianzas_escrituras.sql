-- ─────────────────────────────────────────────────────────────────────────────
-- 015 · Alianzas entre corredores + Seguimiento de Escrituras
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Alianzas entre corredores ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_alianzas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proponente_id   UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  receptor_id     UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  negocio_id      UUID REFERENCES crm_negocios(id) ON DELETE SET NULL,
  tipo            TEXT NOT NULL DEFAULT 'operacion_compartida', -- operacion_compartida | captacion | referido
  titulo          TEXT NOT NULL,
  descripcion     TEXT,
  split_pct       NUMERIC(5,2),            -- % para el receptor
  estado          TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente | aceptada | rechazada | cancelada | completada
  mensaje_respuesta TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proponente_id, receptor_id, negocio_id)
);

ALTER TABLE crm_alianzas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alianzas_partes" ON crm_alianzas;
CREATE POLICY "alianzas_partes" ON crm_alianzas
  FOR ALL USING (proponente_id = auth.uid() OR receptor_id = auth.uid());

-- ── 2. Seguimiento de Escrituras — hitos por negocio ────────────────────────
CREATE TABLE IF NOT EXISTS crm_escritura_hitos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id     UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  negocio_id    UUID NOT NULL REFERENCES crm_negocios(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,   -- reserva | boleto | escritura | posesion | liquidacion | otro
  fecha         DATE NOT NULL,
  completado    BOOLEAN NOT NULL DEFAULT FALSE,
  notas         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(negocio_id, tipo)
);

ALTER TABLE crm_escritura_hitos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "escritura_hitos_owner" ON crm_escritura_hitos;
CREATE POLICY "escritura_hitos_owner" ON crm_escritura_hitos
  FOR ALL USING (perfil_id = auth.uid());
