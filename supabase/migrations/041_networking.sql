-- Networking Inmobiliario: rueda de negocios interna entre colegas
create table if not exists networking_posts (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references perfiles(id) on delete cascade,
  titulo            text        not null,
  descripcion       text        not null,
  tipo              text        not null default 'oportunidad'
                                check (tipo in ('oportunidad','urgencia','necesidad','otro')),
  precio            numeric,
  moneda            text        not null default 'USD',
  ubicacion         text,
  caracteristicas   text,
  fotos             text[],
  estado            text        not null default 'activo'
                                check (estado in ('activo','pausado','cerrado')),
  contacto_visible  boolean     not null default true,
  created_at        timestamptz not null default now(),
  actualizado_at    timestamptz not null default now()
);

alter table networking_posts enable row level security;

-- Leer: cualquier corredor/admin ve posts activos
create policy "net_read" on networking_posts
  for select using (
    (estado = 'activo' or user_id = auth.uid())
    and exists (
      select 1 from perfiles
      where id = auth.uid()
        and tipo in ('corredor','admin')
    )
  );

-- Insertar: solo corredores y admins
create policy "net_insert" on networking_posts
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from perfiles
      where id = auth.uid()
        and tipo in ('corredor','admin')
    )
  );

-- Actualizar y eliminar: solo el autor o admin
create policy "net_update" on networking_posts
  for update using (
    user_id = auth.uid()
    or exists (select 1 from perfiles where id = auth.uid() and tipo = 'admin')
  );

create policy "net_delete" on networking_posts
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from perfiles where id = auth.uid() and tipo = 'admin')
  );

comment on table networking_posts is 'Rueda de negocios interna: oportunidades, urgencias y necesidades de compra/venta entre colegas.';
