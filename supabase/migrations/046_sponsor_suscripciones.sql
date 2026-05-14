-- Suscripciones mensuales de sponsors
-- Modelo: sponsors pagan una cuota mensual fija (configurable por proveedor)
-- + se cobra por adhesiones de corredores (referidos/clientes posibles) en campañas
SET search_path TO public;

-- ── Nuevas columnas en red_proveedores ────────────────────────────────────────
ALTER TABLE red_proveedores
  ADD COLUMN IF NOT EXISTS suscripcion_activa  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_mensual_usd    numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS suscripcion_vence   date;

-- ── Tabla de suscripciones mensuales ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsor_suscripciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid NOT NULL REFERENCES red_proveedores(id) ON DELETE CASCADE,
  mes          text NOT NULL,          -- formato YYYY-MM
  monto_usd    numeric NOT NULL CHECK (monto_usd > 0),
  pagada       boolean NOT NULL DEFAULT false,
  fecha_pago   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proveedor_id, mes)
);

-- ── Ampliar tipos de movimientos ──────────────────────────────────────────────
ALTER TABLE sponsor_movimientos
  DROP CONSTRAINT IF EXISTS sponsor_movimientos_tipo_check;
ALTER TABLE sponsor_movimientos
  ADD CONSTRAINT sponsor_movimientos_tipo_check
  CHECK (tipo IN ('recarga','debito_adhesion','ajuste','debito_suscripcion'));

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_suscripciones_proveedor ON sponsor_suscripciones(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_mes       ON sponsor_suscripciones(mes);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE sponsor_suscripciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suscripciones_select" ON sponsor_suscripciones;
CREATE POLICY "suscripciones_select" ON sponsor_suscripciones FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM red_proveedores WHERE id = proveedor_id AND portal_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin')
  );

DROP POLICY IF EXISTS "suscripciones_admin_all" ON sponsor_suscripciones;
CREATE POLICY "suscripciones_admin_all" ON sponsor_suscripciones FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));
