-- Migration 100: tablas pendientes — tasaciones_historial, mir_chats/mensajes/intereses,
--                inscripciones_eventos, canal_sesiones/consultas

-- ── tasaciones_historial: historial de tasaciones IA por usuario ─────────────

CREATE TABLE IF NOT EXISTS tasaciones_historial (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  datos_propiedad   jsonb,
  resultado         jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasaciones_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasaciones_hist_own_all" ON tasaciones_historial
  FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "tasaciones_hist_admin_all" ON tasaciones_historial
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_tasaciones_hist_usuario ON tasaciones_historial(usuario_id, created_at DESC);

-- ── mir_chats: conversaciones entre corredores en MIR ────────────────────────

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

CREATE POLICY "mir_chats_participant_select" ON mir_chats
  FOR SELECT USING (auth.uid() = corredor_a OR auth.uid() = corredor_b);

CREATE POLICY "mir_chats_participant_insert" ON mir_chats
  FOR INSERT WITH CHECK (auth.uid() = corredor_a OR auth.uid() = corredor_b);

CREATE POLICY "mir_chats_participant_update" ON mir_chats
  FOR UPDATE USING (auth.uid() = corredor_a OR auth.uid() = corredor_b);

CREATE INDEX IF NOT EXISTS idx_mir_chats_corredor_a ON mir_chats(corredor_a);
CREATE INDEX IF NOT EXISTS idx_mir_chats_corredor_b ON mir_chats(corredor_b);
CREATE INDEX IF NOT EXISTS idx_mir_chats_ultimo     ON mir_chats(ultimo_mensaje_at DESC);

-- ── mir_mensajes: mensajes dentro de un chat MIR ────────────────────────────

CREATE TABLE IF NOT EXISTS mir_mensajes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     uuid NOT NULL REFERENCES mir_chats(id) ON DELETE CASCADE,
  autor_id    uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  texto       text NOT NULL,
  leido       boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mir_mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mir_mensajes_participant_all" ON mir_mensajes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM mir_chats c
      WHERE c.id = chat_id
        AND (c.corredor_a = auth.uid() OR c.corredor_b = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_mir_mensajes_chat   ON mir_mensajes(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_mir_mensajes_autor  ON mir_mensajes(autor_id);

-- ── mir_intereses: señales de interés entre corredores ───────────────────────

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

CREATE POLICY "mir_intereses_participant_select" ON mir_intereses
  FOR SELECT USING (auth.uid() = remitente_id OR auth.uid() = destinatario_id);

CREATE POLICY "mir_intereses_remitente_insert" ON mir_intereses
  FOR INSERT WITH CHECK (auth.uid() = remitente_id);

CREATE POLICY "mir_intereses_destinatario_update" ON mir_intereses
  FOR UPDATE USING (auth.uid() = destinatario_id OR auth.uid() = remitente_id);

CREATE INDEX IF NOT EXISTS idx_mir_intereses_remit  ON mir_intereses(remitente_id);
CREATE INDEX IF NOT EXISTS idx_mir_intereses_dest   ON mir_intereses(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_mir_intereses_pub    ON mir_intereses(publicacion_id);

-- ── inscripciones_eventos: asistencia a eventos del foro ────────────────────

CREATE TABLE IF NOT EXISTS inscripciones_eventos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, perfil_id)
);

ALTER TABLE inscripciones_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inscripciones_eventos_own_all" ON inscripciones_eventos
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "inscripciones_eventos_public_select" ON inscripciones_eventos
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_inscripciones_evento  ON inscripciones_eventos(evento_id);
CREATE INDEX IF NOT EXISTS idx_inscripciones_perfil  ON inscripciones_eventos(perfil_id);

-- ── canal_sesiones: sesiones del canal educativo ─────────────────────────────

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

CREATE POLICY "canal_sesiones_public_select" ON canal_sesiones
  FOR SELECT USING (true);

CREATE POLICY "canal_sesiones_admin_all" ON canal_sesiones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_canal_sesiones_fecha ON canal_sesiones(fecha DESC);

-- ── canal_consultas: preguntas de usuarios en sesiones ───────────────────────

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

CREATE POLICY "canal_consultas_public_select" ON canal_consultas
  FOR SELECT USING (true);

CREATE POLICY "canal_consultas_own_insert" ON canal_consultas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "canal_consultas_admin_all" ON canal_consultas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_canal_consultas_sesion ON canal_consultas(sesion_id);
