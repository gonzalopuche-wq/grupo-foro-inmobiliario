-- Migration 101: biblioteca, divisas_proveedores/accesos/publicaciones,
--                cotizacion_sugerencias, enlaces_utiles/sugerencias,
--                grupos_chat, mensajes_chat

-- ── biblioteca: documentos de la comunidad ───────────────────────────────────

CREATE TABLE IF NOT EXISTS biblioteca (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  descripcion     text,
  categoria       text NOT NULL DEFAULT '',
  nivel           text NOT NULL DEFAULT 'Inicial',
  origen          text NOT NULL DEFAULT 'comunidad',
  archivo_url     text NOT NULL,
  archivo_nombre  text,
  archivo_tipo    text,
  archivo_size    bigint,
  descargas       int NOT NULL DEFAULT 0,
  nota_admin      text,
  estado          text NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','aprobado','rechazado')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biblioteca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biblioteca_aprobado_public_select" ON biblioteca
  FOR SELECT USING (estado = 'aprobado');

CREATE POLICY "biblioteca_own_all" ON biblioteca
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "biblioteca_admin_all" ON biblioteca
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_biblioteca_perfil  ON biblioteca(perfil_id);
CREATE INDEX IF NOT EXISTS idx_biblioteca_estado  ON biblioteca(estado);
CREATE INDEX IF NOT EXISTS idx_biblioteca_cat     ON biblioteca(categoria);

-- ── divisas_proveedores: casas de cambio / proveedores de divisas ─────────────

CREATE TABLE IF NOT EXISTS divisas_proveedores (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              text NOT NULL,
  contacto_whatsapp   text,
  contacto_email      text,
  monedas             text[],
  servicios           text[],
  compra_usd          numeric(12,4),
  venta_usd           numeric(12,4),
  actualizado_cot     timestamptz,
  actualizado_por     uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  activo              boolean NOT NULL DEFAULT true,
  orden               int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE divisas_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "divisas_prov_public_select" ON divisas_proveedores
  FOR SELECT USING (true);

CREATE POLICY "divisas_prov_admin_all" ON divisas_proveedores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_divisas_prov_activo ON divisas_proveedores(activo, orden);

-- ── divisas_accesos: log de accesos a contacto de proveedor ──────────────────

CREATE TABLE IF NOT EXISTS divisas_accesos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id    uuid NOT NULL REFERENCES divisas_proveedores(id) ON DELETE CASCADE,
  accedido_por    uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  monto           numeric(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE divisas_accesos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "divisas_acc_own_select" ON divisas_accesos
  FOR SELECT USING (auth.uid() = accedido_por);

CREATE POLICY "divisas_acc_own_insert" ON divisas_accesos
  FOR INSERT WITH CHECK (auth.uid() = accedido_por);

CREATE POLICY "divisas_acc_admin_all" ON divisas_accesos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_divisas_acc_por ON divisas_accesos(accedido_por);

-- ── divisas_publicaciones: tablero de compra/venta divisas ───────────────────

CREATE TABLE IF NOT EXISTS divisas_publicaciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id           uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  tipo                text NOT NULL CHECK (tipo IN ('venta','compra')),
  moneda              text NOT NULL DEFAULT 'USD',
  monto               numeric(18,2) NOT NULL,
  precio_referencia   text,
  zona                text,
  notas               text,
  activa              boolean NOT NULL DEFAULT true,
  vence_at            timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE divisas_publicaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "divisas_pub_active_select" ON divisas_publicaciones
  FOR SELECT USING (activa = true);

CREATE POLICY "divisas_pub_own_all" ON divisas_publicaciones
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "divisas_pub_admin_all" ON divisas_publicaciones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_divisas_pub_activa ON divisas_publicaciones(activa, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_divisas_pub_perfil ON divisas_publicaciones(perfil_id);

-- ── cotizacion_sugerencias: sugerencias de cotización de corredores ───────────

CREATE TABLE IF NOT EXISTS cotizacion_sugerencias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id    uuid NOT NULL REFERENCES divisas_proveedores(id) ON DELETE CASCADE,
  perfil_id       uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  compra          numeric(12,4),
  venta           numeric(12,4),
  notas           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cotizacion_sugerencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cot_sug_own_insert" ON cotizacion_sugerencias
  FOR INSERT WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "cot_sug_own_select" ON cotizacion_sugerencias
  FOR SELECT USING (auth.uid() = perfil_id);

CREATE POLICY "cot_sug_admin_all" ON cotizacion_sugerencias
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_cot_sug_proveedor ON cotizacion_sugerencias(proveedor_id);

-- ── enlaces_utiles: directorio de recursos y trámites ────────────────────────

CREATE TABLE IF NOT EXISTS enlaces_utiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  descripcion text,
  url         text NOT NULL,
  categoria   text NOT NULL DEFAULT 'tramites',
  localidad   text,
  destacado   boolean NOT NULL DEFAULT false,
  activo      boolean NOT NULL DEFAULT true,
  orden       int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE enlaces_utiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enlaces_utiles_active_select" ON enlaces_utiles
  FOR SELECT USING (activo = true);

CREATE POLICY "enlaces_utiles_admin_all" ON enlaces_utiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_enlaces_utiles_activo ON enlaces_utiles(activo, orden);

-- ── enlaces_sugerencias: sugerencias de nuevos enlaces ───────────────────────

CREATE TABLE IF NOT EXISTS enlaces_sugerencias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  url         text NOT NULL,
  descripcion text,
  categoria   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE enlaces_sugerencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enlaces_sug_own_insert" ON enlaces_sugerencias
  FOR INSERT WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "enlaces_sug_admin_all" ON enlaces_sugerencias
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_enlaces_sug_perfil ON enlaces_sugerencias(perfil_id);

-- ── grupos_chat: canales de chat de la comunidad ─────────────────────────────

CREATE TABLE IF NOT EXISTS grupos_chat (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           text NOT NULL,
  descripcion      text,
  icono            text NOT NULL DEFAULT '💬',
  tipo             text NOT NULL DEFAULT 'comunidad' CHECK (tipo IN ('operaciones','comunidad')),
  va_al_mir        boolean NOT NULL DEFAULT false,
  solo_matriculado boolean NOT NULL DEFAULT false,
  activo           boolean NOT NULL DEFAULT true,
  orden            int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grupos_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grupos_chat_active_select" ON grupos_chat
  FOR SELECT USING (activo = true);

CREATE POLICY "grupos_chat_admin_all" ON grupos_chat
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_grupos_chat_activo ON grupos_chat(activo, orden);

-- ── mensajes_chat: mensajes en grupos de chat ────────────────────────────────

CREATE TABLE IF NOT EXISTS mensajes_chat (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id    uuid NOT NULL REFERENCES grupos_chat(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  texto       text,
  adjuntos    jsonb,
  tipo        text,
  mir_id      uuid,
  mir_tipo    text,
  reply_id    uuid REFERENCES mensajes_chat(id) ON DELETE SET NULL,
  editado     boolean NOT NULL DEFAULT false,
  eliminado   boolean NOT NULL DEFAULT false,
  reacciones  jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mensajes_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensajes_chat_auth_select" ON mensajes_chat
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "mensajes_chat_own_insert" ON mensajes_chat
  FOR INSERT WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "mensajes_chat_own_update" ON mensajes_chat
  FOR UPDATE USING (auth.uid() = perfil_id);

CREATE POLICY "mensajes_chat_admin_all" ON mensajes_chat
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_mensajes_chat_grupo   ON mensajes_chat(grupo_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_mensajes_chat_perfil  ON mensajes_chat(perfil_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_chat_reply   ON mensajes_chat(reply_id) WHERE reply_id IS NOT NULL;
