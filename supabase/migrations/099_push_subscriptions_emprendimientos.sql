-- Migration 099: push_subscriptions y emprendimientos

-- ── push_subscriptions: suscripciones Web Push ───────────────────────────────

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

CREATE POLICY "push_sub_own_all" ON push_subscriptions
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "push_sub_admin_all" ON push_subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_push_sub_perfil   ON push_subscriptions(perfil_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_endpoint ON push_subscriptions(endpoint);

-- ── emprendimientos: marketplace de proyectos inmobiliarios ──────────────────

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

CREATE POLICY "emprendimientos_public_select" ON emprendimientos
  FOR SELECT USING (es_publica = true OR auth.uid() = perfil_id);

CREATE POLICY "emprendimientos_own_all" ON emprendimientos
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "emprendimientos_admin_all" ON emprendimientos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_emprendimientos_perfil  ON emprendimientos(perfil_id);
CREATE INDEX IF NOT EXISTS idx_emprendimientos_publica ON emprendimientos(es_publica);
CREATE INDEX IF NOT EXISTS idx_emprendimientos_etapa   ON emprendimientos(etapa);
