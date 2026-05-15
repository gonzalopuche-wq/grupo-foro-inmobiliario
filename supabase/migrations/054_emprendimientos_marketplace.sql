-- MOD 53/54/55: Emprendimientos como Marketplace Bidireccional
-- Constructoras suben proyectos, corredores GFI los ven y venden unidades.
-- El tipo 'constructora' se agrega como valor válido en perfiles.tipo (text, sin constraint).

-- Nuevos campos en emprendimientos
ALTER TABLE emprendimientos
  ADD COLUMN IF NOT EXISTS es_publica         boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS contacto_nombre    text,
  ADD COLUMN IF NOT EXISTS contacto_email     text,
  ADD COLUMN IF NOT EXISTS contacto_whatsapp  text,
  ADD COLUMN IF NOT EXISTS web_url            text,
  ADD COLUMN IF NOT EXISTS comision_corredor_pct numeric(4,2) DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS barrio             text,
  ADD COLUMN IF NOT EXISTS dormitorios_desde  integer,
  ADD COLUMN IF NOT EXISTS dormitorios_hasta  integer,
  ADD COLUMN IF NOT EXISTS sup_desde          numeric(8,2),
  ADD COLUMN IF NOT EXISTS sup_hasta          numeric(8,2),
  ADD COLUMN IF NOT EXISTS amenities          text[];

-- Índices
CREATE INDEX IF NOT EXISTS idx_emprendimientos_perfil   ON emprendimientos(perfil_id);
CREATE INDEX IF NOT EXISTS idx_emprendimientos_publica  ON emprendimientos(es_publica);
CREATE INDEX IF NOT EXISTS idx_emprendimientos_etapa    ON emprendimientos(etapa);

-- RLS: constructoras gestionan los suyos; corredores/admins leen públicos
ALTER TABLE emprendimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emp_own" ON emprendimientos;
CREATE POLICY "emp_own" ON emprendimientos
  FOR ALL USING (
    perfil_id = auth.uid()
    OR (SELECT tipo FROM perfiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "emp_public_read" ON emprendimientos;
CREATE POLICY "emp_public_read" ON emprendimientos
  FOR SELECT USING (es_publica = true);
