-- Migration 105: ampliar crm_contratos + crear crm_pagos_alquiler

-- ── Columnas faltantes en crm_contratos (ya existe desde migración 097) ───────

ALTER TABLE crm_contratos
  ADD COLUMN IF NOT EXISTS dia_vencimiento  int     NOT NULL DEFAULT 5
                                             CHECK (dia_vencimiento BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS estado           text    NOT NULL DEFAULT 'activo'
                                             CHECK (estado IN ('activo','finalizado','en-proceso'));

-- ── crm_pagos_alquiler: registro de pagos mensuales por contrato ─────────────

CREATE TABLE IF NOT EXISTS crm_pagos_alquiler (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id         uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  contrato_id       uuid NOT NULL REFERENCES crm_contratos(id) ON DELETE CASCADE,
  mes               text NOT NULL,                          -- YYYY-MM
  monto             numeric,                                -- null = usa alquiler_actual
  fecha_pago        date,
  estado            text NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pagado','pendiente','parcial','moroso')),
  diferencia        numeric NOT NULL DEFAULT 0,
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, mes)
);

ALTER TABLE crm_pagos_alquiler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_pagos_own_all" ON crm_pagos_alquiler
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "crm_pagos_admin_all" ON crm_pagos_alquiler
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_crm_pagos_contrato ON crm_pagos_alquiler(contrato_id, mes);
CREATE INDEX IF NOT EXISTS idx_crm_pagos_perfil_mes ON crm_pagos_alquiler(perfil_id, mes);

-- ── crm_vencimientos_custom: recordatorios personalizados del corredor ────────

CREATE TABLE IF NOT EXISTS crm_vencimientos_custom (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id         uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo            text NOT NULL,
  descripcion       text,
  fecha             date NOT NULL,
  tipo              text NOT NULL DEFAULT 'otro'
                      CHECK (tipo IN ('contrato','documento','pago','llamada','otro')),
  contacto_nombre   text,
  alerta_dias       int NOT NULL DEFAULT 7,
  completado        boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_vencimientos_custom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_venc_own_all" ON crm_vencimientos_custom
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "crm_venc_admin_all" ON crm_vencimientos_custom
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_crm_venc_perfil ON crm_vencimientos_custom(perfil_id, fecha);
