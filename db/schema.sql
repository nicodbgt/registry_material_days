-- ============================================================
--  CAIZÉN MENSUAL — Schema Supabase
--  Ejecutar en: Supabase > SQL Editor > New query
-- ============================================================

-- 1. MODELOS DE CAÑOS
--    Cada caño tiene un código único, pertenece a un material
--    y tiene un peso por unidad en kg.
-- ------------------------------------------------------------
create table if not exists modelos (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,          -- '23H01908'
  material    text not null                  -- '3052K' | '3053F' | '3053E'
                check (material in ('3052K','3053F','3053E')),
  peso_unit   numeric(10,4) not null         -- kg por unidad
                check (peso_unit > 0),
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- índice para búsquedas por material
create index if not exists idx_modelos_material on modelos(material);

-- 2. DÍAS DE PRODUCCIÓN
--    Cabecera: un registro por día de trabajo.
-- ------------------------------------------------------------
create table if not exists dias_produccion (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null unique,          -- '2025-06-14'
  created_at  timestamptz not null default now()
);

-- índice para filtrar por mes
create index if not exists idx_dias_fecha on dias_produccion(fecha);

-- 3. LÍNEAS DE PRODUCCIÓN
--    Detalle: cuántas unidades de cada modelo se hicieron ese día.
-- ------------------------------------------------------------
create table if not exists lineas_produccion (
  id           uuid primary key default gen_random_uuid(),
  dia_id       uuid not null references dias_produccion(id) on delete cascade,
  modelo_id    uuid not null references modelos(id) on delete restrict,
  cantidad     integer not null check (cantidad > 0),
  -- campos desnormalizados para queries rápidas sin joins
  codigo       text not null,
  material     text not null,
  peso_unit    numeric(10,4) not null,
  peso_total   numeric(14,4) generated always as (cantidad * peso_unit) stored,
  created_at   timestamptz not null default now(),
  unique(dia_id, modelo_id)
);

create index if not exists idx_lineas_dia   on lineas_produccion(dia_id);
create index if not exists idx_lineas_fecha on lineas_produccion(material);

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
--  Para una app de un solo usuario o equipo sin auth compleja
--  se puede deshabilitar RLS y usar solo la anon key.
--  Descomentá las líneas de abajo si querés acceso público
--  controlado solo por la API key (opción más simple para
--  uso interno en fábrica).
-- ============================================================

alter table modelos           enable row level security;
alter table dias_produccion   enable row level security;
alter table lineas_produccion enable row level security;

-- Política: acceso total desde la anon key (uso interno)
create policy "public_all_modelos"
  on modelos for all using (true) with check (true);

create policy "public_all_dias"
  on dias_produccion for all using (true) with check (true);

create policy "public_all_lineas"
  on lineas_produccion for all using (true) with check (true);
