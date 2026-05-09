-- ── Inbox unificado de consultas/leads ───────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id       uuid REFERENCES perfiles(id) ON DELETE CASCADE,
  propiedad_id    uuid REFERENCES cartera_propiedades(id) ON DELETE SET NULL,
  contacto_id     uuid REFERENCES crm_contactos(id) ON DELETE SET NULL,

  -- Datos del interesado
  nombre          text,
  telefono        text,
  email           text,
  mensaje         text,

  -- Origen del lead
  origen          text DEFAULT 'manual', -- manual | zonaprop | argenprop | mercadolibre | tokko | kiteprop | whatsapp | instagram | web | otro
  origen_ref      text,                  -- ID en el portal de origen

  -- Estado de gestión
  estado          text DEFAULT 'nuevo',  -- nuevo | contactado | en_seguimiento | visita_coordinada | cerrado | descartado
  prioridad       text DEFAULT 'media',  -- alta | media | baja
  notas           text,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'crm_leads' AND policyname = 'corredor_sus_leads'
  ) THEN
    CREATE POLICY "corredor_sus_leads" ON crm_leads FOR ALL USING (auth.uid() = perfil_id);
  END IF;
END $$;

-- ── Columnas adicionales en cartera_sync_portales para nuevos portales ──
ALTER TABLE cartera_sync_portales
  ADD COLUMN IF NOT EXISTS ml_id            text,
  ADD COLUMN IF NOT EXISTS ml_synced_at     timestamptz,
  ADD COLUMN IF NOT EXISTS ml_error         text,
  ADD COLUMN IF NOT EXISTS zonaprop_id      text,
  ADD COLUMN IF NOT EXISTS zonaprop_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS argenprop_id     text,
  ADD COLUMN IF NOT EXISTS argenprop_synced_at timestamptz;

-- ── Plantillas de descripción para cartera ────────────────────────────────
-- crm_plantillas ya existe (del CRM de contactos), extender para cartera:
ALTER TABLE crm_plantillas
  ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'crm'; -- 'crm' | 'cartera_descripcion'
