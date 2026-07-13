"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const WEEK_DAYS = [
  { index: 0, name: "Lunes" },
  { index: 1, name: "Martes" },
  { index: 2, name: "Miércoles" },
  { index: 3, name: "Jueves" },
  { index: 4, name: "Viernes" },
  { index: 5, name: "Sábado" },
  { index: 6, name: "Domingo" }
];

export default function DashboardPage() {
  const router = useRouter();

  // Authentication & General states
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('perfil'); // 'perfil', 'servicios', 'horarios'
  const [dbWarning, setDbWarning] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ type: '', text: '' });

  // 1. Business Profile states
  const [businessName, setBusinessName] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [savedSlug, setSavedSlug] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // 2. Services states
  const [servicesList, setServicesList] = useState([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState(30);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editingServiceName, setEditingServiceName] = useState("");
  const [editingServiceDuration, setEditingServiceDuration] = useState(30);
  const [savingService, setSavingService] = useState(false);

  // 3. Schedule states
  const [scheduleList, setScheduleList] = useState(
    WEEK_DAYS.map(day => ({
      dia: day.index,
      activo: day.index < 5, // active Monday-Friday by default
      hora_inicio: "09:00",
      hora_fin: "18:00"
    }))
  );
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Check auth session and fetch user settings on mount
  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      setUser(session.user);
      
      // Load settings
      await Promise.all([
        loadProfile(session.user),
        loadServices(session.user),
        loadSchedule(session.user)
      ]);
      
      setLoading(false);
    };

    checkAuthAndLoadData();
  }, [router]);

  // Generate slug dynamically from name
  useEffect(() => {
    if (businessName) {
      const generated = businessName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with hyphen
        .replace(/(^-|-$)+/g, ""); // trim leading/trailing hyphens
      setBusinessSlug(generated);
    } else {
      setBusinessSlug("");
    }
  }, [businessName]);

  // Alert handler
  const triggerAlert = (type, text) => {
    setAlertMessage({ type, text });
    setTimeout(() => {
      setAlertMessage({ type: '', text: '' });
    }, 5000);
  };

  // --- Database Fetchers ---

  const loadProfile = async (currentUser) => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('relation "public.perfiles" does not exist')) {
          setDbWarning(true);
        } else {
          throw error;
        }
      }

      if (data) {
        setBusinessName(data.nombre);
        setSavedSlug(data.slug);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  };

  const loadServices = async (currentUser) => {
    try {
      const { data, error } = await supabase
        .from('servicios')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('relation "public.servicios" does not exist')) {
          setDbWarning(true);
          // Fallback static mock data for demo
          setServicesList([
            { id: "mock-1", nombre: "Consulta General", duracion: 30 },
            { id: "mock-2", nombre: "Tratamiento Premium", duracion: 60 }
          ]);
        } else {
          throw error;
        }
      } else if (data) {
        setServicesList(data);
      }
    } catch (err) {
      console.error("Error loading services:", err);
    }
  };

  const loadSchedule = async (currentUser) => {
    try {
      const { data, error } = await supabase
        .from('horarios')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('dia', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('relation "public.horarios" does not exist')) {
          setDbWarning(true);
        } else {
          throw error;
        }
      } else if (data && data.length > 0) {
        setScheduleList(data);
      }
    } catch (err) {
      console.error("Error loading schedule:", err);
    }
  };

  // --- Database Operations ---

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Save profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!businessName.trim()) {
      triggerAlert('error', 'El nombre del negocio no puede estar vacío.');
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('perfiles')
        .upsert(
          { user_id: user.id, nombre: businessName.trim(), slug: businessSlug },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
      setSavedSlug(businessSlug);
      triggerAlert('success', '¡Perfil de negocio guardado con éxito!');
    } catch (err) {
      console.error("Error saving profile:", err);
      triggerAlert('error', err.message || 'Error al guardar el perfil. Revisa si la base de datos está creada.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Add Service
  const handleAddService = async (e) => {
    e.preventDefault();
    if (!newServiceName.trim()) {
      triggerAlert('error', 'El nombre del servicio no puede estar vacío.');
      return;
    }
    setSavingService(true);
    try {
      if (dbWarning) {
        // Mock fallback for UI testing without database
        const mockNew = { id: `mock-${Date.now()}`, nombre: newServiceName.trim(), duracion: parseInt(newServiceDuration) };
        setServicesList(prev => [...prev, mockNew]);
        setNewServiceName("");
        triggerAlert('success', 'Servicio agregado localmente (Modo Demo).');
      } else {
        const { data, error } = await supabase
          .from('servicios')
          .insert([{ user_id: user.id, nombre: newServiceName.trim(), duracion: parseInt(newServiceDuration) }])
          .select();

        if (error) throw error;
        if (data) {
          setServicesList(prev => [...prev, ...data]);
          setNewServiceName("");
          triggerAlert('success', '¡Servicio agregado con éxito!');
        }
      }
    } catch (err) {
      console.error("Error adding service:", err);
      triggerAlert('error', err.message || 'Error al agregar servicio.');
    } finally {
      setSavingService(false);
    }
  };

  // Edit Service inline handler
  const handleStartEdit = (service) => {
    setEditingServiceId(service.id);
    setEditingServiceName(service.nombre);
    setEditingServiceDuration(service.duracion);
  };

  const handleCancelEdit = () => {
    setEditingServiceId(null);
  };

  const handleUpdateService = async (id) => {
    if (!editingServiceName.trim()) {
      triggerAlert('error', 'El nombre no puede estar vacío.');
      return;
    }
    setSavingService(true);
    try {
      if (dbWarning || String(id).startsWith('mock-')) {
        setServicesList(prev => prev.map(s => s.id === id ? { ...s, nombre: editingServiceName.trim(), duracion: parseInt(editingServiceDuration) } : s));
        setEditingServiceId(null);
        triggerAlert('success', 'Servicio actualizado localmente (Modo Demo).');
      } else {
        const { error } = await supabase
          .from('servicios')
          .update({ nombre: editingServiceName.trim(), duracion: parseInt(editingServiceDuration) })
          .eq('id', id);

        if (error) throw error;
        setServicesList(prev => prev.map(s => s.id === id ? { ...s, nombre: editingServiceName.trim(), duracion: parseInt(editingServiceDuration) } : s));
        setEditingServiceId(null);
        triggerAlert('success', '¡Servicio actualizado con éxito!');
      }
    } catch (err) {
      console.error("Error updating service:", err);
      triggerAlert('error', err.message || 'Error al actualizar servicio.');
    } finally {
      setSavingService(false);
    }
  };

  // Delete Service
  const handleDeleteService = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este servicio?')) return;
    setSavingService(true);
    try {
      if (dbWarning || String(id).startsWith('mock-')) {
        setServicesList(prev => prev.filter(s => s.id !== id));
        triggerAlert('success', 'Servicio eliminado localmente (Modo Demo).');
      } else {
        const { error } = await supabase
          .from('servicios')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setServicesList(prev => prev.filter(s => s.id !== id));
        triggerAlert('success', '¡Servicio eliminado con éxito!');
      }
    } catch (err) {
      console.error("Error deleting service:", err);
      triggerAlert('error', err.message || 'Error al eliminar servicio.');
    } finally {
      setSavingService(false);
    }
  };

  // Toggle Day active status
  const handleToggleDay = (dayIndex) => {
    setScheduleList(prev =>
      prev.map(item => item.dia === dayIndex ? { ...item, activo: !item.activo } : item)
    );
  };

  // Handle Hour range change
  const handleHourChange = (dayIndex, field, value) => {
    setScheduleList(prev =>
      prev.map(item => item.dia === dayIndex ? { ...item, [field]: value } : item)
    );
  };

  // Save Schedule
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setSavingSchedule(true);
    try {
      const records = scheduleList.map(item => ({
        user_id: user.id,
        dia: item.dia,
        activo: item.activo,
        hora_inicio: item.hora_inicio,
        hora_fin: item.hora_fin
      }));

      const { error } = await supabase
        .from('horarios')
        .upsert(records, { onConflict: 'user_id,dia' });

      if (error) throw error;
      triggerAlert('success', '¡Horarios de atención guardados con éxito!');
    } catch (err) {
      console.error("Error saving schedule:", err);
      triggerAlert('error', err.message || 'Error al guardar los horarios. Revisa la base de datos.');
    } finally {
      setSavingSchedule(false);
    }
  };

  // Get shared link
  const getShareableLink = () => {
    const slugToUse = savedSlug || businessSlug || "tu-negocio";
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/reservas?slug=${slugToUse}`;
    }
    return `http://localhost:3000/reservas?slug=${slugToUse}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center items-center">
        <svg className="animate-spin h-10 w-10 text-brand-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm font-semibold text-brand-teal mt-4">Cargando panel de control...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-brand-dark flex flex-col lg:flex-row">
      {/* SIDEBAR NAVIGATION (LEFT) */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-brand-teal/10 flex flex-col justify-between p-6 select-none shrink-0">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-cyan flex items-center justify-center text-white shadow-md shadow-brand-cyan/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-brand-dark">
                Turnos<span className="text-brand-cyan">Ya</span>
              </span>
              <p className="text-[10px] text-brand-teal font-semibold uppercase tracking-wider">Panel Admin</p>
            </div>
          </div>

          {/* User details */}
          <div className="py-2.5 px-3 bg-slate-50 border border-slate-100 rounded-xl">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Sesión activa</p>
            <p className="text-xs font-semibold text-brand-dark truncate">{user?.email}</p>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('perfil')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'perfil'
                  ? 'bg-brand-mint/20 text-[#034959] border-l-4 border-brand-teal font-bold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-brand-dark'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72M6.75 18h3.5a.75.75 0 00.75-.75V14.25a.75.75 0 00-.75-.75h-35m0 4.5H6.75" />
              </svg>
              Perfil de Negocio
            </button>

            <button
              onClick={() => setActiveTab('servicios')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'servicios'
                  ? 'bg-brand-mint/20 text-[#034959] border-l-4 border-brand-teal font-bold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-brand-dark'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              Servicios
            </button>

            <button
              onClick={() => setActiveTab('horarios')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'horarios'
                  ? 'bg-brand-mint/20 text-[#034959] border-l-4 border-brand-teal font-bold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-brand-dark'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Horarios de Atención
            </button>
          </nav>
        </div>

        {/* Logout button */}
        <div className="mt-8 pt-4 border-t border-brand-teal/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold rounded-xl text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow p-6 sm:p-10 max-w-4xl bg-white">
        {/* DB Schema warning banner */}
        {dbWarning && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
            <span className="text-sm font-bold block mb-1">⚠️ Tablas de Base de Datos No Detectadas</span>
            No se detectaron las tablas públicas correspondientes en Supabase (`perfiles`, `servicios` o `horarios`). Por favor, ejecuta el script SQL provisto en el Plan de Implementación en tu consola de Supabase. El panel funcionará temporalmente en modo demostración local.
          </div>
        )}

        {/* Floating Success/Error Alert Message */}
        {alertMessage.text && (
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 transition-all animate-fadeIn border ${
            alertMessage.type === 'success'
              ? 'bg-[#9BF2C1]/40 border-[#73D97A] text-[#034959]'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="mt-0.5 flex-shrink-0">
              {alertMessage.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-brand-teal">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-600">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className="text-xs font-semibold leading-tight">{alertMessage.text}</p>
          </div>
        )}

        {/* TAB 1: BUSINESS PROFILE */}
        {activeTab === 'perfil' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-2xl font-extrabold text-[#034959]">Perfil del Negocio</h1>
              <p className="text-sm text-brand-teal">Configura el nombre de tu empresa y obtén tu enlace único para que tus clientes reserven turnos.</p>
            </div>

            <div className="bg-white border border-brand-teal/10 rounded-2xl p-6 shadow-sm">
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div>
                  <label htmlFor="business-name" className="block text-sm font-bold text-[#034959] mb-1.5">
                    Nombre del Negocio
                  </label>
                  <input
                    id="business-name"
                    type="text"
                    required
                    placeholder="Mi Estética o Consultorio"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-brand-teal/20 text-brand-dark bg-white focus:outline-none focus:border-[#29A68F] focus:ring-4 focus:ring-[#29A68F]/10 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#034959] mb-1.5">
                    Tu Enlace Único de Reservas
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getShareableLink()}
                      className="flex-grow px-4 py-3 rounded-xl border border-brand-teal/15 text-slate-500 bg-slate-50 font-mono text-xs select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(getShareableLink());
                        triggerAlert('success', '¡Enlace copiado al portapapeles!');
                      }}
                      className="px-4 py-3 bg-[#049DBF] hover:bg-[#034959] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center cursor-pointer"
                    >
                      Copiar
                    </button>
                  </div>
                  <p className="text-[10px] text-brand-teal mt-2">
                    Este es el enlace que debes compartir con tus clientes para que reserven turnos de manera pública.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="py-3 px-5 bg-[#29A68F] hover:bg-[#034959] text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingProfile ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Guardando...
                      </>
                    ) : (
                      "Guardar Perfil"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: SERVICES MANAGER */}
        {activeTab === 'servicios' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-2xl font-extrabold text-[#034959]">Gestor de Servicios</h1>
              <p className="text-sm text-brand-teal">Administra el catálogo de servicios que ofreces, indicando la duración estimada de cada uno.</p>
            </div>

            {/* Add Service Form */}
            <div className="bg-white border border-brand-teal/10 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#034959] mb-4">Agregar Nuevo Servicio</h3>
              <form onSubmit={handleAddService} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-6">
                  <label htmlFor="new-service-name" className="block text-xs font-bold text-[#034959] mb-1.5">
                    Nombre del Servicio
                  </label>
                  <input
                    id="new-service-name"
                    type="text"
                    required
                    placeholder="Ej. Tratamiento Premium"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-brand-teal/20 text-brand-dark bg-white focus:outline-none focus:border-[#29A68F] focus:ring-4 focus:ring-[#29A68F]/10 transition-all font-medium text-sm"
                  />
                </div>

                <div className="md:col-span-3">
                  <label htmlFor="new-service-duration" className="block text-xs font-bold text-[#034959] mb-1.5">
                    Duración (minutos)
                  </label>
                  <select
                    id="new-service-duration"
                    value={newServiceDuration}
                    onChange={(e) => setNewServiceDuration(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-brand-teal/20 text-brand-dark bg-white focus:outline-none focus:border-[#29A68F] focus:ring-4 focus:ring-[#29A68F]/10 transition-all font-medium text-sm cursor-pointer"
                  >
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                    <option value="90">90 min</option>
                    <option value="120">120 min</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <button
                    type="submit"
                    disabled={savingService}
                    className="w-full py-2.5 px-4 bg-[#29A68F] hover:bg-[#034959] text-white font-bold text-sm rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {savingService ? "..." : "Agregar"}
                  </button>
                </div>
              </form>
            </div>

            {/* Services List Table */}
            <div className="bg-white border border-brand-teal/10 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-brand-teal/10 text-xs font-bold uppercase text-brand-teal select-none">
                    <th className="py-3.5 px-6">Nombre de Servicio</th>
                    <th className="py-3.5 px-6">Duración</th>
                    <th className="py-3.5 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {servicesList.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-slate-400 font-medium">
                        No has registrado ningún servicio.
                      </td>
                    </tr>
                  ) : (
                    servicesList.map(service => {
                      const isEditing = editingServiceId === service.id;
                      return (
                        <tr key={service.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-3 px-6 font-semibold text-brand-dark">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingServiceName}
                                onChange={(e) => setEditingServiceName(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-brand-teal/30 focus:outline-none focus:border-[#049DBF] text-sm bg-white"
                              />
                            ) : (
                              service.nombre
                            )}
                          </td>
                          <td className="py-3 px-6 text-brand-teal font-medium">
                            {isEditing ? (
                              <select
                                value={editingServiceDuration}
                                onChange={(e) => setEditingServiceDuration(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-brand-teal/30 focus:outline-none focus:border-[#049DBF] text-sm bg-white"
                              >
                                <option value="15">15 min</option>
                                <option value="30">30 min</option>
                                <option value="45">45 min</option>
                                <option value="60">60 min</option>
                                <option value="90">90 min</option>
                                <option value="120">120 min</option>
                              </select>
                            ) : (
                              `${service.duracion} minutos`
                            )}
                          </td>
                          <td className="py-3 px-6 text-right space-x-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleUpdateService(service.id)}
                                  className="text-xs font-bold text-white bg-[#29A68F] hover:bg-[#034959] px-2.5 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEdit(service)}
                                  className="text-xs font-bold text-[#049DBF] hover:text-[#034959] transition-colors cursor-pointer"
                                >
                                  Editar
                                </button>
                                <span className="text-slate-200">|</span>
                                <button
                                  onClick={() => handleDeleteService(service.id)}
                                  className="text-xs font-bold text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SCHEDULE CONFIGURATOR */}
        {activeTab === 'horarios' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-2xl font-extrabold text-[#034959]">Horarios de Atención</h1>
              <p className="text-sm text-brand-teal">Configura qué días de la semana abres tu negocio y en qué rangos de horarios recibes reservas.</p>
            </div>

            <div className="bg-white border border-brand-teal/10 rounded-2xl p-6 shadow-sm">
              <form onSubmit={handleSaveSchedule} className="space-y-5">
                <div className="space-y-4">
                  {WEEK_DAYS.map(day => {
                    const config = scheduleList.find(item => item.dia === day.index) || {
                      dia: day.index,
                      activo: false,
                      hora_inicio: "09:00",
                      hora_fin: "18:00"
                    };

                    return (
                      <div
                        key={day.index}
                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-xl border border-slate-100 hover:bg-slate-50/20 transition-all gap-4"
                      >
                        {/* Checkbox toggle day */}
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={config.activo}
                              onChange={() => handleToggleDay(day.index)}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#73D97A]"></div>
                          </label>
                          <span className={`text-sm font-bold ${config.activo ? 'text-brand-dark' : 'text-slate-400'}`}>
                            {day.name}
                          </span>
                        </div>

                        {/* Opening - Closing Hour selectors */}
                        {config.activo ? (
                          <div className="flex items-center gap-2 text-sm">
                            <input
                              type="time"
                              required
                              value={config.hora_inicio}
                              onChange={(e) => handleHourChange(day.index, 'hora_inicio', e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border border-brand-teal/20 text-brand-dark bg-white font-medium focus:outline-none focus:border-[#049DBF]"
                            />
                            <span className="text-slate-400 font-bold">a</span>
                            <input
                              type="time"
                              required
                              value={config.hora_fin}
                              onChange={(e) => handleHourChange(day.index, 'hora_fin', e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border border-brand-teal/20 text-brand-dark bg-white font-medium focus:outline-none focus:border-[#049DBF]"
                            />
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400 select-none italic bg-slate-50 py-1 px-3 rounded-lg border border-slate-100/50">
                            Cerrado o No Laborable
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-brand-teal/10">
                  <button
                    type="submit"
                    disabled={savingSchedule}
                    className="py-3 px-5 bg-[#29A68F] hover:bg-[#034959] text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingSchedule ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Guardando...
                      </>
                    ) : (
                      "Guardar Horarios"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
