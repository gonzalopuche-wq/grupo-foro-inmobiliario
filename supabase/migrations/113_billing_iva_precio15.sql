-- Migración 113: Actualización modelo de facturación
-- precio_corredor_usd $10 → $15, agrega IVA 21%, tabla facturas_emitidas

-- ── Actualizar precio corredor ────────────────────────────────────────────────
UPDATE indicadores SET valor = 15 WHERE clave = 'precio_corredor_usd';

-- Insertar si no existía
INSERT INTO indicadores (clave, valor, descripcion)
SELECT 'precio_corredor_usd', 15, 'Precio membresía corredor matriculado (USD/mes)'
WHERE NOT EXISTS (SELECT 1 FROM indicadores WHERE clave = 'precio_corredor_usd');

-- Asegurar precio colaborador = 5
INSERT INTO indicadores (clave, valor, descripcion)
VALUES ('precio_colaborador_usd', 5, 'Precio adicional por colaborador vinculado al matriculado (USD/mes)')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;

-- IVA configurado como indicador (21% responsable inscripto)
INSERT INTO indicadores (clave, valor, descripcion)
VALUES ('iva_pct', 21, 'IVA aplicado sobre cuotas — responsable inscripto')
ON CONFLICT (clave) DO NOTHING;

-- ── Tabla de facturas emitidas (liquidaciones mensuales) ──────────────────────
CREATE TABLE IF NOT EXISTS facturas_emitidas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo         text NOT NULL,              -- "2026-05"
  tipo            text NOT NULL DEFAULT 'mensual',
  total_corredores int NOT NULL DEFAULT 0,
  total_colaboradores int NOT NULL DEFAULT 0,
  precio_corredor_usd numeric(10,2) NOT NULL,
  precio_colaborador_usd numeric(10,2) NOT NULL,
  subtotal_usd    numeric(12,2) NOT NULL,
  dolar_ref       numeric(10,2),
  subtotal_ars    numeric(14,2),
  iva_pct         numeric(5,2) NOT NULL DEFAULT 21,
  iva_ars         numeric(14,2),
  total_ars       numeric(14,2),
  numero_factura  text,                       -- Nro AFIP si se emite
  observaciones   text,
  admin_id        uuid REFERENCES auth.users(id),
  creado_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE facturas_emitidas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'facturas_emitidas' AND policyname = 'admin_facturas'
  ) THEN
    CREATE POLICY admin_facturas ON facturas_emitidas
      USING (
        EXISTS (
          SELECT 1 FROM perfiles
          WHERE perfiles.id = auth.uid()
            AND perfiles.tipo IN ('admin', 'master')
        )
      );
  END IF;
END $$;

-- ── Índice para búsqueda por período ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_facturas_emitidas_periodo ON facturas_emitidas(periodo);
