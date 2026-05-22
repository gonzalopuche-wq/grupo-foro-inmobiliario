-- Migration 102: tablas suplementarias del foro y red_proveedores_resenas
-- Nota: forum_topics y forum_replies ya existen en la DB (tablas base del foro)

-- ── forum_categories: categorías del foro ────────────────────────────────────

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

CREATE POLICY "forum_cat_public_select" ON forum_categories
  FOR SELECT USING (true);

CREATE POLICY "forum_cat_admin_all" ON forum_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_forum_cat_active ON forum_categories(is_active, sort_order);

-- ── forum_tags: etiquetas del foro ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forum_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE forum_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_tags_public_select" ON forum_tags
  FOR SELECT USING (true);

CREATE POLICY "forum_tags_admin_all" ON forum_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

-- ── forum_topic_tags: relación topics–tags ───────────────────────────────────

CREATE TABLE IF NOT EXISTS forum_topic_tags (
  topic_id  uuid NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  tag_id    uuid NOT NULL REFERENCES forum_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (topic_id, tag_id)
);

ALTER TABLE forum_topic_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_topic_tags_public_select" ON forum_topic_tags
  FOR SELECT USING (true);

CREATE POLICY "forum_topic_tags_auth_insert" ON forum_topic_tags
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM forum_topics WHERE id = topic_id AND author_id = auth.uid())
  );

CREATE POLICY "forum_topic_tags_admin_all" ON forum_topic_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

-- ── forum_saved_topics: topics guardados por usuario ─────────────────────────

CREATE TABLE IF NOT EXISTS forum_saved_topics (
  user_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  topic_id  uuid NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

ALTER TABLE forum_saved_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_saved_own_all" ON forum_saved_topics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_forum_saved_user ON forum_saved_topics(user_id);

-- ── forum_reply_votes: votos en respuestas del foro ──────────────────────────

CREATE TABLE IF NOT EXISTS forum_reply_votes (
  reply_id  uuid NOT NULL REFERENCES forum_replies(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  value     smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reply_id, user_id)
);

ALTER TABLE forum_reply_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_votes_public_select" ON forum_reply_votes
  FOR SELECT USING (true);

CREATE POLICY "forum_votes_own_all" ON forum_reply_votes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_forum_votes_reply ON forum_reply_votes(reply_id);

-- ── forum_chat_messages: chat global del foro ────────────────────────────────

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

CREATE POLICY "forum_chat_auth_select" ON forum_chat_messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "forum_chat_own_insert" ON forum_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "forum_chat_own_update" ON forum_chat_messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "forum_chat_admin_all" ON forum_chat_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_forum_chat_created ON forum_chat_messages(created_at ASC);

-- ── forum_notifications: notificaciones del foro ────────────────────────────

CREATE TABLE IF NOT EXISTS forum_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('reply','accepted_reply','mention','vote')),
  topic_id    uuid REFERENCES forum_topics(id) ON DELETE CASCADE,
  reply_id    uuid REFERENCES forum_replies(id) ON DELETE CASCADE,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE forum_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_notif_own_all" ON forum_notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_forum_notif_user ON forum_notifications(user_id, read, created_at DESC);

-- ── red_proveedores_resenas: reseñas de proveedores ──────────────────────────

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

CREATE POLICY "resenas_public_select" ON red_proveedores_resenas
  FOR SELECT USING (true);

CREATE POLICY "resenas_own_insert" ON red_proveedores_resenas
  FOR INSERT WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "resenas_admin_all" ON red_proveedores_resenas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_resenas_proveedor ON red_proveedores_resenas(proveedor_id);
