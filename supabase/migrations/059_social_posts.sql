-- Log de publicaciones automáticas en redes sociales
CREATE TABLE IF NOT EXISTS social_posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  red            text NOT NULL,            -- facebook, instagram, linkedin, twitter
  contenido_tipo text NOT NULL,            -- evento, noticia, curso
  contenido_id   uuid NOT NULL,
  estado         text NOT NULL DEFAULT 'pending', -- success, error
  post_id        text,                     -- ID devuelto por la plataforma
  error_msg      text,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_contenido ON social_posts(contenido_tipo, contenido_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_created   ON social_posts(created_at DESC);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_posts_admin" ON social_posts FOR ALL USING (es_admin_gfi());
