-- Finanzas internas del administrador (ingresos y gastos)
create table if not exists admin_finanzas (
  id          uuid        primary key default gen_random_uuid(),
  tipo        text        not null check (tipo in ('ingreso', 'gasto')),
  categoria   text        not null,
  concepto    text        not null,
  monto       numeric     not null check (monto > 0),
  moneda      text        not null default 'ARS',
  fecha       date        not null default current_date,
  referencia  text,
  created_at  timestamptz not null default now()
);

alter table admin_finanzas enable row level security;

create policy "admin_finanzas_solo_admin" on admin_finanzas
  using (
    exists (
      select 1 from perfiles
      where id = auth.uid()
        and tipo = 'admin'
    )
  )
  with check (
    exists (
      select 1 from perfiles
      where id = auth.uid()
        and tipo = 'admin'
    )
  );

comment on table admin_finanzas is 'Registro interno de ingresos y gastos. Solo visible para administradores.';
