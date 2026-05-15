-- MOD 2: PEDIDO URGENTE (48hs vigencia, badge especial)
ALTER TABLE mir_ofrecidos
  ADD COLUMN IF NOT EXISTS urgente boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgente_expires_at timestamptz;

ALTER TABLE mir_busquedas
  ADD COLUMN IF NOT EXISTS urgente boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgente_expires_at timestamptz;

-- Auto-expirar urgentes vencidos (via updated_at + check en query)
CREATE INDEX IF NOT EXISTS idx_mir_ofrecidos_urgente ON mir_ofrecidos(urgente) WHERE urgente = true;
CREATE INDEX IF NOT EXISTS idx_mir_busquedas_urgente ON mir_busquedas(urgente) WHERE urgente = true;

-- MOD 76: MI ABONO INTELIGENTE — bonificaciones por colaboración
CREATE TABLE IF NOT EXISTS bonificaciones_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accion      text UNIQUE NOT NULL,
  descuento_usd numeric(5,2) DEFAULT 0.50,
  activo      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Agrega columna label si no existe (idempotente para DBs con tabla preexistente)
ALTER TABLE bonificaciones_config
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT '';

INSERT INTO bonificaciones_config (accion, label, descuento_usd, activo) VALUES
  ('biblioteca',   'Subir documento a Biblioteca',           1.00, true),
  ('foro',         'Crear tema en el Foro',                  0.50, true),
  ('comparables',  'Cargar comparable de venta',             1.00, true),
  ('seniority',    'Antigüedad (por año activo)',             0.50, true),
  ('referidos',    'Referido que se suscribió',              2.00, true)
ON CONFLICT (accion) DO UPDATE SET
  label = EXCLUDED.label;

CREATE TABLE IF NOT EXISTS bonificaciones_historial (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id           uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  accion              text NOT NULL,
  mes                 text NOT NULL, -- YYYY-MM
  cantidad            integer DEFAULT 1,
  descuento_aplicado  numeric(5,2) DEFAULT 0,
  detalle             jsonb,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(perfil_id, accion, mes)
);

CREATE INDEX IF NOT EXISTS idx_bonificaciones_perfil ON bonificaciones_historial(perfil_id);
CREATE INDEX IF NOT EXISTS idx_bonificaciones_mes ON bonificaciones_historial(mes);

-- RLS
ALTER TABLE bonificaciones_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonificaciones_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_bonificaciones_config" ON bonificaciones_config;
CREATE POLICY "public_read_bonificaciones_config" ON bonificaciones_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_all_bonificaciones_config" ON bonificaciones_config;
CREATE POLICY "admin_all_bonificaciones_config" ON bonificaciones_config
  FOR ALL USING ((SELECT tipo FROM perfiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "user_own_bonificaciones" ON bonificaciones_historial;
CREATE POLICY "user_own_bonificaciones" ON bonificaciones_historial
  FOR ALL USING (
    perfil_id = auth.uid()
    OR (SELECT tipo FROM perfiles WHERE id = auth.uid()) = 'admin'
  );
