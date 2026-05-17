-- Migration 077: Mejoras social_posts e indices
-- Mejora tabla social_posts: agregar fuente_url para trackear link publicado
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS fuente_url text;

-- Índice para consultas por contenido
CREATE INDEX IF NOT EXISTS idx_social_posts_contenido ON social_posts(contenido_tipo, contenido_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_estado ON social_posts(estado, created_at DESC);

-- Tabla para programar posts futuros (usa crm_posts_sociales que ya existe)
-- Agregar columnas faltantes si no existen
ALTER TABLE crm_posts_sociales ADD COLUMN IF NOT EXISTS red text DEFAULT 'todos';
ALTER TABLE crm_posts_sociales ADD COLUMN IF NOT EXISTS resultado jsonb;
ALTER TABLE crm_posts_sociales ADD COLUMN IF NOT EXISTS publicado_at timestamptz;

-- Vista para publicaciones sociales recientes (usada por dashboard)
CREATE OR REPLACE VIEW social_posts_recientes AS
SELECT sp.*,
  CASE sp.contenido_tipo
    WHEN 'noticia' THEN (SELECT titulo FROM noticias WHERE id = sp.contenido_id)
    WHEN 'evento' THEN (SELECT titulo FROM eventos WHERE id = sp.contenido_id)
    ELSE 'Publicación'
  END as contenido_titulo
FROM social_posts sp
WHERE sp.estado = 'success'
ORDER BY sp.created_at DESC;
