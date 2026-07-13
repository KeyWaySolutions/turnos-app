-- ==========================================
-- SCRIPT DE BASE DE DATOS - TURNOSYA SaaS
-- ==========================================
-- Este script inicializa las tablas, restricciones, índices, RLS y
-- políticas de seguridad requeridas para soportar el portal de reservas
-- y el dashboard de configuración multi-tenant.
--
-- Ejecuta este script completo en el SQL Editor de tu consola de Supabase.

-- ==========================================
-- 1. LIMPIEZA DE TABLAS PREVIAS (OPCIONAL)
-- ==========================================
-- drop table if exists public.reservas cascade;
-- drop table if exists public.horarios cascade;
-- drop table if exists public.servicios cascade;
-- drop table if exists public.perfiles cascade;

-- ==========================================
-- 2. CREACIÓN DE TABLAS
-- ==========================================

-- 2.1 Tabla de Perfiles de Negocio (Tenants)
create table public.perfiles (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  nombre text not null,
  slug text not null,
  
  -- Restricciones de unicidad
  constraint perfiles_user_id_key unique (user_id),
  constraint perfiles_slug_key unique (slug),
  constraint perfiles_nombre_check check (char_length(nombre) >= 2),
  constraint perfiles_slug_check check (char_length(slug) >= 2)
);

-- 2.2 Tabla de Servicios del Catálogo
create table public.servicios (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  nombre text not null,
  duracion integer not null, -- duración del servicio en minutos
  
  -- Restricciones y validaciones
  constraint servicios_nombre_check check (char_length(nombre) >= 2),
  constraint servicios_duracion_check check (duracion > 0 and duracion <= 480)
);

-- 2.3 Tabla de Horarios de Atención Semanales
create table public.horarios (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  dia integer not null, -- 0 (Lunes) a 6 (Domingo)
  activo boolean default true not null,
  hora_inicio text default '09:00' not null,
  hora_fin text default '18:00' not null,
  
  -- Asegura un único registro de horario por día para cada negocio
  constraint horarios_user_id_dia_key unique (user_id, dia),
  constraint horarios_dia_check check (dia >= 0 and dia <= 6),
  constraint horarios_hora_inicio_check check (hora_inicio ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'),
  constraint horarios_hora_fin_check check (hora_fin ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$')
);

-- 2.4 Tabla de Reservas de Clientes
create table public.reservas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  business_id uuid references auth.users(id) on delete cascade not null, -- dueño del negocio
  nombre text not null,
  email text not null,
  telefono text not null,
  fecha date not null,
  hora text not null,
  servicio text not null,
  
  -- Validaciones básicas
  constraint reservas_nombre_check check (char_length(nombre) >= 2),
  constraint reservas_email_check check (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'),
  constraint reservas_hora_check check (hora ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$')
);

-- ==========================================
-- 3. CREACIÓN DE ÍNDICES DE RENDIMIENTO
-- ==========================================
create index idx_perfiles_slug on public.perfiles(slug);
create index idx_servicios_user_id on public.servicios(user_id);
create index idx_horarios_user_id on public.horarios(user_id);
create index idx_reservas_business_id on public.reservas(business_id);
create index idx_reservas_fecha_hora on public.reservas(fecha, hora);

-- ==========================================
-- 4. CONFIGURACIÓN DE SEGURIDAD (RLS)
-- ==========================================

-- Habilitar RLS en todas las tablas
alter table public.perfiles enable row level security;
alter table public.servicios enable row level security;
alter table public.horarios enable row level security;
alter table public.reservas enable row level security;

-- 4.1 Políticas para la tabla "perfiles"
-- Permite lectura pública para que el portal de reservas cargue el negocio por su slug.
create policy "Lectura pública de perfiles"
  on public.perfiles for select
  using (true);

-- El administrador autenticado gestiona su propio perfil.
create policy "Administradores gestionan su propio perfil"
  on public.perfiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4.2 Políticas para la tabla "servicios"
-- Permite SELECT a dueños de servicios autenticados
create policy "Permitir SELECT a dueños de servicios"
  on public.servicios for select
  to authenticated
  using (auth.uid() = user_id);

-- Permite INSERT a dueños de servicios autenticados
create policy "Permitir INSERT a dueños de servicios"
  on public.servicios for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Permite UPDATE a dueños de servicios autenticados
create policy "Permitir UPDATE a dueños de servicios"
  on public.servicios for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Permite DELETE a dueños de servicios autenticados
create policy "Permitir DELETE a dueños de servicios"
  on public.servicios for delete
  to authenticated
  using (auth.uid() = user_id);

-- 4.3 Políticas para la tabla "horarios"
-- Permite lectura pública para que los clientes vean los horarios configurados del comercio.
create policy "Lectura pública de horarios"
  on public.horarios for select
  using (true);

-- El administrador autenticado gestiona sus días y rangos horarios.
create policy "Administradores gestionan sus horarios"
  on public.horarios for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4.4 Políticas para la tabla "reservas"
-- Permite que los clientes de internet inserten un turno libremente.
create policy "Clientes públicos pueden insertar reservas"
  on public.reservas for insert
  with check (true);

-- Solo el dueño del negocio puede leer, modificar o cancelar las reservas de su local.
create policy "Administradores gestionan sus reservas"
  on public.reservas for all
  using (auth.uid() = business_id)
  with check (auth.uid() = business_id);
