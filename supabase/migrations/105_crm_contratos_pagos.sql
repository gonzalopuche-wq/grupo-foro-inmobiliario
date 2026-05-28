-- Migration 105: CRM Cobranzas — crm_contratos + crm_pagos_alquiler

-- ── crm_contratos: contratos de alquiler gestionados por el corredor ─────────

CREATE TABLE IF NOT EXISTS crm_contratos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id         uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  inquilino         text NOT NULL,
  propiedad         text NOT NULL,
  telefono          text,
  alquiler_base     numeric NOT NULL DEFAULT 0,
  moneda            text NOT NULL DEFAULT 'ARS' CHECK (moneda IN ('ARS','USD')),
  dia_vencimiento   int NOT NULL DEFAULT 5 CHECK (dia_vencimiento BETWEEN 1 AND 31),
  fecha_inicio      date,
  fecha_fin         date,
  estado            text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','finalizado','en-proceso')),
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_contratos_own_all" ON crm_contratos
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "crm_contratos_admin_all" ON crm_contratos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_crm_contratos_perfil ON crm_contratos(perfil_id, estado);

-- ── crm_pagos_alquiler: registro de pagos mensuales por contrato ─────────────

CREATE TABLE IF NOT EXISTS crm_pagos_alquiler (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id         uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  contrato_id       uuid NOT NULL REFERENCES crm_contratos(id) ON DELETE CASCADE,
  mes               text NOT NULL,                          -- YYYY-MM
  monto             numeric,                                -- null = usa alquiler_base
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
