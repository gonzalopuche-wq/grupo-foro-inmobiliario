-- Migración 131: Facturación electrónica AFIP (WSFE) + emisores con reparto por socio
-- ─────────────────────────────────────────────────────────────────────────────
-- Modelo de datos para emitir facturas fiscales reales (con CAE) al cobrar el
-- abono mensual. NO incluye el cliente SOAP (eso va en la Etapa 2, cuando estén
-- cargadas las credenciales/certificado AFIP). Esta migración es solo estructura.
--
-- Conceptos:
--  • facturacion_emisores: uno o más CUIT emisores. El `porcentaje_facturacion`
--    permite repartir la facturación entre socios (ej: 70% un CUIT, 30% otro).
--    Cada factura sale a nombre de UN emisor; si hay reparto se emite una factura
--    por emisor por su porcentaje.
--  • facturas_afip: cada comprobante electrónico emitido (una fila por emisor ×
--    corredor × período). Guarda CAE, vencimiento, números y los JSON de
--    request/response para auditoría.
--  • perfiles.condicion_iva: condición del RECEPTOR (corredor) para decidir el
--    tipo de comprobante (A si Responsable Inscripto, B/C en otro caso).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Receptor: condición frente al IVA ────────────────────────────────────────
-- 'RI' Responsable Inscripto · 'MT' Monotributo · 'CF' Consumidor Final · 'EX' Exento
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS condicion_iva text;

-- ── Emisores (CUIT) y reparto de facturación por socio ───────────────────────
CREATE TABLE IF NOT EXISTS facturacion_emisores (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social            text NOT NULL,
  cuit                    text NOT NULL,
  condicion_iva           text NOT NULL DEFAULT 'RI',     -- emisor: típicamente RI
  punto_venta             int  NOT NULL DEFAULT 1,        -- punto de venta habilitado en AFIP
  porcentaje_facturacion  numeric(5,2) NOT NULL DEFAULT 100
                           CHECK (porcentaje_facturacion > 0 AND porcentaje_facturacion <= 100),
  es_principal            boolean DEFAULT false,          -- emisor por defecto
  activo                  boolean DEFAULT true,
  socio_id                uuid REFERENCES admin_socios(id) ON DELETE SET NULL, -- vínculo opcional con el socio
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN facturacion_emisores.porcentaje_facturacion IS
  'Porcentaje del total a facturar por este emisor. La suma de los emisores activos debería dar 100.';

-- ── Facturas electrónicas emitidas (CAE) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas_afip (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emisor_id       uuid REFERENCES facturacion_emisores(id) ON DELETE SET NULL,
  perfil_id       uuid REFERENCES perfiles(id) ON DELETE SET NULL,   -- receptor (corredor)
  suscripcion_id  uuid REFERENCES suscripciones(id) ON DELETE SET NULL,
  periodo         text NOT NULL,                          -- 'YYYY-MM'
  ambiente        text NOT NULL DEFAULT 'homologacion',   -- 'homologacion' | 'produccion'

  -- Datos del comprobante AFIP
  tipo_cbte       int  NOT NULL,                           -- 1=Fac A, 6=Fac B, 11=Fac C
  punto_venta     int  NOT NULL,
  cbte_nro        bigint,                                  -- número asignado por AFIP
  doc_tipo        int  NOT NULL DEFAULT 80,                -- 80=CUIT, 96=DNI, 99=Cons. Final
  doc_nro         text,                                    -- documento del receptor
  concepto        int  NOT NULL DEFAULT 2,                 -- 1=productos, 2=servicios, 3=ambos

  -- Importes
  importe_neto    numeric(14,2) NOT NULL,
  importe_iva     numeric(14,2) NOT NULL DEFAULT 0,
  iva_pct         numeric(5,2)  NOT NULL DEFAULT 21,
  importe_total   numeric(14,2) NOT NULL,
  moneda          text NOT NULL DEFAULT 'PES',
  cotizacion      numeric(14,4) NOT NULL DEFAULT 1,

  -- Resultado AFIP
  cae             text,
  cae_vto         date,
  estado          text NOT NULL DEFAULT 'pendiente',       -- pendiente | emitida | error
  error_msg       text,
  qr_payload      text,                                    -- contenido del QR AFIP (base64 JSON)

  -- Auditoría
  request_json    jsonb,
  response_json   jsonb,
  admin_id        uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  emitida_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_facturas_afip_periodo    ON facturas_afip(periodo);
CREATE INDEX IF NOT EXISTS idx_facturas_afip_perfil     ON facturas_afip(perfil_id);
CREATE INDEX IF NOT EXISTS idx_facturas_afip_estado     ON facturas_afip(estado);
-- Evita doble emisión del mismo comprobante (emisor × corredor × período × ambiente)
CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_afip_emision
  ON facturas_afip(emisor_id, perfil_id, periodo, ambiente)
  WHERE estado = 'emitida';

-- ── Indicadores de configuración AFIP (se editan desde el panel admin) ───────
INSERT INTO indicadores (clave, valor, descripcion) VALUES
  ('afip_habilitado',   0, 'Emisión AFIP activa (0=off, 1=on). Arranca en 0.'),
  ('afip_punto_venta',  1, 'Punto de venta habilitado en AFIP para WSFE.')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO indicadores (clave, valor_texto, descripcion) VALUES
  ('afip_ambiente', 'homologacion', 'Ambiente AFIP: homologacion | produccion. Arranca en homologacion.')
ON CONFLICT (clave) DO NOTHING;

-- ── RLS: solo admin/master ───────────────────────────────────────────────────
ALTER TABLE facturacion_emisores ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas_afip        ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'facturacion_emisores' AND policyname = 'admin_emisores') THEN
    CREATE POLICY admin_emisores ON facturacion_emisores
      USING (EXISTS (SELECT 1 FROM perfiles WHERE perfiles.id = auth.uid() AND perfiles.tipo IN ('admin','master')));
  END IF;

  -- El corredor puede LEER sus propias facturas (para descargarlas del perfil);
  -- escribir solo admin/master.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'facturas_afip' AND policyname = 'admin_facturas_afip') THEN
    CREATE POLICY admin_facturas_afip ON facturas_afip
      FOR ALL
      USING (EXISTS (SELECT 1 FROM perfiles WHERE perfiles.id = auth.uid() AND perfiles.tipo IN ('admin','master')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'facturas_afip' AND policyname = 'corredor_lee_sus_facturas') THEN
    CREATE POLICY corredor_lee_sus_facturas ON facturas_afip
      FOR SELECT
      USING (perfil_id = auth.uid());
  END IF;
END $$;
