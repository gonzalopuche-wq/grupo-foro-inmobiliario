-- cartera_parametros: configuración por defecto para el formulario de cartera
CREATE TABLE IF NOT EXISTS cartera_parametros (
  perfil_id                     uuid PRIMARY KEY REFERENCES perfiles(id) ON DELETE CASCADE,
  ciudad_default                text DEFAULT 'Rosario',
  zona_default                  text,
  moneda_default                text DEFAULT 'USD',
  operacion_default             text DEFAULT 'Venta',
  tipo_default                  text DEFAULT 'Departamento',
  honorario_propietario_default numeric(4,2),
  honorario_comprador_default   numeric(4,2),
  honorario_compartir_default   text DEFAULT '50%',
  mostrar_honorarios            boolean DEFAULT true,
  codigo_prefijo                text,
  codigo_contador               integer DEFAULT 1,
  campos_obligatorios           text[] DEFAULT '{}',
  nota_interna_default          text,
  updated_at                    timestamptz DEFAULT now()
);

ALTER TABLE cartera_parametros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corredor_sus_parametros"
  ON cartera_parametros FOR ALL
  USING (auth.uid() = perfil_id);

-- Campos adicionales en cartera_propiedades para documentación legal y CI
ALTER TABLE cartera_propiedades
  ADD COLUMN IF NOT EXISTS contacto_propietario_id uuid REFERENCES crm_contactos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ci_url                  text,
  ADD COLUMN IF NOT EXISTS ci_fecha_obtencion      date,
  ADD COLUMN IF NOT EXISTS ci_fecha_vencimiento    date,
  ADD COLUMN IF NOT EXISTS ci_numero               text,
  ADD COLUMN IF NOT EXISTS ci_observaciones        text,
  ADD COLUMN IF NOT EXISTS escritura_url           text,
  ADD COLUMN IF NOT EXISTS plano_url               text,
  ADD COLUMN IF NOT EXISTS reglamento_url          text,
  ADD COLUMN IF NOT EXISTS api_ninios              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS api_ninios_numero       text,
  ADD COLUMN IF NOT EXISTS url_portal_origen       text;
