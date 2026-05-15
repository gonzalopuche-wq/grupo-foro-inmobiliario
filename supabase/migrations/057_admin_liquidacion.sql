-- Liquidación Mensual GFI — Socios y Retiros
-- Permite llevar el control de distribución mensual:
-- Neto = Ingresos - Gastos → 30% reserva, 70% distribuible entre socios
-- Retiros parciales durante el mes con saldo disponible en tiempo real

CREATE TABLE IF NOT EXISTS admin_socios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  porcentaje  numeric(5,2) NOT NULL DEFAULT 100 CHECK (porcentaje > 0 AND porcentaje <= 100),
  activo      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_retiros (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id    uuid REFERENCES admin_socios(id) ON DELETE CASCADE,
  monto       numeric(14,2) NOT NULL CHECK (monto > 0),
  moneda      text NOT NULL DEFAULT 'ARS',
  concepto    text,
  fecha       date NOT NULL DEFAULT CURRENT_DATE,
  periodo     text NOT NULL, -- formato YYYY-MM
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_retiros_periodo  ON admin_retiros(periodo);
CREATE INDEX IF NOT EXISTS idx_admin_retiros_socio    ON admin_retiros(socio_id);

ALTER TABLE admin_socios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_retiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "socios_admin_all"  ON admin_socios;
CREATE POLICY "socios_admin_all" ON admin_socios FOR ALL USING (
  (SELECT tipo FROM perfiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "retiros_admin_all" ON admin_retiros;
CREATE POLICY "retiros_admin_all" ON admin_retiros FOR ALL USING (
  (SELECT tipo FROM perfiles WHERE id = auth.uid()) = 'admin'
);
