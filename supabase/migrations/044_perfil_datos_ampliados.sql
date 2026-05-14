-- Ampliación de datos del perfil del corredor inmobiliario
-- Nuevas redes sociales, datos profesionales y presencia digital

alter table perfiles
  add column if not exists tiktok text,
  add column if not exists youtube text,
  add column if not exists whatsapp_negocio text,
  add column if not exists telegram text,
  add column if not exists portal_propio text,
  add column if not exists asociaciones text,
  add column if not exists certificaciones text,
  add column if not exists idiomas text[],
  add column if not exists descripcion_inmobiliaria text,
  add column if not exists horario_atencion text,
  add column if not exists cant_empleados integer;
