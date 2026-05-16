-- mi_web_testimonios: testimonios de clientes para la web pública del corredor
CREATE TABLE IF NOT EXISTS mi_web_testimonios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id  uuid REFERENCES perfiles(id) ON DELETE CASCADE NOT NULL,
  nombre_cliente text NOT NULL,
  cargo_cliente  text,
  texto          text NOT NULL,
  rating         int  DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  activo         boolean DEFAULT true,
  orden          int DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mi_web_testimonios_perfil_id ON mi_web_testimonios(perfil_id);

ALTER TABLE mi_web_testimonios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON mi_web_testimonios
  FOR ALL USING (perfil_id = auth.uid()) WITH CHECK (perfil_id = auth.uid());

CREATE POLICY "public_read" ON mi_web_testimonios
  FOR SELECT USING (activo = true);
