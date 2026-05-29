-- Propiedades sincronizadas desde portales externos
CREATE TABLE IF NOT EXISTS propiedades_externas (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  portal              text        NOT NULL CHECK (portal IN ('mercadolibre','zonaprop','argenprop','properati')),
  portal_id           text        NOT NULL,
  url                 text,
  titulo              text,
  operacion           text,       -- 'venta' | 'alquiler' | 'alquiler_temporal'
  tipo                text,       -- 'departamento' | 'casa' | 'ph' | 'local' | 'oficina' | 'terreno' | 'cochera' | 'galpón' | 'otro'
  precio              numeric,
  moneda              text        DEFAULT 'USD',
  dormitorios         integer,
  banos               integer,
  ambientes           integer,
  superficie_cubierta numeric,
  sup_terreno         numeric,
  expensas            numeric,
  barrio              text,
  ciudad              text        DEFAULT 'Rosario',
  provincia           text        DEFAULT 'Santa Fe',
  direccion           text,
  lat                 numeric,
  lng                 numeric,
  imagenes            jsonb       DEFAULT '[]',
  descripcion         text,
  datos_raw           jsonb       DEFAULT '{}',
  activa              boolean     DEFAULT true,
  synced_at           timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now(),
  UNIQUE (portal, portal_id)
);

CREATE INDEX IF NOT EXISTS prop_ext_portal_idx    ON propiedades_externas(portal);
CREATE INDEX IF NOT EXISTS prop_ext_op_idx        ON propiedades_externas(operacion);
CREATE INDEX IF NOT EXISTS prop_ext_tipo_idx      ON propiedades_externas(tipo);
CREATE INDEX IF NOT EXISTS prop_ext_precio_idx    ON propiedades_externas(precio);
CREATE INDEX IF NOT EXISTS prop_ext_synced_idx    ON propiedades_externas(synced_at DESC);
CREATE INDEX IF NOT EXISTS prop_ext_ciudad_idx    ON propiedades_externas(ciudad);
CREATE INDEX IF NOT EXISTS prop_ext_dorm_idx      ON propiedades_externas(dormitorios);

ALTER TABLE propiedades_externas ENABLE ROW LEVEL SECURITY;

-- Solo usuarios autenticados pueden leer
CREATE POLICY "prop_ext_auth_read" ON propiedades_externas
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo servicio puede escribir (sync corre con service role key)
-- No se necesita policy de escritura para usuarios regulares
