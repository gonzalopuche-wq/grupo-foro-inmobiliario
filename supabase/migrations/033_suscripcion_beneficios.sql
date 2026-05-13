-- Tabla de beneficios/descuentos internos por corredor
-- Gestionada desde el panel admin (AdminBeneficios.tsx)
CREATE TABLE IF NOT EXISTS suscripcion_beneficios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  admin_id        uuid NOT NULL REFERENCES perfiles(id),
  tipo            text NOT NULL,
  descuento_pct   numeric(5,2) NOT NULL DEFAULT 0,
  monto_fijo_usd  numeric(10,2) NOT NULL DEFAULT 0,
  es_cortesia     boolean NOT NULL DEFAULT false,
  fecha_desde     date NOT NULL DEFAULT CURRENT_DATE,
  fecha_hasta     date,
  activo          boolean NOT NULL DEFAULT true,
  motivo          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sb_perfil ON suscripcion_beneficios(perfil_id);
CREATE INDEX IF NOT EXISTS idx_sb_activo  ON suscripcion_beneficios(activo, fecha_hasta);

ALTER TABLE suscripcion_beneficios ENABLE ROW LEVEL SECURITY;

-- Admin puede leer y escribir todo
DROP POLICY IF EXISTS "admin_gestiona_beneficios" ON suscripcion_beneficios;
CREATE POLICY "admin_gestiona_beneficios" ON suscripcion_beneficios
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin')
  );

-- Cada corredor puede leer sus propios beneficios
DROP POLICY IF EXISTS "corredor_lee_sus_beneficios" ON suscripcion_beneficios;
CREATE POLICY "corredor_lee_sus_beneficios" ON suscripcion_beneficios
  FOR SELECT
  USING (perfil_id = auth.uid());
