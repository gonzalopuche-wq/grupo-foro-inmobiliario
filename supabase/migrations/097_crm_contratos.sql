-- Migration 097: crm_contratos — contratos de alquiler activos por corredor

CREATE TABLE IF NOT EXISTS crm_contratos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id             uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  inquilino_nombre      text NOT NULL DEFAULT '',
  inquilino_telefono    text,
  propietario_nombre    text NOT NULL DEFAULT '',
  propietario_telefono  text,
  direccion             text NOT NULL DEFAULT '',
  barrio                text,
  tipo_propiedad        text,
  fecha_inicio          date NOT NULL,
  fecha_fin             date NOT NULL,
  alquiler_inicial      numeric NOT NULL DEFAULT 0,
  alquiler_actual       numeric NOT NULL DEFAULT 0,
  indice_ajuste         text NOT NULL DEFAULT 'ICL'
                          CHECK (indice_ajuste IN ('ICL','IPC','CER','CAC','fijo')),
  tasa_ajuste_anual     numeric NOT NULL DEFAULT 0,
  periodo_ajuste_meses  int NOT NULL DEFAULT 12,
  moneda                text NOT NULL DEFAULT 'ARS'
                          CHECK (moneda IN ('ARS','USD')),
  honorarios_admin      numeric NOT NULL DEFAULT 0,
  deposito_meses        int NOT NULL DEFAULT 1,
  notas                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_contratos_own_all" ON crm_contratos
  FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);

CREATE POLICY "crm_contratos_admin_all" ON crm_contratos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo IN ('admin','master'))
  );

CREATE INDEX IF NOT EXISTS idx_crm_contratos_perfil   ON crm_contratos(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_contratos_fecha_fin ON crm_contratos(fecha_fin);
