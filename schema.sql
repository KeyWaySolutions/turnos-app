-- =======================================================
-- SCRIPT DE CONFIGURACIÓN DE SEGURIDAD (RLS) - TURNOSYA SaaS
-- =======================================================
-- Este script configura la seguridad a nivel de fila (Row Level Security)
-- y los permisos de acceso para las tablas existentes: perfiles, servicios,
-- horarios y reservas.
--
-- Ejecuta este script completo en el SQL Editor de tu consola de Supabase.

-- =======================================================
-- 1. HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
-- =======================================================
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- =======================================================
-- 2. LIMPIEZA DE POLÍTICAS ANTERIORES
-- =======================================================
-- Tabla perfiles
DROP POLICY IF EXISTS "Lectura pública de perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "Administradores gestionan su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Permitir a usuarios gestionar su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Permitir lectura pública de perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "Dueños gestionan su propio perfil (Escritura)" ON public.perfiles;
DROP POLICY IF EXISTS "Dueños gestionan su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Permitir SELECT a dueños sobre su perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Permitir INSERT a dueños sobre su perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Permitir UPDATE a dueños sobre su perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Permitir DELETE a dueños sobre su perfil" ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_select_policy" ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_insert_policy" ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_update_policy" ON public.perfiles;
DROP POLICY IF EXISTS "perfiles_delete_policy" ON public.perfiles;

-- Tabla servicios
DROP POLICY IF EXISTS "Lectura pública de servicios" ON public.servicios;
DROP POLICY IF EXISTS "Administradores gestionan sus servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir SELECT a dueños de servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir INSERT a dueños de servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir UPDATE a dueños de servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir DELETE a dueños de servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir a usuarios gestionar sus propios servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir lectura pública de servicios" ON public.servicios;
DROP POLICY IF EXISTS "Dueños gestionan sus propios servicios (Escritura)" ON public.servicios;
DROP POLICY IF EXISTS "Dueños gestionan sus propios servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir SELECT a dueños sobre sus servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir INSERT a dueños sobre sus servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir UPDATE a dueños sobre sus servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir DELETE a dueños sobre sus servicios" ON public.servicios;
DROP POLICY IF EXISTS "servicios_select_policy" ON public.servicios;
DROP POLICY IF EXISTS "servicios_insert_policy" ON public.servicios;
DROP POLICY IF EXISTS "servicios_update_policy" ON public.servicios;
DROP POLICY IF EXISTS "servicios_delete_policy" ON public.servicios;

-- Tabla horarios
DROP POLICY IF EXISTS "Lectura pública de horarios" ON public.horarios;
DROP POLICY IF EXISTS "Administradores gestionan sus horarios" ON public.horarios;
DROP POLICY IF EXISTS "Permitir a usuarios gestionar sus propios horarios" ON public.horarios;
DROP POLICY IF EXISTS "Permitir lectura pública de horarios" ON public.horarios;
DROP POLICY IF EXISTS "Dueños gestionan sus propios horarios (Escritura)" ON public.horarios;
DROP POLICY IF EXISTS "Dueños gestionan sus propios horarios" ON public.horarios;
DROP POLICY IF EXISTS "Permitir SELECT a dueños sobre sus horarios" ON public.horarios;
DROP POLICY IF EXISTS "Permitir INSERT a dueños sobre sus horarios" ON public.horarios;
DROP POLICY IF EXISTS "Permitir UPDATE a dueños sobre sus horarios" ON public.horarios;
DROP POLICY IF EXISTS "Permitir DELETE a dueños sobre sus horarios" ON public.horarios;
DROP POLICY IF EXISTS "horarios_select_policy" ON public.horarios;
DROP POLICY IF EXISTS "horarios_insert_policy" ON public.horarios;
DROP POLICY IF EXISTS "horarios_update_policy" ON public.horarios;
DROP POLICY IF EXISTS "horarios_delete_policy" ON public.horarios;

-- Tabla reservas
DROP POLICY IF EXISTS "Clientes públicos pueden insertar reservas" ON public.reservas;
DROP POLICY IF EXISTS "Administradores gestionan sus reservas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir inserciones públicas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir lectura pública" ON public.reservas;
DROP POLICY IF EXISTS "Permitir inserciones públicas de reservas" ON public.reservas;
DROP POLICY IF EXISTS "Dueños gestionan las reservas de su negocio" ON public.reservas;

-- =======================================================
-- 3. CREACIÓN DE NUEVAS POLÍTICAS DE SEGURIDAD EXPLÍCITAS
-- =======================================================

-- -------------------------------------------------------
-- 3.1 Políticas para la tabla "perfiles"
-- -------------------------------------------------------
CREATE POLICY "perfiles_select_policy" ON public.perfiles
  FOR SELECT USING (true);

CREATE POLICY "perfiles_insert_policy" ON public.perfiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "perfiles_update_policy" ON public.perfiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "perfiles_delete_policy" ON public.perfiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- -------------------------------------------------------
-- 3.2 Políticas para la tabla "servicios"
-- -------------------------------------------------------
CREATE POLICY "servicios_select_policy" ON public.servicios
  FOR SELECT USING (true);

CREATE POLICY "servicios_insert_policy" ON public.servicios
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "servicios_update_policy" ON public.servicios
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "servicios_delete_policy" ON public.servicios
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- -------------------------------------------------------
-- 3.3 Políticas para la tabla "horarios"
-- -------------------------------------------------------
CREATE POLICY "horarios_select_policy" ON public.horarios
  FOR SELECT USING (true);

CREATE POLICY "horarios_insert_policy" ON public.horarios
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "horarios_update_policy" ON public.horarios
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "horarios_delete_policy" ON public.horarios
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- -------------------------------------------------------
-- 3.4 Políticas para la tabla "reservas"
-- -------------------------------------------------------
-- Permite a cualquier cliente (público / anónimo) insertar nuevas reservas vinculadas al negocio.
CREATE POLICY "Permitir inserciones públicas de reservas"
  ON public.reservas FOR INSERT
  WITH CHECK (true);

-- Permite a los usuarios autenticados gestionar y leer las reservas vinculadas a su negocio.
CREATE POLICY "Dueños gestionan las reservas de su negocio"
  ON public.reservas FOR ALL
  TO authenticated
  USING (auth.uid() = business_id)
  WITH CHECK (auth.uid() = business_id);
