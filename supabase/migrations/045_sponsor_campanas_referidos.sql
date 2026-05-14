-- Sistema de campañas de sponsors con referidos por administraciones
-- Opción A+B: declarado por corredor + auto desde CRM en el futuro

-- ── Columnas en tablas existentes ────────────────────────────────────────────
ALTER TABLE red_proveedores
  ADD COLUMN IF NOT EXISTS portal_user_id uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slug text UNIQUE;

ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS cant_administraciones_declaradas integer;

-- Actualiza RLS de sponsor_beneficios para que el sponsor gestione los suyos
DROP POLICY IF EXISTS "sponsor_gestiona_propios_beneficios" ON sponsor_beneficios;
CREATE POLICY "sponsor_gestiona_propios_beneficios"
  ON sponsor_beneficios FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM red_proveedores
      WHERE id = proveedor_id AND portal_user_id = auth.uid()
    )
  );

-- ── Tabla de campañas ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsor_campanas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id        uuid NOT NULL REFERENCES red_proveedores(id) ON DELETE CASCADE,
  titulo              text NOT NULL,
  descripcion         text,
  tipo_beneficio      text NOT NULL DEFAULT 'descuento'
                        CHECK (tipo_beneficio IN ('descuento','producto_gratis','servicio_gratis','cashback','otro')),
  valor_descuento_pct numeric(5,2),
  detalle_beneficio   text NOT NULL,
  imagen_url          text,
  presupuesto_usd     numeric NOT NULL CHECK (presupuesto_usd > 0),
  costo_por_admin_usd numeric NOT NULL DEFAULT 1 CHECK (costo_por_admin_usd > 0),
  vigente_desde       date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta       date,
  activa              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Tabla de adhesiones (corredor se suma a campaña) ─────────────────────────
CREATE TABLE IF NOT EXISTS sponsor_adhesiones (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id            uuid NOT NULL REFERENCES sponsor_campanas(id) ON DELETE CASCADE,
  corredor_id           uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  cant_administraciones integer NOT NULL CHECK (cant_administraciones > 0),
  monto_cobrado_usd     numeric NOT NULL,
  token_ref             text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  clics                 integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campana_id, corredor_id)
);

-- ── Saldo del sponsor ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsor_saldo (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid NOT NULL UNIQUE REFERENCES red_proveedores(id) ON DELETE CASCADE,
  saldo_usd    numeric NOT NULL DEFAULT 0 CHECK (saldo_usd >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Movimientos de saldo ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsor_movimientos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid NOT NULL REFERENCES red_proveedores(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN ('recarga','debito_adhesion','ajuste')),
  monto_usd    numeric NOT NULL,
  descripcion  text,
  adhesion_id  uuid REFERENCES sponsor_adhesiones(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_campanas_proveedor ON sponsor_campanas(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_campanas_activa    ON sponsor_campanas(activa);
CREATE INDEX IF NOT EXISTS idx_adhesiones_campana ON sponsor_adhesiones(campana_id);
CREATE INDEX IF NOT EXISTS idx_adhesiones_corredor ON sponsor_adhesiones(corredor_id);
CREATE INDEX IF NOT EXISTS idx_adhesiones_token   ON sponsor_adhesiones(token_ref);
CREATE INDEX IF NOT EXISTS idx_movimientos_proveedor ON sponsor_movimientos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_slug   ON red_proveedores(slug);
CREATE INDEX IF NOT EXISTS idx_proveedores_portal ON red_proveedores(portal_user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE sponsor_campanas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_adhesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_saldo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_movimientos ENABLE ROW LEVEL SECURITY;

-- Campañas: autenticados ven las activas; sponsor ve las suyas; admin todo
DROP POLICY IF EXISTS "campanas_ver_activas" ON sponsor_campanas;
CREATE POLICY "campanas_ver_activas" ON sponsor_campanas FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      activa = true
      OR EXISTS (SELECT 1 FROM red_proveedores WHERE id = proveedor_id AND portal_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin')
    )
  );
DROP POLICY IF EXISTS "campanas_sponsor_insert" ON sponsor_campanas;
CREATE POLICY "campanas_sponsor_insert" ON sponsor_campanas FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM red_proveedores WHERE id = proveedor_id AND portal_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin')
  );
DROP POLICY IF EXISTS "campanas_sponsor_update" ON sponsor_campanas;
CREATE POLICY "campanas_sponsor_update" ON sponsor_campanas FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM red_proveedores WHERE id = proveedor_id AND portal_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin')
  );

-- Adhesiones: corredor ve las suyas; sponsor ve adhesiones a sus campañas; admin todo
DROP POLICY IF EXISTS "adhesiones_select" ON sponsor_adhesiones;
CREATE POLICY "adhesiones_select" ON sponsor_adhesiones FOR SELECT
  USING (
    corredor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sponsor_campanas sc
      JOIN red_proveedores rp ON rp.id = sc.proveedor_id
      WHERE sc.id = campana_id AND rp.portal_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin')
  );
DROP POLICY IF EXISTS "adhesiones_corredor_insert" ON sponsor_adhesiones;
CREATE POLICY "adhesiones_corredor_insert" ON sponsor_adhesiones FOR INSERT
  WITH CHECK (corredor_id = auth.uid());
DROP POLICY IF EXISTS "adhesiones_update_clics" ON sponsor_adhesiones;
CREATE POLICY "adhesiones_update_clics" ON sponsor_adhesiones FOR UPDATE
  USING (true);

-- Saldo: sponsor ve el suyo; admin gestiona
DROP POLICY IF EXISTS "saldo_select" ON sponsor_saldo;
CREATE POLICY "saldo_select" ON sponsor_saldo FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM red_proveedores WHERE id = proveedor_id AND portal_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin')
  );
DROP POLICY IF EXISTS "saldo_admin_all" ON sponsor_saldo;
CREATE POLICY "saldo_admin_all" ON sponsor_saldo FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));

-- Movimientos: sponsor ve los suyos; admin gestiona
DROP POLICY IF EXISTS "movimientos_select" ON sponsor_movimientos;
CREATE POLICY "movimientos_select" ON sponsor_movimientos FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM red_proveedores WHERE id = proveedor_id AND portal_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin')
  );
DROP POLICY IF EXISTS "movimientos_admin_all" ON sponsor_movimientos;
CREATE POLICY "movimientos_admin_all" ON sponsor_movimientos FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));
