-- Tabla para configuración global del sitio editable por el admin
create table if not exists configuracion_sitio (
  clave           text primary key,
  valor           text,
  tipo            text not null default 'text', -- text | number | textarea | color | url | email | boolean
  label           text not null,
  categoria       text not null default 'general',
  descripcion     text,
  actualizado_at  timestamptz default now()
);

alter table configuracion_sitio enable row level security;

drop policy if exists cs_admin on configuracion_sitio;
create policy cs_admin on configuracion_sitio
  for all using (exists (select 1 from perfiles where id = auth.uid() and tipo = 'admin'));

drop policy if exists cs_read on configuracion_sitio;
create policy cs_read on configuracion_sitio
  for select using (true);

insert into configuracion_sitio (clave, valor, tipo, label, categoria, descripcion) values
  ('anuncio_banner', '', 'textarea', 'Texto del banner global', 'anuncios',
    'Mensaje visible para todos los usuarios en un banner al entrar. Vacío = sin banner.'),
  ('anuncio_color', '#cc0000', 'color', 'Color del banner', 'anuncios',
    'Color de fondo del banner de anuncio.'),
  ('jus_url_cocir', 'https://www.justiciasantafe.gov.ar/index.php/unidad_jus/unidad-jus-ley-12851/', 'url', 'URL del JUS', 'jus',
    'Dirección de la página donde figura el valor del JUS. Requerida para sincronización automática.'),
  ('honorarios_venta_propietario_pct', '3', 'number', 'Honorarios venta — propietario (%)', 'honorarios',
    'Porcentaje sugerido de honorarios al propietario en operaciones de venta.'),
  ('honorarios_venta_comprador_pct', '3', 'number', 'Honorarios venta — comprador (%)', 'honorarios',
    'Porcentaje sugerido de honorarios al comprador en operaciones de venta.'),
  ('honorarios_alquiler_meses', '1', 'number', 'Honorarios alquiler (meses)', 'honorarios',
    'Cantidad de meses sugerida para honorarios de alquiler.'),
  ('soporte_whatsapp', '', 'text', 'WhatsApp de soporte', 'contacto',
    'Número sin + para soporte (ej: 5493413001234).'),
  ('soporte_email', '', 'email', 'Email de soporte', 'contacto',
    'Email de contacto para soporte técnico.')
on conflict (clave) do nothing;
