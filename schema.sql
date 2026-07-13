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
-- Perfiles
DROP POLICY IF EXISTS "Lectura pública de perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "Administradores gestionan su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Permitir a usuarios gestionar su propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Permitir lectura pública de perfiles" ON public.perfiles;

-- Servicios
DROP POLICY IF EXISTS "Lectura pública de servicios" ON public.servicios;
DROP POLICY IF EXISTS "Administradores gestionan sus servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir SELECT a dueños de servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir INSERT a dueños de servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir UPDATE a dueños de servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir DELETE a dueños de servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir a usuarios gestionar sus propios servicios" ON public.servicios;
DROP POLICY IF EXISTS "Permitir lectura pública de servicios" ON public.servicios;

-- Horarios
DROP POLICY IF EXISTS "Lectura pública de horarios" ON public.horarios;
DROP POLICY IF EXISTS "Administradores gestionan sus horarios" ON public.horarios;
DROP POLICY IF EXISTS "Permitir a usuarios gestionar sus propios horarios" ON public.horarios;
DROP POLICY IF EXISTS "Permitir lectura pública de horarios" ON public.horarios;

-- Reservas
DROP POLICY IF EXISTS "Clientes públicos pueden insertar reservas" ON public.reservas;
DROP POLICY IF EXISTS "Administradores gestionan sus reservas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir inserciones públicas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir lectura pública" ON public.reservas;

-- =======================================================
-- 3. CREACIÓN DE NUEVAS POLÍTICAS DE SEGURIDAD
-- =======================================================

-- -------------------------------------------------------
-- 3.1 Políticas para la tabla "perfiles"
-- -------------------------------------------------------
-- Permite que los clientes (públicos y anónimos) resuelvan los nombres comerciales usando el slug.
CREATE POLICY "Permitir lectura pública de perfiles"
  ON public.perfiles FOR SELECT
  USING (true);

-- Permite a los usuarios autenticados gestionar completamente su perfil.
CREATE POLICY "Dueños gestionan su propio perfil"
  ON public.perfiles FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------
-- 3.2 Políticas para la tabla "servicios"
-- -------------------------------------------------------
-- Permite que los clientes públicos vean el catálogo de servicios de un negocio al reservar.
CREATE POLICY "Permitir lectura pública de servicios"
  ON public.servicios FOR SELECT
  USING (true);

-- Permite a los usuarios autenticados gestionar sus propios servicios del catálogo.
CREATE POLICY "Dueños gestionan sus propios servicios"
  ON public.servicios FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------
-- 3.3 Políticas para la tabla "horarios"
-- -------------------------------------------------------
-- Permite que los clientes públicos lean los horarios de atención al reservar.
CREATE POLICY "Permitir lectura pública de horarios"
  ON public.horarios FOR SELECT
  USING (true);

-- Permite a los usuarios autenticados gestionar sus rangos horarios semanales.
CREATE POLICY "Dueños gestionan sus propios horarios"
  ON public.horarios FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

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
