-- Autorizaciones de venta / mandatos (MOD 106)
create table if not exists autorizaciones_venta (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references perfiles(id) on delete cascade,
  propiedad_id        uuid references cartera_propiedades(id) on delete set null,
  propietario_nombre  text not null,
  propietario_telefono text,
  propietario_email   text,
  direccion           text not null,
  tipo_operacion      text not null default 'venta'
                        check (tipo_operacion in ('venta','alquiler','venta_alquiler')),
  fecha_inicio        date not null default current_date,
  fecha_vencimiento   date not null,
  honorarios_pct      numeric(5,2),
  precio_referencia   numeric,
  moneda              text not null default 'USD'
                        check (moneda in ('USD','ARS','EUR')),
  observaciones       text,
  estado              text not null default 'vigente'
                        check (estado in ('vigente','vencida','renovada','cancelada')),
  notif_30_enviada    boolean not null default false,
  notif_15_enviada    boolean not null default false,
  notif_7_enviada     boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table autorizaciones_venta enable row level security;

create policy "autorizaciones_select" on autorizaciones_venta for select
  using (
    auth.uid() = user_id
    or exists (select 1 from perfiles where id = auth.uid() and tipo = 'admin')
  );

create policy "autorizaciones_insert" on autorizaciones_venta for insert
  with check (auth.uid() = user_id);

create policy "autorizaciones_update" on autorizaciones_venta for update
  using (
    auth.uid() = user_id
    or exists (select 1 from perfiles where id = auth.uid() and tipo = 'admin')
  );

create policy "autorizaciones_delete" on autorizaciones_venta for delete
  using (auth.uid() = user_id);

-- Marcar como vencidas las que pasaron la fecha
create or replace function marcar_autorizaciones_vencidas()
returns void language sql as $$
  update autorizaciones_venta
  set estado = 'vencida', updated_at = now()
  where estado = 'vigente' and fecha_vencimiento < current_date;
$$;
