-- ── Beneficios de sponsors (imagen + descripción + expiración + schedule foro) ─
CREATE TABLE IF NOT EXISTS sponsor_beneficios (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id        uuid NOT NULL REFERENCES red_proveedores(id) ON DELETE CASCADE,
  titulo              text NOT NULL,
  descripcion         text,
  imagen_url          text,
  vigente_desde       date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta       date,
  activo              boolean NOT NULL DEFAULT true,
  -- Republicación automática en Foro
  republica_frecuencia text NOT NULL DEFAULT 'ninguna',  -- ninguna/diaria/2x_semana/semanal
  republica_proxima   date,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sb_proveedor  ON sponsor_beneficios(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_sb_activo     ON sponsor_beneficios(activo);
CREATE INDEX IF NOT EXISTS idx_sb_proxima    ON sponsor_beneficios(republica_proxima);

ALTER TABLE sponsor_beneficios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth puede ver beneficios activos"
  ON sponsor_beneficios FOR SELECT
  USING (auth.uid() IS NOT NULL AND activo = true);

CREATE POLICY "admin gestiona beneficios"
  ON sponsor_beneficios FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));

-- ── Solicitudes públicas de registro como sponsor ──────────────────────────
CREATE TABLE IF NOT EXISTS sponsor_solicitudes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa           text NOT NULL,
  rubro             text NOT NULL,
  descripcion       text,
  contacto_nombre   text NOT NULL,
  contacto_email    text NOT NULL,
  contacto_telefono text,
  sitio_web         text,
  mensaje           text,
  estado            text NOT NULL DEFAULT 'pendiente',  -- pendiente/aprobada/rechazada
  nota_admin        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sponsor_solicitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin gestiona solicitudes"
  ON sponsor_solicitudes FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));
