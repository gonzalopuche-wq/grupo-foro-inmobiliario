-- Migración 136: Listas de colores para organizar gente (CRM + comunidad + foro)
-- ─────────────────────────────────────────────────────────────────────────────
-- Estilo "Listas" de WhatsApp Business: cada corredor crea sus propias listas
-- (nombre + color) y asigna gente a varias. Un ítem puede ser un contacto del
-- CRM (contacto_id) o un miembro de GFI / perfil (miembro_id) para usarlas
-- también en Comunidad y Foro. Todo es privado del corredor que las creó.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_listas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  color       text NOT NULL DEFAULT '#6366F1',
  orden       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_listas ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_listas' AND policyname = 'crm_listas_own') THEN
    CREATE POLICY crm_listas_own ON crm_listas
      FOR ALL USING (perfil_id = auth.uid()) WITH CHECK (perfil_id = auth.uid());
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_crm_listas_perfil ON crm_listas(perfil_id);

-- Asignación: una persona (contacto del CRM o miembro GFI) en una lista.
CREATE TABLE IF NOT EXISTS crm_listas_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id     uuid NOT NULL REFERENCES crm_listas(id) ON DELETE CASCADE,
  perfil_id    uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,   -- dueño (para RLS)
  contacto_id  uuid REFERENCES crm_contactos(id) ON DELETE CASCADE,
  miembro_id   uuid REFERENCES perfiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Exactamente uno de los dos: o es un contacto del CRM, o es un miembro GFI.
  CONSTRAINT crm_listas_items_target CHECK ((contacto_id IS NOT NULL) <> (miembro_id IS NOT NULL))
);

ALTER TABLE crm_listas_items ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_listas_items' AND policyname = 'crm_listas_items_own') THEN
    CREATE POLICY crm_listas_items_own ON crm_listas_items
      FOR ALL USING (perfil_id = auth.uid()) WITH CHECK (perfil_id = auth.uid());
  END IF;
END $$;
-- Sin duplicados: la misma persona no se agrega dos veces a la misma lista.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_crm_listas_items_contacto ON crm_listas_items(lista_id, contacto_id) WHERE contacto_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_crm_listas_items_miembro  ON crm_listas_items(lista_id, miembro_id)  WHERE miembro_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_listas_items_perfil   ON crm_listas_items(perfil_id);
CREATE INDEX IF NOT EXISTS idx_crm_listas_items_contacto ON crm_listas_items(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_listas_items_miembro  ON crm_listas_items(miembro_id);
