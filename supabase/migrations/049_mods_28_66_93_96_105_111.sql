-- Migration 049: MOD 66 (Venta de Entradas), MOD 93 (Honorarios Cobros),
--               MOD 96 (Cursos), MOD 105 (Valoraciones), MOD 111 (Denuncias resolución)
SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────────
-- MOD 66 — Venta de Entradas a Eventos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evento_compras (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id     uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  perfil_id     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  cantidad      int NOT NULL DEFAULT 1 CHECK (cantidad >= 1 AND cantidad <= 5),
  precio_total  numeric(12,2) NOT NULL DEFAULT 0,
  moneda        text NOT NULL DEFAULT 'ARS',
  estado        text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmado','cancelado','reembolsado')),
  metodo_pago   text CHECK (metodo_pago IN ('transferencia','efectivo','mercadopago','otro')),
  comprobante_url text,
  notas_admin   text,
  confirmado_por uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  confirmado_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(evento_id, perfil_id)
);

CREATE INDEX IF NOT EXISTS idx_evento_compras_evento ON evento_compras(evento_id);
CREATE INDEX IF NOT EXISTS idx_evento_compras_perfil ON evento_compras(perfil_id);
CREATE INDEX IF NOT EXISTS idx_evento_compras_estado ON evento_compras(estado);

ALTER TABLE evento_compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ec_select_own" ON evento_compras;
CREATE POLICY "ec_select_own" ON evento_compras FOR SELECT
  USING (perfil_id = auth.uid() OR
         EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));

DROP POLICY IF EXISTS "ec_insert_own" ON evento_compras;
CREATE POLICY "ec_insert_own" ON evento_compras FOR INSERT
  WITH CHECK (perfil_id = auth.uid());

DROP POLICY IF EXISTS "ec_update_own" ON evento_compras;
CREATE POLICY "ec_update_own" ON evento_compras FOR UPDATE
  USING (perfil_id = auth.uid() OR
         EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- MOD 93 — Registro de Cobros de Honorarios
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_honorarios_cobros (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  negocio_id      uuid REFERENCES crm_negocios(id) ON DELETE SET NULL,
  concepto        text NOT NULL,
  monto           numeric(14,2) NOT NULL,
  moneda          text NOT NULL DEFAULT 'USD',
  fecha_cobro     date NOT NULL,
  metodo_cobro    text CHECK (metodo_cobro IN ('efectivo','transferencia','cheque','otro')),
  notas           text,
  comprobante_url text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hon_cobros_perfil  ON crm_honorarios_cobros(perfil_id);
CREATE INDEX IF NOT EXISTS idx_hon_cobros_negocio ON crm_honorarios_cobros(negocio_id);
CREATE INDEX IF NOT EXISTS idx_hon_cobros_fecha   ON crm_honorarios_cobros(fecha_cobro DESC);

ALTER TABLE crm_honorarios_cobros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hon_cobros_own" ON crm_honorarios_cobros;
CREATE POLICY "hon_cobros_own" ON crm_honorarios_cobros FOR ALL
  USING (perfil_id = auth.uid())
  WITH CHECK (perfil_id = auth.uid());

DROP POLICY IF EXISTS "hon_cobros_admin" ON crm_honorarios_cobros;
CREATE POLICY "hon_cobros_admin" ON crm_honorarios_cobros FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- MOD 96 — Cursos y Capacitación Online
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cursos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text NOT NULL,
  descripcion     text,
  instructor      text,
  categoria       text NOT NULL DEFAULT 'general' CHECK (categoria IN ('legal','comercial','tecnologia','marketing','financiero','general','cocir')),
  nivel           text NOT NULL DEFAULT 'basico' CHECK (nivel IN ('basico','intermedio','avanzado')),
  duracion_horas  numeric(5,1),
  modalidad       text NOT NULL DEFAULT 'online' CHECK (modalidad IN ('online','presencial','hibrido')),
  link_acceso     text,
  imagen_url      text,
  precio          numeric(10,2) DEFAULT 0,
  moneda          text DEFAULT 'ARS',
  gratuito        boolean NOT NULL DEFAULT true,
  activo          boolean NOT NULL DEFAULT true,
  destacado       boolean NOT NULL DEFAULT false,
  max_inscriptos  int,
  fecha_inicio    date,
  fecha_fin       date,
  created_by      uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cursos_activo    ON cursos(activo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cursos_categoria ON cursos(categoria);

ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cursos_select_all" ON cursos;
CREATE POLICY "cursos_select_all" ON cursos FOR SELECT USING (activo = true OR
  EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));

DROP POLICY IF EXISTS "cursos_admin_all" ON cursos;
CREATE POLICY "cursos_admin_all" ON cursos FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));

CREATE TABLE IF NOT EXISTS curso_inscripciones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id    uuid NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  estado      text NOT NULL DEFAULT 'inscripto' CHECK (estado IN ('inscripto','completado','cancelado')),
  progreso    int NOT NULL DEFAULT 0 CHECK (progreso >= 0 AND progreso <= 100),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(curso_id, perfil_id)
);

CREATE INDEX IF NOT EXISTS idx_curso_ins_perfil ON curso_inscripciones(perfil_id);
CREATE INDEX IF NOT EXISTS idx_curso_ins_curso  ON curso_inscripciones(curso_id);

ALTER TABLE curso_inscripciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curso_ins_own" ON curso_inscripciones;
CREATE POLICY "curso_ins_own" ON curso_inscripciones FOR ALL
  USING (perfil_id = auth.uid())
  WITH CHECK (perfil_id = auth.uid());

DROP POLICY IF EXISTS "curso_ins_admin" ON curso_inscripciones;
CREATE POLICY "curso_ins_admin" ON curso_inscripciones FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- MOD 111 — Denuncias: campo resolución_notas + acción admin
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE denuncias ADD COLUMN IF NOT EXISTS resolucion_notas text;
ALTER TABLE denuncias ADD COLUMN IF NOT EXISTS accion_tomada text
  CHECK (accion_tomada IN ('advertencia','suspension','eliminacion','sin_accion',NULL));
ALTER TABLE denuncias ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
