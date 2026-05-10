-- ─────────────────────────────────────────────────────────────────────────────
-- 012 · HIGH PRIORITY FEATURES
-- · Insignias en perfiles (mentor, tasador experto)
-- · MI ABONO INTELIGENTE — configuración de bonificaciones
-- · Gestión de llaves (crm_llaves)
-- · Autorizaciones de venta — alertas de vencimiento (ya usa ci_fecha_vencimiento)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Insignias en perfiles ─────────────────────────────────────────────────
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS insignia_mentor        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS insignia_tasador       BOOLEAN DEFAULT FALSE;

-- ── 2. MI ABONO INTELIGENTE — configuración ──────────────────────────────────
CREATE TABLE IF NOT EXISTS bonificaciones_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accion        TEXT NOT NULL UNIQUE,   -- 'biblioteca','foro','comparable','referido','seniority'
  descuento_usd NUMERIC(6,2) NOT NULL DEFAULT 0,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  descripcion   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Valores por defecto
INSERT INTO bonificaciones_config (accion, descuento_usd, descripcion) VALUES
  ('biblioteca',  1.00, 'Por cada documento aprobado en Biblioteca (máx 3)'),
  ('foro',        0.50, 'Por cada post en el Foro del mes (máx 2)'),
  ('comparable',  0.50, 'Por cada comparable cargado en el Observatorio (máx 2)'),
  ('referido',    2.00, 'Por cada nuevo miembro referido activo'),
  ('seniority',   1.00, 'Por cada año de matrícula (máx 3)')
ON CONFLICT (accion) DO NOTHING;

-- ── 3. GESTIÓN DE LLAVES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_llaves (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id             UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  propiedad_id          UUID REFERENCES cartera_propiedades(id) ON DELETE SET NULL,
  titulo                TEXT NOT NULL,                    -- descripción / dirección
  responsable_nombre    TEXT NOT NULL,
  responsable_telefono  TEXT,
  responsable_tipo      TEXT DEFAULT 'cliente',           -- 'cliente','colega','propietario','otro'
  fecha_entrega         DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_devolucion      DATE,                             -- NULL = sin plazo
  devuelta              BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_devolucion_real DATE,
  notas                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_llaves_perfil_idx ON crm_llaves(perfil_id);
CREATE INDEX IF NOT EXISTS crm_llaves_devuelta_idx ON crm_llaves(perfil_id, devuelta);

-- RLS
ALTER TABLE crm_llaves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_llaves_own ON crm_llaves;
CREATE POLICY crm_llaves_own ON crm_llaves
  USING (perfil_id = auth.uid())
  WITH CHECK (perfil_id = auth.uid());

-- ── 4. RLS para bonificaciones_config (solo lectura autenticados, admin escribe) ─
ALTER TABLE bonificaciones_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bonif_config_read ON bonificaciones_config;
CREATE POLICY bonif_config_read ON bonificaciones_config
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS bonif_config_admin ON bonificaciones_config;
CREATE POLICY bonif_config_admin ON bonificaciones_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin')
  );
