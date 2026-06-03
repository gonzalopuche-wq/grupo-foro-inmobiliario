-- MIGRACIÓN 130: pagos_mp (MercadoPago) + firma_solicitudes (firma digital por email)

-- ── pagos_mp: registro de pagos generados via MercadoPago ──────────────────────
CREATE TABLE IF NOT EXISTS pagos_mp (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contrato_id     uuid REFERENCES crm_contratos(id) ON DELETE SET NULL,
  preference_id   text NOT NULL,
  concepto        text NOT NULL,
  monto           numeric(12,2) NOT NULL,
  moneda          text NOT NULL DEFAULT 'ARS',
  email_pagador   text NOT NULL,
  descripcion     text,
  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado','cancelado')),
  init_point      text,
  mp_payment_id   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pagos_mp ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pagos_mp' AND policyname='pagos_mp_own_all') THEN
    CREATE POLICY "pagos_mp_own_all" ON pagos_mp
      FOR ALL TO authenticated
      USING (perfil_id = auth.uid())
      WITH CHECK (perfil_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pagos_mp_perfil      ON pagos_mp(perfil_id);
CREATE INDEX IF NOT EXISTS idx_pagos_mp_contrato    ON pagos_mp(contrato_id);
CREATE INDEX IF NOT EXISTS idx_pagos_mp_preference  ON pagos_mp(preference_id);
CREATE INDEX IF NOT EXISTS idx_pagos_mp_payment     ON pagos_mp(mp_payment_id);

-- ── firma_solicitudes: solicitudes de firma digital por email ─────────────────
CREATE TABLE IF NOT EXISTS firma_solicitudes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contrato_id  uuid REFERENCES crm_contratos(id) ON DELETE SET NULL,
  titulo       text NOT NULL,
  html_doc     text,
  firmantes    jsonb NOT NULL DEFAULT '[]',
  estado       text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','parcial','completado','cancelado')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE firma_solicitudes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='firma_solicitudes' AND policyname='firma_sol_own_all') THEN
    CREATE POLICY "firma_sol_own_all" ON firma_solicitudes
      FOR ALL TO authenticated
      USING (perfil_id = auth.uid())
      WITH CHECK (perfil_id = auth.uid());
  END IF;
  -- Acceso anon para verificar token de firmante (lectura y actualización pública via token)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='firma_solicitudes' AND policyname='firma_sol_anon_read') THEN
    CREATE POLICY "firma_sol_anon_read" ON firma_solicitudes
      FOR SELECT TO anon
      USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='firma_solicitudes' AND policyname='firma_sol_anon_update') THEN
    CREATE POLICY "firma_sol_anon_update" ON firma_solicitudes
      FOR UPDATE TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_firma_sol_perfil   ON firma_solicitudes(perfil_id);
CREATE INDEX IF NOT EXISTS idx_firma_sol_contrato ON firma_solicitudes(contrato_id);
