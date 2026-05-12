-- Ampliar el check constraint de operacion en mir_ofrecidos y mir_busquedas
-- para incluir los tipos nuevos: comercial, fondo_comercio, campo, temporario, vehiculo

ALTER TABLE mir_ofrecidos
  DROP CONSTRAINT IF EXISTS mir_ofrecidos_operacion_check;

ALTER TABLE mir_ofrecidos
  ADD CONSTRAINT mir_ofrecidos_operacion_check
  CHECK (operacion IN (
    'venta', 'alquiler', 'alquiler_temporario', 'temporario',
    'permuta', 'campo', 'comercial', 'fondo_comercio', 'vehiculo'
  ));

ALTER TABLE mir_busquedas
  DROP CONSTRAINT IF EXISTS mir_busquedas_operacion_check;

ALTER TABLE mir_busquedas
  ADD CONSTRAINT mir_busquedas_operacion_check
  CHECK (operacion IN (
    'compra', 'alquiler', 'alquiler_temporario', 'temporario',
    'permuta', 'campo', 'comercial', 'fondo_comercio', 'vehiculo'
  ));
