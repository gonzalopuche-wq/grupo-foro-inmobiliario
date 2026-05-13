-- Renombrar columnas de imágenes para alinear con el código del frontend
alter table crm_propiedades_guardadas rename column fotos to imagenes;
alter table crm_propiedades_guardadas rename column foto_url to imagen_principal;

-- Agregar FK constraints para que PostgREST resuelva las relaciones embebidas
alter table crm_listas_busqueda
  add constraint fk_clb_corredor foreign key (corredor_id) references perfiles(id) on delete cascade;
alter table crm_listas_busqueda
  add constraint fk_clb_contacto foreign key (contacto_id) references crm_contactos(id) on delete set null;

-- Corregir política RLS de suscripcion_beneficios (sb_all era demasiado permisiva)
drop policy if exists sb_all on suscripcion_beneficios;
create policy sb_admin on suscripcion_beneficios
  for all using (exists (select 1 from perfiles where id = auth.uid() and tipo = 'admin'));
create policy sb_corredor on suscripcion_beneficios
  for select using (perfil_id = auth.uid());
