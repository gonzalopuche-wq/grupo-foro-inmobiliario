-- mi_web_posts: artículos del blog de la web pública del corredor
CREATE TABLE IF NOT EXISTS mi_web_posts (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  perfil_id   uuid        REFERENCES perfiles(id) ON DELETE CASCADE,
  titulo      text        NOT NULL,
  slug        text        NOT NULL,
  contenido   text        NOT NULL DEFAULT '',
  resumen     text        NOT NULL DEFAULT '',
  imagen_url  text,
  publicado   boolean     DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mi_web_posts_perfil_id ON mi_web_posts(perfil_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mi_web_posts_slug ON mi_web_posts(perfil_id, slug);

ALTER TABLE mi_web_posts ENABLE ROW LEVEL SECURITY;

-- El corredor gestiona sus propios posts
CREATE POLICY "corredor_gestiona_sus_posts"
  ON mi_web_posts FOR ALL
  USING (auth.uid() = perfil_id);

-- Lectura pública de posts publicados (para web pública)
CREATE POLICY "publico_lee_posts_publicados"
  ON mi_web_posts FOR SELECT
  USING (publicado = true);
