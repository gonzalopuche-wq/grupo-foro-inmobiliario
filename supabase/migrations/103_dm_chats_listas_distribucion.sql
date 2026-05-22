-- 103: DM 1:1 chats + listas de distribución

-- Chat 1:1 entre dos usuarios (canonical order: user_a < user_b)
CREATE TABLE IF NOT EXISTS dm_chats (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a          uuid        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  user_b          uuid        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  no_leido_a      int         NOT NULL DEFAULT 0,
  no_leido_b      int         NOT NULL DEFAULT 0,
  ultimo_mensaje_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_dm_order CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_dm_chats_a ON dm_chats(user_a);
CREATE INDEX IF NOT EXISTS idx_dm_chats_b ON dm_chats(user_b);

ALTER TABLE dm_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_chats_select" ON dm_chats FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "dm_chats_insert" ON dm_chats FOR INSERT
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "dm_chats_update" ON dm_chats FOR UPDATE
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Mensajes en chats 1:1
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

CREATE INDEX IF NOT EXISTS idx_dm_mensajes_chat ON dm_mensajes(chat_id, created_at);

ALTER TABLE dm_mensajes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_mensajes_select" ON dm_mensajes FOR SELECT
  USING (EXISTS (SELECT 1 FROM dm_chats c WHERE c.id = chat_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())));
CREATE POLICY "dm_mensajes_insert" ON dm_mensajes FOR INSERT
  WITH CHECK (autor_id = auth.uid() AND EXISTS (SELECT 1 FROM dm_chats c WHERE c.id = chat_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())));
CREATE POLICY "dm_mensajes_update" ON dm_mensajes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM dm_chats c WHERE c.id = chat_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())));

-- Listas de distribución (tipo broadcast list de WhatsApp)
CREATE TABLE IF NOT EXISTS listas_distribucion (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creador_id  uuid        NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre      text        NOT NULL,
  descripcion text,
  activa      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listas_dist_creador ON listas_distribucion(creador_id);
ALTER TABLE listas_distribucion ENABLE ROW LEVEL SECURITY;

-- Miembros de listas de distribución (crear antes de las policies que lo referencian)
CREATE TABLE IF NOT EXISTS listas_distribucion_miembros (
  lista_id    uuid NOT NULL REFERENCES listas_distribucion(id) ON DELETE CASCADE,
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  PRIMARY KEY (lista_id, perfil_id)
);

CREATE INDEX IF NOT EXISTS idx_listas_dist_miembros_perfil ON listas_distribucion_miembros(perfil_id);
ALTER TABLE listas_distribucion_miembros ENABLE ROW LEVEL SECURITY;

-- Policies de listas (van después de crear listas_distribucion_miembros)
CREATE POLICY "listas_dist_select" ON listas_distribucion FOR SELECT
  USING (creador_id = auth.uid() OR EXISTS (
    SELECT 1 FROM listas_distribucion_miembros m WHERE m.lista_id = id AND m.perfil_id = auth.uid()
  ));
CREATE POLICY "listas_dist_all" ON listas_distribucion FOR ALL
  USING (creador_id = auth.uid());

CREATE POLICY "listas_dist_miembros_select" ON listas_distribucion_miembros FOR SELECT
  USING (perfil_id = auth.uid() OR EXISTS (
    SELECT 1 FROM listas_distribucion l WHERE l.id = lista_id AND l.creador_id = auth.uid()
  ));
CREATE POLICY "listas_dist_miembros_manage" ON listas_distribucion_miembros FOR ALL
  USING (EXISTS (SELECT 1 FROM listas_distribucion l WHERE l.id = lista_id AND l.creador_id = auth.uid()));
