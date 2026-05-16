-- Migration 069: documentar web_corredor_config y agregar columnas de redes sociales
--
-- web_corredor_config se creó directamente en producción sin migration script.
-- Esta migration la documenta para reproducibilidad y agrega columnas de redes
-- sociales con ADD COLUMN IF NOT EXISTS (seguro si ya existen).

CREATE TABLE IF NOT EXISTS web_corredor_config (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id                     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  slug                          text UNIQUE NOT NULL,
  dominio_propio                text,
  plantilla                     text NOT NULL DEFAULT 'rosario-classic',
  activa                        boolean NOT NULL DEFAULT false,
  logo_url                      text,
  cover_url                     text,
  foto_sobre_mi_url             text,
  color_primario                text NOT NULL DEFAULT '#cc0000',
  color_secundario              text NOT NULL DEFAULT '#111111',
  color_texto                   text NOT NULL DEFAULT '#222222',
  color_fondo                   text NOT NULL DEFAULT '#ffffff',
  titulo_sitio                  text,
  subtitulo                     text,
  descripcion_profesional       text,
  anos_experiencia              integer,
  mostrar_formulario_contacto   boolean NOT NULL DEFAULT true,
  mostrar_formulario_tasacion   boolean NOT NULL DEFAULT true,
  mostrar_propiedades_destacadas boolean NOT NULL DEFAULT true,
  mostrar_sobre_mi              boolean NOT NULL DEFAULT true,
  mostrar_testimonios           boolean NOT NULL DEFAULT false,
  mostrar_blog                  boolean NOT NULL DEFAULT false,
  seo_titulo                    text,
  seo_descripcion               text,
  seo_keywords                  text,
  instagram                     text,
  facebook                      text,
  twitter                       text,
  linkedin                      text,
  whatsapp                      text,
  limite_propiedades_home       integer NOT NULL DEFAULT 6,
  google_analytics              text,
  script_header                 text,
  script_footer                 text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

-- Columnas de redes sociales (ADD COLUMN IF NOT EXISTS — seguro si ya existen)
ALTER TABLE web_corredor_config
  ADD COLUMN IF NOT EXISTS instagram   text,
  ADD COLUMN IF NOT EXISTS facebook    text,
  ADD COLUMN IF NOT EXISTS twitter     text,
  ADD COLUMN IF NOT EXISTS linkedin    text,
  ADD COLUMN IF NOT EXISTS whatsapp    text;

-- Columnas opcionales de personalización que el app también usa
ALTER TABLE web_corredor_config
  ADD COLUMN IF NOT EXISTS mostrar_blog        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS script_header       text,
  ADD COLUMN IF NOT EXISTS script_footer       text,
  ADD COLUMN IF NOT EXISTS foto_sobre_mi_url   text,
  ADD COLUMN IF NOT EXISTS seo_keywords        text,
  ADD COLUMN IF NOT EXISTS google_analytics    text,
  ADD COLUMN IF NOT EXISTS cover_url           text;

ALTER TABLE web_corredor_config ENABLE ROW LEVEL SECURITY;

-- Idempotent: sólo crea las policies si no existen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'web_corredor_config' AND policyname = 'wcc_own'
  ) THEN
    CREATE POLICY "wcc_own" ON web_corredor_config
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'web_corredor_config' AND policyname = 'wcc_public_read'
  ) THEN
    CREATE POLICY "wcc_public_read" ON web_corredor_config
      FOR SELECT USING (activa = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'web_corredor_config' AND policyname = 'wcc_admin'
  ) THEN
    CREATE POLICY "wcc_admin" ON web_corredor_config
      FOR ALL USING (es_admin_gfi());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wcc_perfil ON web_corredor_config(perfil_id);
CREATE INDEX IF NOT EXISTS idx_wcc_slug   ON web_corredor_config(slug);
