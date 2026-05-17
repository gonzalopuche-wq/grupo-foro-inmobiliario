-- ============================================================
-- 078: Red GFI – Tablas de red profesional y co-broking
-- Idempotente: seguro correr aunque ya esté aplicado.
-- ORDEN DE CREACIÓN: miembros → ofrecidos/buscados → conexiones
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- red_gfi_miembros
-- Perfil extendido de un corredor dentro de la Red GFI
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS red_gfi_miembros (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id           uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  matricula           text,
  zona_principal      text,
  zonas_secundarias   text[],
  especialidades      text[],                -- venta, alquiler, comercial, industrial, etc.
  descripcion         text,
  foto_url            text,
  web_url             text,
  instagram           text,
  linkedin            text,
  whatsapp            text,
  activo              boolean NOT NULL DEFAULT true,
  verificado          boolean NOT NULL DEFAULT false,
  puntaje             numeric(5,2) NOT NULL DEFAULT 0,
  operaciones_cerradas integer NOT NULL DEFAULT 0,
  anos_experiencia    integer,
  idiomas             text[],
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id)
);

-- Columnas que pueden faltar si la tabla existía antes
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS zonas_secundarias text[];
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS especialidades text[];
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS descripcion text;
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS web_url text;
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS linkedin text;
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS verificado boolean NOT NULL DEFAULT false;
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS puntaje numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS operaciones_cerradas integer NOT NULL DEFAULT 0;
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS anos_experiencia integer;
ALTER TABLE red_gfi_miembros ADD COLUMN IF NOT EXISTS idiomas text[];

ALTER TABLE red_gfi_miembros ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_miembros' AND policyname = 'rgfi_miembros_public_read') THEN
    CREATE POLICY "rgfi_miembros_public_read" ON red_gfi_miembros
      FOR SELECT USING (activo = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_miembros' AND policyname = 'rgfi_miembros_own') THEN
    CREATE POLICY "rgfi_miembros_own" ON red_gfi_miembros
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_miembros' AND policyname = 'rgfi_miembros_admin') THEN
    CREATE POLICY "rgfi_miembros_admin" ON red_gfi_miembros
      FOR ALL USING (es_admin_gfi());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rgfi_miembros_perfil  ON red_gfi_miembros(perfil_id);
CREATE INDEX IF NOT EXISTS idx_rgfi_miembros_zona    ON red_gfi_miembros(zona_principal);
CREATE INDEX IF NOT EXISTS idx_rgfi_miembros_activo  ON red_gfi_miembros(activo) WHERE activo = true;


-- ────────────────────────────────────────────────────────────
-- red_gfi_ofrecidos
-- Propiedades ofrecidas en co-broking por miembros de la red
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS red_gfi_ofrecidos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  miembro_id          uuid NOT NULL REFERENCES red_gfi_miembros(id) ON DELETE CASCADE,
  perfil_id           uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  tipo_operacion      text NOT NULL DEFAULT 'venta',   -- venta, alquiler, alquiler_temporal
  tipo_propiedad      text NOT NULL DEFAULT 'departamento',
  barrio              text,
  ciudad              text NOT NULL DEFAULT 'Rosario',
  provincia           text NOT NULL DEFAULT 'Santa Fe',
  precio              numeric(14,2),
  moneda              text NOT NULL DEFAULT 'USD',
  superficie_cubierta numeric(8,2),
  superficie_total    numeric(8,2),
  ambientes           integer,
  dormitorios         integer,
  banos               integer,
  descripcion         text,
  fotos_urls          text[],
  comision_cobro      numeric(5,2),    -- % de comisión que paga el co-broker
  comision_ofrecida   numeric(5,2),    -- % que recibe el co-broker si trae el cliente
  exclusiva           boolean NOT NULL DEFAULT false,
  destacada           boolean NOT NULL DEFAULT false,
  activa              boolean NOT NULL DEFAULT true,
  fecha_vencimiento   date,
  vistas              integer NOT NULL DEFAULT 0,
  contactos_recibidos integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE red_gfi_ofrecidos ADD COLUMN IF NOT EXISTS fotos_urls text[];
ALTER TABLE red_gfi_ofrecidos ADD COLUMN IF NOT EXISTS comision_cobro numeric(5,2);
ALTER TABLE red_gfi_ofrecidos ADD COLUMN IF NOT EXISTS comision_ofrecida numeric(5,2);
ALTER TABLE red_gfi_ofrecidos ADD COLUMN IF NOT EXISTS exclusiva boolean NOT NULL DEFAULT false;
ALTER TABLE red_gfi_ofrecidos ADD COLUMN IF NOT EXISTS destacada boolean NOT NULL DEFAULT false;
ALTER TABLE red_gfi_ofrecidos ADD COLUMN IF NOT EXISTS fecha_vencimiento date;
ALTER TABLE red_gfi_ofrecidos ADD COLUMN IF NOT EXISTS vistas integer NOT NULL DEFAULT 0;
ALTER TABLE red_gfi_ofrecidos ADD COLUMN IF NOT EXISTS contactos_recibidos integer NOT NULL DEFAULT 0;

ALTER TABLE red_gfi_ofrecidos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_ofrecidos' AND policyname = 'rgfi_ofrecidos_public_read') THEN
    CREATE POLICY "rgfi_ofrecidos_public_read" ON red_gfi_ofrecidos
      FOR SELECT USING (activa = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_ofrecidos' AND policyname = 'rgfi_ofrecidos_own') THEN
    CREATE POLICY "rgfi_ofrecidos_own" ON red_gfi_ofrecidos
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_ofrecidos' AND policyname = 'rgfi_ofrecidos_admin') THEN
    CREATE POLICY "rgfi_ofrecidos_admin" ON red_gfi_ofrecidos
      FOR ALL USING (es_admin_gfi());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rgfi_ofrecidos_miembro   ON red_gfi_ofrecidos(miembro_id);
CREATE INDEX IF NOT EXISTS idx_rgfi_ofrecidos_perfil    ON red_gfi_ofrecidos(perfil_id);
CREATE INDEX IF NOT EXISTS idx_rgfi_ofrecidos_ciudad    ON red_gfi_ofrecidos(ciudad);
CREATE INDEX IF NOT EXISTS idx_rgfi_ofrecidos_activa    ON red_gfi_ofrecidos(activa) WHERE activa = true;
CREATE INDEX IF NOT EXISTS idx_rgfi_ofrecidos_tipo_op   ON red_gfi_ofrecidos(tipo_operacion);


-- ────────────────────────────────────────────────────────────
-- red_gfi_buscados
-- Búsquedas activas que miembros quieren resolver en co-broking
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS red_gfi_buscados (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  miembro_id          uuid NOT NULL REFERENCES red_gfi_miembros(id) ON DELETE CASCADE,
  perfil_id           uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  tipo_operacion      text NOT NULL DEFAULT 'venta',
  tipo_propiedad      text[],                          -- puede buscar varios tipos
  barrios             text[],
  ciudad              text NOT NULL DEFAULT 'Rosario',
  precio_min          numeric(14,2),
  precio_max          numeric(14,2),
  moneda              text NOT NULL DEFAULT 'USD',
  superficie_min      numeric(8,2),
  dormitorios_min     integer,
  descripcion         text,
  comision_ofrecida   numeric(5,2),    -- % que paga si le consiguen la propiedad
  urgencia            text NOT NULL DEFAULT 'normal',  -- urgente, normal, flexible
  activa              boolean NOT NULL DEFAULT true,
  fecha_vencimiento   date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE red_gfi_buscados ADD COLUMN IF NOT EXISTS tipo_propiedad text[];
ALTER TABLE red_gfi_buscados ADD COLUMN IF NOT EXISTS barrios text[];
ALTER TABLE red_gfi_buscados ADD COLUMN IF NOT EXISTS comision_ofrecida numeric(5,2);
ALTER TABLE red_gfi_buscados ADD COLUMN IF NOT EXISTS urgencia text NOT NULL DEFAULT 'normal';
ALTER TABLE red_gfi_buscados ADD COLUMN IF NOT EXISTS fecha_vencimiento date;

ALTER TABLE red_gfi_buscados ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_buscados' AND policyname = 'rgfi_buscados_member_read') THEN
    CREATE POLICY "rgfi_buscados_member_read" ON red_gfi_buscados
      FOR SELECT USING (
        activa = true AND
        auth.uid() IN (SELECT perfil_id FROM red_gfi_miembros WHERE activo = true)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_buscados' AND policyname = 'rgfi_buscados_own') THEN
    CREATE POLICY "rgfi_buscados_own" ON red_gfi_buscados
      FOR ALL USING (auth.uid() = perfil_id) WITH CHECK (auth.uid() = perfil_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_buscados' AND policyname = 'rgfi_buscados_admin') THEN
    CREATE POLICY "rgfi_buscados_admin" ON red_gfi_buscados
      FOR ALL USING (es_admin_gfi());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rgfi_buscados_miembro ON red_gfi_buscados(miembro_id);
CREATE INDEX IF NOT EXISTS idx_rgfi_buscados_perfil  ON red_gfi_buscados(perfil_id);
CREATE INDEX IF NOT EXISTS idx_rgfi_buscados_ciudad  ON red_gfi_buscados(ciudad);
CREATE INDEX IF NOT EXISTS idx_rgfi_buscados_activa  ON red_gfi_buscados(activa) WHERE activa = true;


-- ────────────────────────────────────────────────────────────
-- red_gfi_conexiones
-- Conexiones entre miembros (solicitud, aceptada, rechazada)
-- Depende de: red_gfi_miembros (ya creada arriba)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS red_gfi_conexiones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id      uuid NOT NULL REFERENCES red_gfi_miembros(id) ON DELETE CASCADE,
  receptor_id         uuid NOT NULL REFERENCES red_gfi_miembros(id) ON DELETE CASCADE,
  estado              text NOT NULL DEFAULT 'pendiente',  -- pendiente, aceptada, rechazada, bloqueada
  mensaje_inicial     text,
  motivo              text,   -- co-broking, referido, consulta, otro
  operacion_id        uuid,   -- referencia opcional a un ofrecido o buscado
  tipo_operacion_ref  text,   -- 'ofrecido' | 'buscado'
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (solicitante_id, receptor_id)
);

ALTER TABLE red_gfi_conexiones ADD COLUMN IF NOT EXISTS mensaje_inicial text;
ALTER TABLE red_gfi_conexiones ADD COLUMN IF NOT EXISTS motivo text;
ALTER TABLE red_gfi_conexiones ADD COLUMN IF NOT EXISTS operacion_id uuid;
ALTER TABLE red_gfi_conexiones ADD COLUMN IF NOT EXISTS tipo_operacion_ref text;

ALTER TABLE red_gfi_conexiones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_conexiones' AND policyname = 'rgfi_conexiones_propio') THEN
    CREATE POLICY "rgfi_conexiones_propio" ON red_gfi_conexiones
      FOR ALL USING (
        auth.uid() IN (
          SELECT perfil_id FROM red_gfi_miembros
          WHERE id IN (solicitante_id, receptor_id)
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_conexiones' AND policyname = 'rgfi_conexiones_admin') THEN
    CREATE POLICY "rgfi_conexiones_admin" ON red_gfi_conexiones
      FOR ALL USING (es_admin_gfi());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rgfi_cx_solicitante ON red_gfi_conexiones(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_rgfi_cx_receptor    ON red_gfi_conexiones(receptor_id);
CREATE INDEX IF NOT EXISTS idx_rgfi_cx_estado      ON red_gfi_conexiones(estado);


-- ────────────────────────────────────────────────────────────
-- red_gfi_valoraciones
-- Valoraciones entre miembros después de cerrar una operación
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS red_gfi_valoraciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id        uuid NOT NULL REFERENCES red_gfi_miembros(id) ON DELETE CASCADE,
  receptor_id     uuid NOT NULL REFERENCES red_gfi_miembros(id) ON DELETE CASCADE,
  conexion_id     uuid REFERENCES red_gfi_conexiones(id) ON DELETE SET NULL,
  puntaje         integer NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
  comentario      text,
  visible         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (autor_id, receptor_id, conexion_id)
);

ALTER TABLE red_gfi_valoraciones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_valoraciones' AND policyname = 'rgfi_val_public_read') THEN
    CREATE POLICY "rgfi_val_public_read" ON red_gfi_valoraciones
      FOR SELECT USING (visible = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_valoraciones' AND policyname = 'rgfi_val_own_insert') THEN
    CREATE POLICY "rgfi_val_own_insert" ON red_gfi_valoraciones
      FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT perfil_id FROM red_gfi_miembros WHERE id = autor_id)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'red_gfi_valoraciones' AND policyname = 'rgfi_val_admin') THEN
    CREATE POLICY "rgfi_val_admin" ON red_gfi_valoraciones
      FOR ALL USING (es_admin_gfi());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rgfi_val_receptor ON red_gfi_valoraciones(receptor_id);
CREATE INDEX IF NOT EXISTS idx_rgfi_val_autor    ON red_gfi_valoraciones(autor_id);

-- Actualizar puntaje promedio en red_gfi_miembros cuando se agrega una valoración
CREATE OR REPLACE FUNCTION actualizar_puntaje_miembro()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE red_gfi_miembros
  SET puntaje = (
    SELECT COALESCE(AVG(puntaje), 0)
    FROM red_gfi_valoraciones
    WHERE receptor_id = NEW.receptor_id AND visible = true
  ),
  updated_at = now()
  WHERE id = NEW.receptor_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actualizar_puntaje ON red_gfi_valoraciones;
CREATE TRIGGER trg_actualizar_puntaje
  AFTER INSERT OR UPDATE ON red_gfi_valoraciones
  FOR EACH ROW EXECUTE FUNCTION actualizar_puntaje_miembro();
