-- Listas de búsqueda del CRM: corredor comparte lista de propiedades con cliente
CREATE TABLE IF NOT EXISTS crm_listas_busqueda (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corredor_id       uuid NOT NULL,
  contacto_id       uuid,
  nombre            text NOT NULL,
  descripcion       text,
  slug              text UNIQUE,
  criterios         jsonb NOT NULL DEFAULT '{}',
  email_cliente     text,
  notificar_cliente boolean NOT NULL DEFAULT true,
  publica           boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clb_corredor ON crm_listas_busqueda(corredor_id);
CREATE INDEX IF NOT EXISTS idx_clb_slug     ON crm_listas_busqueda(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clb_contacto ON crm_listas_busqueda(contacto_id) WHERE contacto_id IS NOT NULL;

-- Auto-slug desde id cuando no se provee
CREATE OR REPLACE FUNCTION gen_lista_slug()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := LEFT(REPLACE(NEW.id::text, '-', ''), 12);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lista_slug ON crm_listas_busqueda;
CREATE TRIGGER trg_lista_slug
  BEFORE INSERT ON crm_listas_busqueda
  FOR EACH ROW EXECUTE FUNCTION gen_lista_slug();

-- Propiedades guardadas en una lista
CREATE TABLE IF NOT EXISTS crm_propiedades_guardadas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id            uuid NOT NULL REFERENCES crm_listas_busqueda(id) ON DELETE CASCADE,
  corredor_id         uuid NOT NULL,
  url_original        text NOT NULL,
  titulo              text,
  tipo                text,
  operacion           text,
  precio_actual       numeric,
  moneda              text DEFAULT 'USD',
  ciudad              text,
  zona                text,
  dormitorios         int,
  banos               int,
  superficie_cubierta numeric,
  superficie_total    numeric,
  fotos               text[] DEFAULT '{}',
  foto_url            text,
  destacada           boolean NOT NULL DEFAULT false,
  orden               int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lista_id, url_original)
);

CREATE INDEX IF NOT EXISTS idx_cpg_lista    ON crm_propiedades_guardadas(lista_id);
CREATE INDEX IF NOT EXISTS idx_cpg_corredor ON crm_propiedades_guardadas(corredor_id);

-- Alertas de cambios en propiedades guardadas (baja de precio, nuevo, etc.)
CREATE TABLE IF NOT EXISTS crm_busqueda_alertas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propiedad_id   uuid REFERENCES crm_propiedades_guardadas(id) ON DELETE CASCADE,
  lista_id       uuid REFERENCES crm_listas_busqueda(id) ON DELETE CASCADE,
  corredor_id    uuid NOT NULL,
  tipo           text NOT NULL,
  valor_anterior text,
  valor_nuevo    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cba_lista ON crm_busqueda_alertas(lista_id, created_at DESC);

-- RLS: corredor accede a sus propias listas y propiedades
ALTER TABLE crm_listas_busqueda      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_propiedades_guardadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_busqueda_alertas     ENABLE ROW LEVEL SECURITY;

CREATE POLICY clb_corredor ON crm_listas_busqueda
  FOR ALL TO authenticated
  USING (corredor_id = auth.uid())
  WITH CHECK (corredor_id = auth.uid());

CREATE POLICY clb_publica ON crm_listas_busqueda
  FOR SELECT USING (publica = true);

CREATE POLICY cpg_corredor ON crm_propiedades_guardadas
  FOR ALL TO authenticated
  USING (corredor_id = auth.uid())
  WITH CHECK (corredor_id = auth.uid());

CREATE POLICY cpg_publica ON crm_propiedades_guardadas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM crm_listas_busqueda l WHERE l.id = lista_id AND l.publica = true)
  );

CREATE POLICY cba_corredor ON crm_busqueda_alertas
  FOR ALL TO authenticated
  USING (corredor_id = auth.uid())
  WITH CHECK (corredor_id = auth.uid());
