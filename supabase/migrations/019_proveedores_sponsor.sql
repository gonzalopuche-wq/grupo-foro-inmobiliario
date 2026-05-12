-- Suscripción de proveedores sponsor
ALTER TABLE red_proveedores ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'comunidad';
ALTER TABLE red_proveedores ADD COLUMN IF NOT EXISTS suscripcion_estado text;
ALTER TABLE red_proveedores ADD COLUMN IF NOT EXISTS suscripcion_vencimiento date;
ALTER TABLE red_proveedores ADD COLUMN IF NOT EXISTS monto_mensual_usd integer DEFAULT 0;
ALTER TABLE red_proveedores ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE red_proveedores ADD COLUMN IF NOT EXISTS sitio_web text;
ALTER TABLE red_proveedores ADD COLUMN IF NOT EXISTS descripcion text;
ALTER TABLE red_proveedores ADD COLUMN IF NOT EXISTS destacado boolean NOT NULL DEFAULT false;
ALTER TABLE red_proveedores ADD COLUMN IF NOT EXISTS nota_admin text;

CREATE INDEX IF NOT EXISTS idx_red_proveedores_tipo ON red_proveedores(tipo);
CREATE INDEX IF NOT EXISTS idx_red_proveedores_suscripcion ON red_proveedores(suscripcion_estado);
CREATE INDEX IF NOT EXISTS idx_red_proveedores_destacado ON red_proveedores(destacado);
