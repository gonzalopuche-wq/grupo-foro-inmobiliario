-- ============================================================
-- MIGRATIONS CONSOLIDADAS 100-103
-- Pegar completo en el SQL Editor de Supabase
-- Usa IF NOT EXISTS en todo → seguro de re-ejecutar
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 100: tasaciones_historial, mir_chats/mensajes/intereses,
--               inscripciones_eventos, canal_sesiones/consultas
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasaciones_historial (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  datos_propiedad   jsonb,
  resultado         jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tasaciones_historial ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasaciones_historial' AND policyname='tasaciones_hist_own_all') THEN
    CREATE POLICY "tasaciones_hist_own_all" ON tasaciones_historial
      FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasaciones_historial' AND policyname='tasaciones_hist_admin_all') THEN
    CREATE POLICY "tasaciones_hist_admin_all" ON tasaciones_historial
      FOR ALL USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_tasaciones_hist_usuario ON tasaciones_historial(usuario_id, created_at DESC);

-- ----

CREATE TABLE IF NOT EXISTS mir_chats (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacion_id      uuid NOT NULL,
  publicacion_tipo    text NOT NULL CHECK (publicacion_tipo IN ('ofrecido','busqueda')),
  corredor_a          uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  corredor_b          uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  ultimo_mensaje_at   timestamptz DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publicacion_id, corredor_a, corredor_b)
);
ALTER TABLE mir_chats ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mir_chats' AND policyname='mir_chats_participant_select') THEN
    CREATE POLICY "mir_chats_participant_select" ON mir_chats FOR SELECT USING (auth.uid() = corredor_a OR auth.uid() = corredor_b);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mir_chats' AND policyname='mir_chats_participant_insert') THEN
    CREATE POLICY "mir_chats_participant_insert" ON mir_chats FOR INSERT WITH CHECK (auth.uid() = corredor_a OR auth.uid() = corredor_b);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mir_chats' AND policyname='mir_chats_participant_update') THEN
    CREATE POLICY "mir_chats_participant_update" ON mir_chats FOR UPDATE USING (auth.uid() = corredor_a OR auth.uid() = corredor_b);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_mir_chats_corredor_a ON mir_chats(corredor_a);
CREATE INDEX IF NOT EXISTS idx_mir_chats_corredor_b ON mir_chats(corredor_b);
CREATE INDEX IF NOT EXISTS idx_mir_chats_ultimo     ON mir_chats(ultimo_mensaje_at DESC);

-- ----

CREATE TABLE IF NOT EXISTS mir_mensajes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     uuid NOT NULL REFERENCES mir_chats(id) ON DELETE CASCADE,
  autor_id    uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  texto       text NOT NULL,
  leido       boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mir_mensajes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mir_mensajes' AND policyname='mir_mensajes_participant_all') THEN
    CREATE POLICY "mir_mensajes_participant_all" ON mir_mensajes FOR ALL
      USING (EXISTS (SELECT 1 FROM mir_chats c WHERE c.id = chat_id AND (c.corredor_a = auth.uid() OR c.corredor_b = auth.uid())));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_mir_mensajes_chat  ON mir_mensajes(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_mir_mensajes_autor ON mir_mensajes(autor_id);

-- ----

CREATE TABLE IF NOT EXISTS mir_intereses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo              text NOT NULL,
  publicacion_id    uuid NOT NULL,
  publicacion_tipo  text NOT NULL CHECK (publicacion_tipo IN ('ofrecido','busqueda')),
  remitente_id      uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  destinatario_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  mensaje           text,
  leido             boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publicacion_id, remitente_id, tipo)
);
ALTER TABLE mir_intereses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mir_intereses' AND policyname='mir_intereses_participant_select') THEN
    CREATE POLICY "mir_intereses_participant_select" ON mir_intereses FOR SELECT USING (auth.uid() = remitente_id OR auth.uid() = destinatario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mir_intereses' AND policyname='mir_intereses_remitente_insert') THEN
    CREATE POLICY "mir_intereses_remitente_insert" ON mir_intereses FOR INSERT WITH CHECK (auth.uid() = remitente_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mir_intereses' AND policyname='mir_intereses_destinatario_update') THEN
    CREATE POLICY "mir_intereses_destinatario_update" ON mir_intereses FOR UPDATE USING (auth.uid() = destinatario_id OR auth.uid() = remitente_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_mir_intereses_remit ON mir_intereses(remitente_id);
CREATE INDEX IF NOT EXISTS idx_mir_intereses_dest  ON mir_intereses(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_mir_intereses_pub   ON mir_intereses(publicacion_id);

-- ----

CREATE TABLE IF NOT EXISTS inscripciones_eventos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, perfil_id)
);
ALTER TABLE inscripciones_eventos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inscripciones_eventos' AND policyname='inscripciones_eventos_own_all') THEN
    CREATE POLICY "inscripciones_eventos_own_all" ON inscripciones_eventos FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inscripciones_eventos' AND policyname='inscripciones_eventos_public_select') THEN
    CREATE POLICY "inscripciones_eventos_public_select" ON inscripciones_eventos FOR SELECT USING (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_inscripciones_evento ON inscripciones_eventos(evento_id);
CREATE INDEX IF NOT EXISTS idx_inscripciones_perfil ON inscripciones_eventos(perfil_id);

-- ----

CREATE TABLE IF NOT EXISTS canal_sesiones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text NOT NULL,
  mentor_nombre   text NOT NULL DEFAULT '',
  descripcion     text,
  fecha           date NOT NULL,
  hora            text NOT NULL DEFAULT '18:00',
  plataforma      text NOT NULL DEFAULT 'youtube' CHECK (plataforma IN ('youtube','zoom','meet')),
  link_live       text,
  link_grabacion  text,
  estado          text NOT NULL DEFAULT 'proxima' CHECK (estado IN ('proxima','en_vivo','grabada')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE canal_sesiones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='canal_sesiones' AND policyname='canal_sesiones_public_select') THEN
    CREATE POLICY "canal_sesiones_public_select" ON canal_sesiones FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='canal_sesiones' AND policyname='canal_sesiones_admin_all') THEN
    CREATE POLICY "canal_sesiones_admin_all" ON canal_sesiones FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_canal_sesiones_fecha ON canal_sesiones(fecha DESC);

-- ----

CREATE TABLE IF NOT EXISTS canal_consultas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id   uuid NOT NULL REFERENCES canal_sesiones(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  consulta    text NOT NULL,
  destacada   boolean NOT NULL DEFAULT false,
  votos       int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE canal_consultas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='canal_consultas' AND policyname='canal_consultas_public_select') THEN
    CREATE POLICY "canal_consultas_public_select" ON canal_consultas FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='canal_consultas' AND policyname='canal_consultas_own_insert') THEN
    CREATE POLICY "canal_consultas_own_insert" ON canal_consultas FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='canal_consultas' AND policyname='canal_consultas_admin_all') THEN
    CREATE POLICY "canal_consultas_admin_all" ON canal_consultas FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_canal_consultas_sesion ON canal_consultas(sesion_id);


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 101: biblioteca, divisas, enlaces, grupos_chat, mensajes_chat
-- ────────────────────────────────────────────────────────────

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
  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE biblioteca ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='biblioteca' AND policyname='biblioteca_aprobado_public_select') THEN
    CREATE POLICY "biblioteca_aprobado_public_select" ON biblioteca FOR SELECT USING (estado = 'aprobado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='biblioteca' AND policyname='biblioteca_own_all') THEN
    CREATE POLICY "biblioteca_own_all" ON biblioteca FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='biblioteca' AND policyname='biblioteca_admin_all') THEN
    CREATE POLICY "biblioteca_admin_all" ON biblioteca FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_biblioteca_perfil ON biblioteca(perfil_id);
CREATE INDEX IF NOT EXISTS idx_biblioteca_estado ON biblioteca(estado);
CREATE INDEX IF NOT EXISTS idx_biblioteca_cat    ON biblioteca(categoria);

-- ----

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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='divisas_proveedores' AND policyname='divisas_prov_public_select') THEN
    CREATE POLICY "divisas_prov_public_select" ON divisas_proveedores FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='divisas_proveedores' AND policyname='divisas_prov_admin_all') THEN
    CREATE POLICY "divisas_prov_admin_all" ON divisas_proveedores FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_divisas_prov_activo ON divisas_proveedores(activo, orden);

-- ----

CREATE TABLE IF NOT EXISTS divisas_accesos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id    uuid NOT NULL REFERENCES divisas_proveedores(id) ON DELETE CASCADE,
  accedido_por    uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  monto           numeric(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE divisas_accesos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='divisas_accesos' AND policyname='divisas_acc_own_select') THEN
    CREATE POLICY "divisas_acc_own_select" ON divisas_accesos FOR SELECT USING (auth.uid() = accedido_por);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='divisas_accesos' AND policyname='divisas_acc_own_insert') THEN
    CREATE POLICY "divisas_acc_own_insert" ON divisas_accesos FOR INSERT WITH CHECK (auth.uid() = accedido_por);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='divisas_accesos' AND policyname='divisas_acc_admin_all') THEN
    CREATE POLICY "divisas_acc_admin_all" ON divisas_accesos FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_divisas_acc_por ON divisas_accesos(accedido_por);

-- ----

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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='divisas_publicaciones' AND policyname='divisas_pub_active_select') THEN
    CREATE POLICY "divisas_pub_active_select" ON divisas_publicaciones FOR SELECT USING (activa = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='divisas_publicaciones' AND policyname='divisas_pub_own_all') THEN
    CREATE POLICY "divisas_pub_own_all" ON divisas_publicaciones FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='divisas_publicaciones' AND policyname='divisas_pub_admin_all') THEN
    CREATE POLICY "divisas_pub_admin_all" ON divisas_publicaciones FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_divisas_pub_activa ON divisas_publicaciones(activa, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_divisas_pub_perfil ON divisas_publicaciones(perfil_id);

-- ----

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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cotizacion_sugerencias' AND policyname='cot_sug_own_insert') THEN
    CREATE POLICY "cot_sug_own_insert" ON cotizacion_sugerencias FOR INSERT WITH CHECK (auth.uid() = perfil_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cotizacion_sugerencias' AND policyname='cot_sug_own_select') THEN
    CREATE POLICY "cot_sug_own_select" ON cotizacion_sugerencias FOR SELECT USING (auth.uid() = perfil_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cotizacion_sugerencias' AND policyname='cot_sug_admin_all') THEN
    CREATE POLICY "cot_sug_admin_all" ON cotizacion_sugerencias FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_cot_sug_proveedor ON cotizacion_sugerencias(proveedor_id);

-- ----

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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enlaces_utiles' AND policyname='enlaces_utiles_active_select') THEN
    CREATE POLICY "enlaces_utiles_active_select" ON enlaces_utiles FOR SELECT USING (activo = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enlaces_utiles' AND policyname='enlaces_utiles_admin_all') THEN
    CREATE POLICY "enlaces_utiles_admin_all" ON enlaces_utiles FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_enlaces_utiles_activo ON enlaces_utiles(activo, orden);

-- ----

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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enlaces_sugerencias' AND policyname='enlaces_sug_own_insert') THEN
    CREATE POLICY "enlaces_sug_own_insert" ON enlaces_sugerencias FOR INSERT WITH CHECK (auth.uid() = perfil_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enlaces_sugerencias' AND policyname='enlaces_sug_admin_all') THEN
    CREATE POLICY "enlaces_sug_admin_all" ON enlaces_sugerencias FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_enlaces_sug_perfil ON enlaces_sugerencias(perfil_id);

-- ----

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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='grupos_chat' AND policyname='grupos_chat_active_select') THEN
    CREATE POLICY "grupos_chat_active_select" ON grupos_chat FOR SELECT USING (activo = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='grupos_chat' AND policyname='grupos_chat_admin_all') THEN
    CREATE POLICY "grupos_chat_admin_all" ON grupos_chat FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_grupos_chat_activo ON grupos_chat(activo, orden);

-- ----

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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mensajes_chat' AND policyname='mensajes_chat_auth_select') THEN
    CREATE POLICY "mensajes_chat_auth_select" ON mensajes_chat FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mensajes_chat' AND policyname='mensajes_chat_own_insert') THEN
    -- mensajes_chat usa user_id (no perfil_id) — respetar columna existente
    CREATE POLICY "mensajes_chat_own_insert" ON mensajes_chat FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mensajes_chat' AND policyname='mensajes_chat_own_update') THEN
    CREATE POLICY "mensajes_chat_own_update" ON mensajes_chat FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mensajes_chat' AND policyname='mensajes_chat_admin_all') THEN
    CREATE POLICY "mensajes_chat_admin_all" ON mensajes_chat FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_mensajes_chat_grupo  ON mensajes_chat(grupo_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_mensajes_chat_user   ON mensajes_chat(user_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_chat_reply  ON mensajes_chat(reply_id) WHERE reply_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 102: tablas suplementarias del foro y red_proveedores_resenas
-- Nota: forum_topics y forum_replies ya existen en la DB
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forum_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_categories' AND policyname='forum_cat_public_select') THEN
    CREATE POLICY "forum_cat_public_select" ON forum_categories FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_categories' AND policyname='forum_cat_admin_all') THEN
    CREATE POLICY "forum_cat_admin_all" ON forum_categories FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_forum_cat_active ON forum_categories(is_active, sort_order);

-- ----

CREATE TABLE IF NOT EXISTS forum_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE forum_tags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_tags' AND policyname='forum_tags_public_select') THEN
    CREATE POLICY "forum_tags_public_select" ON forum_tags FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_tags' AND policyname='forum_tags_admin_all') THEN
    CREATE POLICY "forum_tags_admin_all" ON forum_tags FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;

-- ----

CREATE TABLE IF NOT EXISTS forum_topic_tags (
  topic_id  uuid NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  tag_id    uuid NOT NULL REFERENCES forum_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (topic_id, tag_id)
);
ALTER TABLE forum_topic_tags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_topic_tags' AND policyname='forum_topic_tags_public_select') THEN
    CREATE POLICY "forum_topic_tags_public_select" ON forum_topic_tags FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_topic_tags' AND policyname='forum_topic_tags_auth_insert') THEN
    CREATE POLICY "forum_topic_tags_auth_insert" ON forum_topic_tags FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM forum_topics WHERE id = topic_id AND author_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_topic_tags' AND policyname='forum_topic_tags_admin_all') THEN
    CREATE POLICY "forum_topic_tags_admin_all" ON forum_topic_tags FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;

-- ----

CREATE TABLE IF NOT EXISTS forum_saved_topics (
  user_id    uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  topic_id   uuid NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);
ALTER TABLE forum_saved_topics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_saved_topics' AND policyname='forum_saved_own_all') THEN
    CREATE POLICY "forum_saved_own_all" ON forum_saved_topics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_forum_saved_user ON forum_saved_topics(user_id);

-- ----

CREATE TABLE IF NOT EXISTS forum_reply_votes (
  reply_id   uuid NOT NULL REFERENCES forum_replies(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  value      smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reply_id, user_id)
);
ALTER TABLE forum_reply_votes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_reply_votes' AND policyname='forum_votes_public_select') THEN
    CREATE POLICY "forum_votes_public_select" ON forum_reply_votes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_reply_votes' AND policyname='forum_votes_own_all') THEN
    CREATE POLICY "forum_votes_own_all" ON forum_reply_votes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_forum_votes_reply ON forum_reply_votes(reply_id);

-- ----

CREATE TABLE IF NOT EXISTS forum_chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  body        text,
  adjuntos    jsonb,
  reply_id    uuid REFERENCES forum_chat_messages(id) ON DELETE SET NULL,
  editado     boolean NOT NULL DEFAULT false,
  eliminado   boolean NOT NULL DEFAULT false,
  reacciones  jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE forum_chat_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_chat_messages' AND policyname='forum_chat_auth_select') THEN
    CREATE POLICY "forum_chat_auth_select" ON forum_chat_messages FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_chat_messages' AND policyname='forum_chat_own_insert') THEN
    CREATE POLICY "forum_chat_own_insert" ON forum_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_chat_messages' AND policyname='forum_chat_own_update') THEN
    CREATE POLICY "forum_chat_own_update" ON forum_chat_messages FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_chat_messages' AND policyname='forum_chat_admin_all') THEN
    CREATE POLICY "forum_chat_admin_all" ON forum_chat_messages FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_forum_chat_created ON forum_chat_messages(created_at ASC);

-- ----

CREATE TABLE IF NOT EXISTS forum_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('reply','accepted_reply','mention','vote')),
  topic_id    uuid REFERENCES forum_topics(id) ON DELETE CASCADE,
  reply_id    uuid REFERENCES forum_replies(id) ON DELETE CASCADE,
  leido       boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE forum_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forum_notifications' AND policyname='forum_notif_own_all') THEN
    CREATE POLICY "forum_notif_own_all" ON forum_notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
-- índice omitido: forum_notifications pre-existe sin columna leido

-- ----

CREATE TABLE IF NOT EXISTS red_proveedores_resenas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id    uuid NOT NULL REFERENCES red_proveedores(id) ON DELETE CASCADE,
  perfil_id       uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  positiva        boolean NOT NULL DEFAULT true,
  comentario      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proveedor_id, perfil_id)
);
ALTER TABLE red_proveedores_resenas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='red_proveedores_resenas' AND policyname='resenas_public_select') THEN
    CREATE POLICY "resenas_public_select" ON red_proveedores_resenas FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='red_proveedores_resenas' AND policyname='resenas_own_insert') THEN
    CREATE POLICY "resenas_own_insert" ON red_proveedores_resenas FOR INSERT WITH CHECK (auth.uid() = perfil_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='red_proveedores_resenas' AND policyname='resenas_admin_all') THEN
    CREATE POLICY "resenas_admin_all" ON red_proveedores_resenas FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master')));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_resenas_proveedor ON red_proveedores_resenas(proveedor_id);


-- ────────────────────────────────────────────────────────────
-- MIGRACIÓN 103: dm_chats, dm_mensajes, listas de distribución
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dm_chats (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a            uuid        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  user_b            uuid        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  no_leido_a        int         NOT NULL DEFAULT 0,
  no_leido_b        int         NOT NULL DEFAULT 0,
  ultimo_mensaje_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_dm_order CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
ALTER TABLE dm_chats ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dm_chats' AND policyname='dm_chats_select') THEN
    CREATE POLICY "dm_chats_select" ON dm_chats FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dm_chats' AND policyname='dm_chats_insert') THEN
    CREATE POLICY "dm_chats_insert" ON dm_chats FOR INSERT WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dm_chats' AND policyname='dm_chats_update') THEN
    CREATE POLICY "dm_chats_update" ON dm_chats FOR UPDATE USING (auth.uid() = user_a OR auth.uid() = user_b);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_dm_chats_a ON dm_chats(user_a);
CREATE INDEX IF NOT EXISTS idx_dm_chats_b ON dm_chats(user_b);

-- ----

CREATE TABLE IF NOT EXISTS dm_mensajes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     uuid        NOT NULL REFERENCES dm_chats(id) ON DELETE CASCADE,
  autor_id    uuid        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  texto       text,
  adjuntos    jsonb,
  reply_id    uuid        REFERENCES dm_mensajes(id) ON DELETE SET NULL,
  editado     boolean     NOT NULL DEFAULT false,
  eliminado   boolean     NOT NULL DEFAULT false,
  leido       boolean     NOT NULL DEFAULT false,
  reacciones  jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dm_mensajes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dm_mensajes' AND policyname='dm_mensajes_select') THEN
    CREATE POLICY "dm_mensajes_select" ON dm_mensajes FOR SELECT
      USING (EXISTS (SELECT 1 FROM dm_chats c WHERE c.id = chat_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dm_mensajes' AND policyname='dm_mensajes_insert') THEN
    CREATE POLICY "dm_mensajes_insert" ON dm_mensajes FOR INSERT
      WITH CHECK (autor_id = auth.uid() AND EXISTS (SELECT 1 FROM dm_chats c WHERE c.id = chat_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dm_mensajes' AND policyname='dm_mensajes_update') THEN
    CREATE POLICY "dm_mensajes_update" ON dm_mensajes FOR UPDATE
      USING (EXISTS (SELECT 1 FROM dm_chats c WHERE c.id = chat_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_dm_mensajes_chat ON dm_mensajes(chat_id, created_at);

-- ----

CREATE TABLE IF NOT EXISTS listas_distribucion (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creador_id  uuid        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre      text        NOT NULL,
  descripcion text,
  activa      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE listas_distribucion ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_listas_dist_creador ON listas_distribucion(creador_id);

-- ----

CREATE TABLE IF NOT EXISTS listas_distribucion_miembros (
  lista_id    uuid NOT NULL REFERENCES listas_distribucion(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  PRIMARY KEY (lista_id, perfil_id)
);
ALTER TABLE listas_distribucion_miembros ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_listas_dist_miembros_perfil ON listas_distribucion_miembros(perfil_id);

-- policies de listas (van al final porque listas_dist_select referencia listas_distribucion_miembros)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='listas_distribucion' AND policyname='listas_dist_select') THEN
    CREATE POLICY "listas_dist_select" ON listas_distribucion FOR SELECT
      USING (creador_id = auth.uid() OR EXISTS (
        SELECT 1 FROM listas_distribucion_miembros m WHERE m.lista_id = id AND m.perfil_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='listas_distribucion' AND policyname='listas_dist_all') THEN
    CREATE POLICY "listas_dist_all" ON listas_distribucion FOR ALL USING (creador_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='listas_distribucion_miembros' AND policyname='listas_dist_miembros_select') THEN
    CREATE POLICY "listas_dist_miembros_select" ON listas_distribucion_miembros FOR SELECT
      USING (perfil_id = auth.uid() OR EXISTS (
        SELECT 1 FROM listas_distribucion l WHERE l.id = lista_id AND l.creador_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='listas_distribucion_miembros' AND policyname='listas_dist_miembros_manage') THEN
    CREATE POLICY "listas_dist_miembros_manage" ON listas_distribucion_miembros FOR ALL
      USING (EXISTS (SELECT 1 FROM listas_distribucion l WHERE l.id = lista_id AND l.creador_id = auth.uid()));
  END IF;
END $$;

-- ============================================================
-- FIN — todas las tablas creadas con IF NOT EXISTS
-- ============================================================
