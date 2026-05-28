-- ============================================================
-- MIGRATIONS CONSOLIDADAS 097-112
-- Pegar completo en el SQL Editor de Supabase
-- Usa IF NOT EXISTS en todo → seguro de re-ejecutar
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 097: crm_contratos
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_contratos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id             uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  inquilino_nombre      text NOT NULL DEFAULT '',
  inquilino_telefono    text,
  propietario_nombre    text NOT NULL DEFAULT '',
  propietario_telefono  text,
  direccion             text NOT NULL DEFAULT '',
  barrio                text,
  tipo_propiedad        text,
  fecha_inicio          date NOT NULL,
  fecha_fin             date NOT NULL,
  alquiler_inicial      numeric NOT NULL DEFAULT 0,
  alquiler_actual       numeric NOT NULL DEFAULT 0,
  indice_ajuste         text NOT NULL DEFAULT 'ICL'
                          CHECK (indice_ajuste IN ('ICL','IPC','CER','CAC','fijo')),
  tasa_ajuste_anual     numeric NOT NULL DEFAULT 0,
  periodo_ajuste_meses  int NOT NULL DEFAULT 12,
  moneda                text NOT NULL DEFAULT 'ARS'
                          CHECK (moneda IN ('ARS','USD')),
  honorarios_admin      numeric NOT NULL DEFAULT 0,
  deposito_meses        int NOT NULL DEFAULT 1,
  notas                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_contratos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_contratos' AND policyname='crm_contratos_own_all') THEN
    CREATE POLICY "crm_contratos_own_all" ON crm_contratos
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_contratos' AND policyname='crm_contratos_admin_all') THEN
    CREATE POLICY "crm_contratos_admin_all" ON crm_contratos
      FOR ALL USING (
        EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_contratos_perfil    ON crm_contratos(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_contratos_fecha_fin ON crm_contratos(fecha_fin);


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 098: indicadores, mir_matches, mir_desbloqueos
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS indicadores (
  clave           text PRIMARY KEY,
  valor           numeric,
  valor_texto     text,
  descripcion     text,
  fuente          text,
  actualizado_at  timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE indicadores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='indicadores' AND policyname='indicadores_public_select') THEN
    CREATE POLICY "indicadores_public_select" ON indicadores FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='indicadores' AND policyname='indicadores_admin_all') THEN
    CREATE POLICY "indicadores_admin_all" ON indicadores
      FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS indicadores_historial (
  id          bigserial PRIMARY KEY,
  clave       text NOT NULL,
  valor       numeric,
  periodo     text NOT NULL,
  descripcion text,
  fuente      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clave, periodo)
);

ALTER TABLE indicadores_historial ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='indicadores_historial' AND policyname='indicadores_hist_public_select') THEN
    CREATE POLICY "indicadores_hist_public_select" ON indicadores_historial FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='indicadores_historial' AND policyname='indicadores_hist_admin_all') THEN
    CREATE POLICY "indicadores_hist_admin_all" ON indicadores_historial
      FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ind_hist_clave_periodo ON indicadores_historial(clave, periodo);

CREATE TABLE IF NOT EXISTS mir_matches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ofrecido_id           uuid REFERENCES mir_ofrecidos(id) ON DELETE CASCADE,
  busqueda_id           uuid REFERENCES mir_busquedas(id) ON DELETE CASCADE,
  desbloqueado_ofrecido boolean NOT NULL DEFAULT false,
  desbloqueado_busqueda boolean NOT NULL DEFAULT false,
  score                 int DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ofrecido_id, busqueda_id)
);

ALTER TABLE mir_matches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mir_matches' AND policyname='mir_matches_authenticated_select') THEN
    CREATE POLICY "mir_matches_authenticated_select" ON mir_matches FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mir_matches' AND policyname='mir_matches_authenticated_insert') THEN
    CREATE POLICY "mir_matches_authenticated_insert" ON mir_matches FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mir_matches' AND policyname='mir_matches_admin_all') THEN
    CREATE POLICY "mir_matches_admin_all" ON mir_matches
      FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mir_matches_ofrecido ON mir_matches(ofrecido_id);
CREATE INDEX IF NOT EXISTS idx_mir_matches_busqueda ON mir_matches(busqueda_id);
CREATE INDEX IF NOT EXISTS idx_mir_matches_created  ON mir_matches(created_at DESC);

CREATE TABLE IF NOT EXISTS mir_desbloqueos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    uuid NOT NULL REFERENCES mir_matches(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  monto       numeric NOT NULL DEFAULT 0,
  tipo        text NOT NULL CHECK (tipo IN ('ofrecido','busqueda')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mir_desbloqueos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mir_desbloqueos' AND policyname='mir_desbloqueos_own_select') THEN
    CREATE POLICY "mir_desbloqueos_own_select" ON mir_desbloqueos FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mir_desbloqueos' AND policyname='mir_desbloqueos_admin_all') THEN
    CREATE POLICY "mir_desbloqueos_admin_all" ON mir_desbloqueos
      FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mir_desbloqueos_match ON mir_desbloqueos(match_id);
CREATE INDEX IF NOT EXISTS idx_mir_desbloqueos_user  ON mir_desbloqueos(user_id);


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 099: push_subscriptions, emprendimientos
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text,
  auth        text,
  eventos     boolean NOT NULL DEFAULT true,
  tipo_perfil text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_subscriptions' AND policyname='push_sub_own_all') THEN
    CREATE POLICY "push_sub_own_all" ON push_subscriptions
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_subscriptions' AND policyname='push_sub_admin_all') THEN
    CREATE POLICY "push_sub_admin_all" ON push_subscriptions
      FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_sub_perfil   ON push_subscriptions(perfil_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_endpoint ON push_subscriptions(endpoint);

CREATE TABLE IF NOT EXISTS emprendimientos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id             uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  nombre                text NOT NULL,
  descripcion           text,
  ubicacion             text,
  barrio                text,
  tipo                  text,
  etapa                 text CHECK (etapa IN ('en_planos','en_construccion','terminado','vendido')),
  precio_desde          numeric,
  moneda                text NOT NULL DEFAULT 'USD',
  total_unidades        int,
  unidades_disponibles  int,
  fecha_entrega         date,
  imagenes              text[],
  es_publica            boolean NOT NULL DEFAULT true,
  contacto_nombre       text,
  contacto_email        text,
  contacto_whatsapp     text,
  web_url               text,
  comision_corredor_pct numeric,
  dormitorios_desde     int,
  dormitorios_hasta     int,
  sup_desde             numeric,
  sup_hasta             numeric,
  amenities             text[],
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE emprendimientos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='emprendimientos' AND policyname='emprendimientos_public_select') THEN
    CREATE POLICY "emprendimientos_public_select" ON emprendimientos
      FOR SELECT USING (es_publica = true OR auth.uid() = perfil_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='emprendimientos' AND policyname='emprendimientos_own_all') THEN
    CREATE POLICY "emprendimientos_own_all" ON emprendimientos
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='emprendimientos' AND policyname='emprendimientos_admin_all') THEN
    CREATE POLICY "emprendimientos_admin_all" ON emprendimientos
      FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_emprendimientos_perfil  ON emprendimientos(perfil_id);
CREATE INDEX IF NOT EXISTS idx_emprendimientos_publica ON emprendimientos(es_publica);
CREATE INDEX IF NOT EXISTS idx_emprendimientos_etapa   ON emprendimientos(etapa);


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 104: sync cartera ↔ Propia MLS
-- ────────────────────────────────────────────────────────────

ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS propia_id      text,
  ADD COLUMN IF NOT EXISTS propia_sync_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_cartera_propia_id
  ON cartera_propiedades(perfil_id, propia_id)
  WHERE propia_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 105: ampliar crm_contratos + crm_pagos_alquiler
-- ────────────────────────────────────────────────────────────

ALTER TABLE crm_contratos
  ADD COLUMN IF NOT EXISTS dia_vencimiento int  NOT NULL DEFAULT 5
                                            CHECK (dia_vencimiento BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS estado          text NOT NULL DEFAULT 'activo'
                                            CHECK (estado IN ('activo','finalizado','en-proceso'));

CREATE TABLE IF NOT EXISTS crm_pagos_alquiler (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES crm_contratos(id) ON DELETE CASCADE,
  mes         text NOT NULL,
  monto       numeric,
  fecha_pago  date,
  estado      text NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pagado','pendiente','parcial','moroso')),
  diferencia  numeric NOT NULL DEFAULT 0,
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, mes)
);

ALTER TABLE crm_pagos_alquiler ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_pagos_alquiler' AND policyname='crm_pagos_own_all') THEN
    CREATE POLICY "crm_pagos_own_all" ON crm_pagos_alquiler
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_pagos_alquiler' AND policyname='crm_pagos_admin_all') THEN
    CREATE POLICY "crm_pagos_admin_all" ON crm_pagos_alquiler
      FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_pagos_contrato    ON crm_pagos_alquiler(contrato_id, mes);
CREATE INDEX IF NOT EXISTS idx_crm_pagos_perfil_mes  ON crm_pagos_alquiler(perfil_id, mes);

CREATE TABLE IF NOT EXISTS crm_vencimientos_custom (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  descripcion     text,
  fecha           date NOT NULL,
  tipo            text NOT NULL DEFAULT 'otro'
                    CHECK (tipo IN ('contrato','documento','pago','llamada','otro')),
  contacto_nombre text,
  alerta_dias     int NOT NULL DEFAULT 7,
  completado      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_vencimientos_custom ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_vencimientos_custom' AND policyname='crm_venc_own_all') THEN
    CREATE POLICY "crm_venc_own_all" ON crm_vencimientos_custom
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_vencimientos_custom' AND policyname='crm_venc_admin_all') THEN
    CREATE POLICY "crm_venc_admin_all" ON crm_vencimientos_custom
      FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_venc_perfil ON crm_vencimientos_custom(perfil_id, fecha);


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 106: prioridad en crm_recordatorios
-- ────────────────────────────────────────────────────────────

ALTER TABLE crm_recordatorios
  ADD COLUMN IF NOT EXISTS prioridad        text NOT NULL DEFAULT 'media'
    CHECK (prioridad IN ('alta','media','baja')),
  ADD COLUMN IF NOT EXISTS contacto_nombre  text,
  ADD COLUMN IF NOT EXISTS negocio_titulo   text;


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 107: crm_gastos
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_gastos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  descripcion text NOT NULL,
  categoria   text NOT NULL DEFAULT 'Otros',
  monto       numeric NOT NULL CHECK (monto >= 0),
  moneda      text NOT NULL DEFAULT 'ARS' CHECK (moneda IN ('ARS','USD','EUR')),
  fecha       date NOT NULL,
  recurrente  boolean NOT NULL DEFAULT false,
  pagado      boolean NOT NULL DEFAULT false,
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_gastos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_gastos' AND policyname='crm_gastos_own_all') THEN
    CREATE POLICY "crm_gastos_own_all" ON crm_gastos
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_gastos' AND policyname='crm_gastos_admin_all') THEN
    CREATE POLICY "crm_gastos_admin_all" ON crm_gastos
      FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_gastos_perfil_fecha ON crm_gastos(perfil_id, fecha);


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 108: presupuesto anual, metas, KPI, splits, ofertas
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_presupuesto_anual (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id  uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  anio       int  NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, anio)
);
ALTER TABLE crm_presupuesto_anual ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_presupuesto_anual' AND policyname='crm_presupuesto_anual_own') THEN
    CREATE POLICY "crm_presupuesto_anual_own" ON crm_presupuesto_anual
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_metas_personales (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id            uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  anio                 int  NOT NULL,
  meta_honorarios_usd  numeric NOT NULL DEFAULT 50000,
  meta_operaciones     int     NOT NULL DEFAULT 24,
  meta_nuevas_capt     int     NOT NULL DEFAULT 48,
  meta_tasaciones      int     NOT NULL DEFAULT 20,
  meta_tasa_cierre_obj numeric NOT NULL DEFAULT 30,
  tipo_cambio          int     NOT NULL DEFAULT 1300,
  notas                text,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, anio)
);
ALTER TABLE crm_metas_personales ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_metas_personales' AND policyname='crm_metas_personales_own') THEN
    CREATE POLICY "crm_metas_personales_own" ON crm_metas_personales
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_kpi_diario (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id        uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  fecha            date NOT NULL,
  llamadas         int     NOT NULL DEFAULT 0,
  whatsapps        int     NOT NULL DEFAULT 0,
  emails           int     NOT NULL DEFAULT 0,
  visitas          int     NOT NULL DEFAULT 0,
  tasaciones       int     NOT NULL DEFAULT 0,
  nuevos_contactos int     NOT NULL DEFAULT 0,
  publicaciones    int     NOT NULL DEFAULT 0,
  reuniones        int     NOT NULL DEFAULT 0,
  captaciones      int     NOT NULL DEFAULT 0,
  cierres          numeric NOT NULL DEFAULT 0,
  notas            text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, fecha)
);
ALTER TABLE crm_kpi_diario ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_kpi_diario' AND policyname='crm_kpi_diario_own') THEN
    CREATE POLICY "crm_kpi_diario_own" ON crm_kpi_diario
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_crm_kpi_diario_perfil_fecha ON crm_kpi_diario(perfil_id, fecha DESC);

CREATE TABLE IF NOT EXISTS crm_kpi_meta (
  perfil_id        uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  llamadas         numeric NOT NULL DEFAULT 20,
  whatsapps        numeric NOT NULL DEFAULT 15,
  emails           numeric NOT NULL DEFAULT 10,
  visitas          numeric NOT NULL DEFAULT 3,
  tasaciones       numeric NOT NULL DEFAULT 2,
  nuevos_contactos numeric NOT NULL DEFAULT 5,
  publicaciones    numeric NOT NULL DEFAULT 3,
  reuniones        numeric NOT NULL DEFAULT 2,
  captaciones      numeric NOT NULL DEFAULT 1,
  cierres          numeric NOT NULL DEFAULT 0.2,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_kpi_meta ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_kpi_meta' AND policyname='crm_kpi_meta_own') THEN
    CREATE POLICY "crm_kpi_meta_own" ON crm_kpi_meta
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_comisiones_split (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  operaciones jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_comisiones_split ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_comisiones_split' AND policyname='crm_comisiones_split_own') THEN
    CREATE POLICY "crm_comisiones_split_own" ON crm_comisiones_split
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_seguimiento_ofertas (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  ofertas    jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_seguimiento_ofertas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_seguimiento_ofertas' AND policyname='crm_seguimiento_ofertas_own') THEN
    CREATE POLICY "crm_seguimiento_ofertas_own" ON crm_seguimiento_ofertas
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_honorarios_cuotas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  negocio_id  uuid NOT NULL,
  cuotas      jsonb NOT NULL DEFAULT '[]',
  notas       text,
  estado      text NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','parcial','cobrado','vencido','incobrable')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, negocio_id)
);
ALTER TABLE crm_honorarios_cuotas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_honorarios_cuotas' AND policyname='crm_honorarios_cuotas_own') THEN
    CREATE POLICY "crm_honorarios_cuotas_own" ON crm_honorarios_cuotas
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_crm_honorarios_cuotas_perfil ON crm_honorarios_cuotas(perfil_id);


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 109: objetivos, scorecard, cobros, plantillas,
--               campañas, red contactos, referidos, post-venta,
--               checklists, propuestas, analisis competencia
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_objetivos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  descripcion text,
  categoria   text NOT NULL DEFAULT 'general',
  meta        numeric NOT NULL DEFAULT 0,
  unidad      text NOT NULL DEFAULT 'ops',
  periodo     text NOT NULL DEFAULT 'anual' CHECK (periodo IN ('mensual','trimestral','anual')),
  anio        int  NOT NULL,
  mes         int,
  completado  boolean NOT NULL DEFAULT false,
  progreso    numeric NOT NULL DEFAULT 0,
  fecha_limit date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_objetivos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_objetivos' AND policyname='crm_objetivos_own') THEN
    CREATE POLICY "crm_objetivos_own" ON crm_objetivos
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_crm_objetivos_perfil_anio ON crm_objetivos(perfil_id, anio);

CREATE TABLE IF NOT EXISTS crm_scorecard_semanal (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  semanas    jsonb NOT NULL DEFAULT '{}',
  metas      jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_scorecard_semanal ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_scorecard_semanal' AND policyname='crm_scorecard_semanal_own') THEN
    CREATE POLICY "crm_scorecard_semanal_own" ON crm_scorecard_semanal
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_comisiones_cobros (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  cobros     jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_comisiones_cobros ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_comisiones_cobros' AND policyname='crm_comisiones_cobros_own') THEN
    CREATE POLICY "crm_comisiones_cobros_own" ON crm_comisiones_cobros
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_plantillas_mensajes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  categoria   text NOT NULL DEFAULT 'general',
  contenido   text NOT NULL,
  variables   text[] NOT NULL DEFAULT '{}',
  activa      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_plantillas_mensajes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_plantillas_mensajes' AND policyname='crm_plantillas_mensajes_own') THEN
    CREATE POLICY "crm_plantillas_mensajes_own" ON crm_plantillas_mensajes
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_crm_plantillas_perfil ON crm_plantillas_mensajes(perfil_id);

CREATE TABLE IF NOT EXISTS crm_campanas_marketing (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  campanas   jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_campanas_marketing ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_campanas_marketing' AND policyname='crm_campanas_marketing_own') THEN
    CREATE POLICY "crm_campanas_marketing_own" ON crm_campanas_marketing
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_campana_cumpleanos (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  config      jsonb NOT NULL DEFAULT '{}',
  felicitados jsonb NOT NULL DEFAULT '{}',
  plantillas  jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_campana_cumpleanos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_campana_cumpleanos' AND policyname='crm_campana_cumpleanos_own') THEN
    CREATE POLICY "crm_campana_cumpleanos_own" ON crm_campana_cumpleanos
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_campana_reactivacion (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  reactivados jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_campana_reactivacion ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_campana_reactivacion' AND policyname='crm_campana_reactivacion_own') THEN
    CREATE POLICY "crm_campana_reactivacion_own" ON crm_campana_reactivacion
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_red_contactos (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  contactos  jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_red_contactos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_red_contactos' AND policyname='crm_red_contactos_own') THEN
    CREATE POLICY "crm_red_contactos_own" ON crm_red_contactos
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_referidos (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  referidos  jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_referidos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_referidos' AND policyname='crm_referidos_own') THEN
    CREATE POLICY "crm_referidos_own" ON crm_referidos
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_seguimiento_post_venta (
  perfil_id    uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  seguimientos jsonb NOT NULL DEFAULT '[]',
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_seguimiento_post_venta ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_seguimiento_post_venta' AND policyname='crm_seguimiento_post_venta_own') THEN
    CREATE POLICY "crm_seguimiento_post_venta_own" ON crm_seguimiento_post_venta
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_checklists_cierre (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  checklists jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_checklists_cierre ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_checklists_cierre' AND policyname='crm_checklists_cierre_own') THEN
    CREATE POLICY "crm_checklists_cierre_own" ON crm_checklists_cierre
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_propuestas_comerciales (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  propuestas jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_propuestas_comerciales ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_propuestas_comerciales' AND policyname='crm_propuestas_comerciales_own') THEN
    CREATE POLICY "crm_propuestas_comerciales_own" ON crm_propuestas_comerciales
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_analisis_competencia (
  perfil_id    uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  competidores jsonb NOT NULL DEFAULT '[]',
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_analisis_competencia ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_analisis_competencia' AND policyname='crm_analisis_competencia_own') THEN
    CREATE POLICY "crm_analisis_competencia_own" ON crm_analisis_competencia
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 110: objetivos mensuales, gestion tareas
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_objetivos_mensuales (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id  uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  anio       int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  objetivos  jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, anio, mes)
);
ALTER TABLE crm_objetivos_mensuales ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_objetivos_mensuales' AND policyname='crm_objetivos_mensuales_own') THEN
    CREATE POLICY "crm_objetivos_mensuales_own" ON crm_objetivos_mensuales
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_crm_obj_mensuales_perfil_anio
  ON crm_objetivos_mensuales(perfil_id, anio, mes);

CREATE TABLE IF NOT EXISTS crm_gestion_tareas (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  tareas     jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_gestion_tareas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_gestion_tareas' AND policyname='crm_gestion_tareas_own') THEN
    CREATE POLICY "crm_gestion_tareas_own" ON crm_gestion_tareas
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 111: agenda visitas/tasaciones, docs, base conocimiento
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_agenda_visitas (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  visitas    jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_agenda_visitas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_agenda_visitas' AND policyname='crm_agenda_visitas_own') THEN
    CREATE POLICY "crm_agenda_visitas_own" ON crm_agenda_visitas
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_agenda_tasaciones (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  tasaciones jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_agenda_tasaciones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_agenda_tasaciones' AND policyname='crm_agenda_tasaciones_own') THEN
    CREATE POLICY "crm_agenda_tasaciones_own" ON crm_agenda_tasaciones
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_gestion_documentos (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  documentos jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_gestion_documentos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_gestion_documentos' AND policyname='crm_gestion_documentos_own') THEN
    CREATE POLICY "crm_gestion_documentos_own" ON crm_gestion_documentos
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_base_conocimiento (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  articulos  jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_base_conocimiento ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_base_conocimiento' AND policyname='crm_base_conocimiento_own') THEN
    CREATE POLICY "crm_base_conocimiento_own" ON crm_base_conocimiento
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_reportes_propietarios (
  perfil_id    uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  reportes     jsonb NOT NULL DEFAULT '{}',
  asignaciones jsonb NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_reportes_propietarios ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_reportes_propietarios' AND policyname='crm_reportes_propietarios_own') THEN
    CREATE POLICY "crm_reportes_propietarios_own" ON crm_reportes_propietarios
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_duplicados_descartados (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  descartados jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_duplicados_descartados ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_duplicados_descartados' AND policyname='crm_duplicados_descartados_own') THEN
    CREATE POLICY "crm_duplicados_descartados_own" ON crm_duplicados_descartados
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 112: configuracion CRM, fichas, documentos estado, expedientes
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_configuracion (
  perfil_id     uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  config_extra  jsonb NOT NULL DEFAULT '{}',
  datos_agencia jsonb NOT NULL DEFAULT '{}',
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_configuracion ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_configuracion' AND policyname='crm_configuracion_own') THEN
    CREATE POLICY "crm_configuracion_own" ON crm_configuracion
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_fichas_propiedades (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  fichas     jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_fichas_propiedades ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_fichas_propiedades' AND policyname='crm_fichas_propiedades_own') THEN
    CREATE POLICY "crm_fichas_propiedades_own" ON crm_fichas_propiedades
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_documentos_estado (
  perfil_id  uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  estado     jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_documentos_estado ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_documentos_estado' AND policyname='crm_documentos_estado_own') THEN
    CREATE POLICY "crm_documentos_estado_own" ON crm_documentos_estado
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS crm_expedientes (
  perfil_id   uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  expedientes jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_expedientes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_expedientes' AND policyname='crm_expedientes_own') THEN
    CREATE POLICY "crm_expedientes_own" ON crm_expedientes
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
END $$;
