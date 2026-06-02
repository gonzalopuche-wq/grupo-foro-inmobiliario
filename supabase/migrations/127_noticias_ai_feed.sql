-- Migration 127: Tabla para noticias captadas automáticamente por IA
-- Se guardan acá antes de que el admin las apruebe y publique en la tabla noticias

CREATE TABLE IF NOT EXISTS noticias_ai_feed (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text NOT NULL,
  resumen       text,
  contenido     text,
  url           text NOT NULL,
  imagen_url    text,
  fuente        text,
  fuente_url    text,
  fecha_fuente  timestamptz,
  categoria     text,           -- alquiler, venta, legislacion, mercado, sector
  score         integer,        -- 0-100 relevancia inmobiliaria (IA)
  estado        text NOT NULL DEFAULT 'pendiente', -- pendiente | publicada | descartada
  publicada_como uuid REFERENCES noticias(id) ON DELETE SET NULL,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_nai_estado    ON noticias_ai_feed(estado);
CREATE INDEX IF NOT EXISTS idx_nai_score     ON noticias_ai_feed(score DESC);
CREATE INDEX IF NOT EXISTS idx_nai_fetched   ON noticias_ai_feed(fetched_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nai_url ON noticias_ai_feed(url);

-- RLS: solo admin puede leer/escribir desde la web
ALTER TABLE noticias_ai_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin lee noticias ai" ON noticias_ai_feed;
CREATE POLICY "admin lee noticias ai" ON noticias_ai_feed
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE id = auth.uid()
        AND tipo IN ('admin', 'master', 'admin_contenido')
    )
  );

DROP POLICY IF EXISTS "service role all noticias ai" ON noticias_ai_feed;
CREATE POLICY "service role all noticias ai" ON noticias_ai_feed
  FOR ALL TO service_role USING (true) WITH CHECK (true);
