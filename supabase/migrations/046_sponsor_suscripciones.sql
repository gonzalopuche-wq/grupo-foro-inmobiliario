-- Suscripciones mensuales de sponsors
-- Modelo: sponsors pagan una cuota mensual fija (configurable por proveedor)
-- + se cobra por adhesiones de corredores (referidos/clientes posibles) en campañas
SET search_path TO public;

-- ── Nuevas columnas en red_proveedores ────────────────────────────────────────
ALTER TABLE red_proveedores
  ADD COLUMN IF NOT EXISTS suscripcion_activa  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_mensual_usd    numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS suscripcion_vence   date;

-- ── Tabla de suscripciones mensuales ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsor_suscripciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid NOT NULL REFERENCES red_proveedores(id) ON DELETE CASCADE,
  mes          text NOT NULL,          -- formato YYYY-MM
  monto_usd    numeric NOT NULL CHECK (monto_usd > 0),
  pagada       boolean NOT NULL DEFAULT false,
  fecha_pago   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proveedor_id, mes)
);

-- ── Ampliar tipos de movimientos ──────────────────────────────────────────────
ALTER TABLE sponsor_movimientos
  DROP CONSTRAINT IF EXISTS sponsor_movimientos_tipo_check;
ALTER TABLE sponsor_movimientos
  ADD CONSTRAINT sponsor_movimientos_tipo_check
  CHECK (tipo IN ('recarga','debito_adhesion','ajuste','debito_suscripcion'));

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_suscripciones_proveedor ON sponsor_suscripciones(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_mes       ON sponsor_suscripciones(mes);

-- ── Función atómica de cobro de mensualidad ──────────────────────────────────
-- Ejecuta el débito dentro de una sola transacción con bloqueo de filas
-- para prevenir cobros duplicados concurrentes (P1 atomicity fix).
CREATE OR REPLACE FUNCTION cobrar_suscripcion_sponsor(
  p_proveedor_id uuid,
  p_mes          text   -- formato YYYY-MM
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_monto        numeric;
  v_saldo_actual numeric;
  v_nuevo_saldo  numeric;
  v_vence        date;
  v_year         int;
  v_month        int;
BEGIN
  -- Bloquear fila del proveedor para serializar cobros concurrentes
  SELECT plan_mensual_usd INTO v_monto
  FROM red_proveedores
  WHERE id = p_proveedor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Proveedor no encontrado');
  END IF;

  -- Verificar que no se haya cobrado ya este mes
  IF EXISTS (
    SELECT 1 FROM sponsor_suscripciones
    WHERE proveedor_id = p_proveedor_id AND mes = p_mes AND pagada = true
  ) THEN
    RETURN jsonb_build_object('error', format('Ya se cobró la suscripción de %s', p_mes));
  END IF;

  -- Obtener y bloquear saldo
  SELECT saldo_usd INTO v_saldo_actual
  FROM sponsor_saldo
  WHERE proveedor_id = p_proveedor_id
  FOR UPDATE;

  v_saldo_actual := COALESCE(v_saldo_actual, 0);

  IF v_saldo_actual < v_monto THEN
    RETURN jsonb_build_object(
      'error',
      format('Saldo insuficiente. Disponible: $%s, requerido: $%s',
             round(v_saldo_actual, 2), round(v_monto, 2))
    );
  END IF;

  -- Calcular fecha de vencimiento (1º del mes siguiente, sin offset de TZ)
  v_year  := split_part(p_mes, '-', 1)::int;
  v_month := split_part(p_mes, '-', 2)::int;
  v_vence := make_date(v_year, v_month, 1) + interval '1 month';

  v_nuevo_saldo := v_saldo_actual - v_monto;

  -- Descontar saldo
  INSERT INTO sponsor_saldo (proveedor_id, saldo_usd, updated_at)
  VALUES (p_proveedor_id, v_nuevo_saldo, now())
  ON CONFLICT (proveedor_id)
  DO UPDATE SET saldo_usd = v_nuevo_saldo, updated_at = now();

  -- Registrar movimiento
  INSERT INTO sponsor_movimientos (proveedor_id, tipo, monto_usd, descripcion)
  VALUES (p_proveedor_id, 'debito_suscripcion', -v_monto,
          format('Suscripción mensual %s', p_mes));

  -- Registrar suscripción
  INSERT INTO sponsor_suscripciones (proveedor_id, mes, monto_usd, pagada, fecha_pago)
  VALUES (p_proveedor_id, p_mes, v_monto, true, now())
  ON CONFLICT (proveedor_id, mes)
  DO UPDATE SET pagada = true, fecha_pago = now(), monto_usd = v_monto;

  -- Actualizar estado del proveedor
  UPDATE red_proveedores
  SET suscripcion_activa = true, suscripcion_vence = v_vence
  WHERE id = p_proveedor_id;

  RETURN jsonb_build_object('ok', true, 'saldo_nuevo', v_nuevo_saldo, 'vence', v_vence::text);
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE sponsor_suscripciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suscripciones_select" ON sponsor_suscripciones;
CREATE POLICY "suscripciones_select" ON sponsor_suscripciones FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM red_proveedores WHERE id = proveedor_id AND portal_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin')
  );

DROP POLICY IF EXISTS "suscripciones_admin_all" ON sponsor_suscripciones;
CREATE POLICY "suscripciones_admin_all" ON sponsor_suscripciones FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND tipo = 'admin'));
