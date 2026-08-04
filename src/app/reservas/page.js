"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function ReservasContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug');

  // Multi-tenant business state
  const [businessUserId, setBusinessUserId] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [loadingBusiness, setLoadingBusiness] = useState(true);

  // Business services & schedules states loaded dynamically from database
  const [servicesList, setServicesList] = useState([]);
  const [scheduleList, setScheduleList] = useState([]);
  const [reservationsList, setReservationsList] = useState([]);

  // Booking selections
  const [selectedService, setSelectedService] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);

  // Client details
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Application states
  const [viewDate, setViewDate] = useState(new Date());
  const [currentDateObj, setCurrentDateObj] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Resolve business owner from slug & sync today's date
  useEffect(() => {
    setCurrentDateObj(new Date());

    const resolveBusiness = async () => {
      if (!slug) {
        setLoadingBusiness(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select('user_id, nombre')
          .eq('slug', slug)
          .maybeSingle();

        if (error) {
          // If table does not exist yet, we capture it gracefully
          if (error.code === 'PGRST205' || error.message.includes('relation "public.perfiles" does not exist')) {
            console.warn("Table perfiles does not exist in Supabase.");
          } else {
            throw error;
          }
        }

        if (data) {
          setBusinessUserId(data.user_id);
          setBusinessName(data.nombre);
        }
      } catch (err) {
        console.error("Error resolving business slug:", err);
      } finally {
        setLoadingBusiness(false);
      }
    };

    resolveBusiness();
  }, [slug]);

  // Load business services and schedules once business owner is resolved
  useEffect(() => {
    const loadBusinessData = async () => {
      if (!businessUserId) return;
      try {
        // Fetch services
        const { data: servicesData, error: servicesError } = await supabase
          .from('servicios')
          .select('*')
          .eq('user_id', businessUserId)
          .order('nombre', { ascending: true });

        if (servicesError) throw servicesError;
        setServicesList(servicesData || []);

        // Fetch schedules
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('horarios')
          .select('*')
          .eq('user_id', businessUserId);

        if (scheduleError) throw scheduleError;
        setScheduleList(scheduleData || []);
      } catch (err) {
        console.error("Error loading services/schedules:", err);
      }
    };

    loadBusinessData();
  }, [businessUserId]);

  // Load reservations for the selected date to compute slot availability
  useEffect(() => {
    const loadReservationsForDate = async () => {
      if (!businessUserId || !selectedDate) {
        setReservationsList([]);
        return;
      }
      try {
        const localYear = selectedDate.getFullYear();
        const localMonth = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const localDay = String(selectedDate.getDate()).padStart(2, '0');
        const formattedDate = `${localYear}-${localMonth}-${localDay}`;

        const { data, error } = await supabase
          .from('reservas')
          .select('*')
          .eq('business_id', businessUserId)
          .eq('fecha', formattedDate);

        if (error) throw error;
        setReservationsList(data || []);
      } catch (err) {
        console.error("Error loading reservations for date:", err);
      }
    };

    loadReservationsForDate();
  }, [businessUserId, selectedDate]);

  // Handle month navigation
  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Helper date queries
  const isToday = (dayDate) => {
    if (!dayDate || !currentDateObj) return false;
    return dayDate.getDate() === currentDateObj.getDate() &&
      dayDate.getMonth() === currentDateObj.getMonth() &&
      dayDate.getFullYear() === currentDateObj.getFullYear();
  };

  const isPast = (dayDate) => {
    if (!dayDate || !currentDateObj) return false;
    const compareDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    const todayDate = new Date(currentDateObj.getFullYear(), currentDateObj.getMonth(), currentDateObj.getDate());
    return compareDate < todayDate;
  };

  const isDayAvailable = (dayDate) => {
    if (!dayDate) return false;
    if (isPast(dayDate)) return false;

    const dayIndex = dayDate.getDay() === 0 ? 6 : dayDate.getDay() - 1;
    const dayConfig = scheduleList.find(s => s.dia === dayIndex);

    if (dayConfig) {
      return dayConfig.activo;
    }

    // Fallback: lunes a viernes activo por defecto
    return dayIndex < 5;
  };

  const checkSlotAvailability = (timeSlotStr) => {
    if (!selectedService || !selectedDate) return { isAvailable: true };

    const selectedServiceDetail = servicesList.find(s => s.id === selectedService);
    const serviceCupo = selectedServiceDetail?.cupo || 1;

    // 1. Regla de Cupo
    const bookingsForThisService = reservationsList.filter(
      res => res.servicio === selectedService && res.hora === timeSlotStr
    ).length;

    if (bookingsForThisService >= serviceCupo) {
      return { isAvailable: false, reason: "Cupo agotado para este servicio en este horario" };
    }

    // Helper: HH:MM to minutes
    const timeToMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const startNew = timeToMinutes(timeSlotStr);
    const endNew = startNew + (selectedServiceDetail?.duracion || 30);

    // 2. Regla de Superposición
    for (const res of reservationsList) {
      const resServiceDetail = servicesList.find(s => s.id === res.servicio);
      const startExist = timeToMinutes(res.hora);
      const endExist = startExist + (resServiceDetail?.duracion || 30);

      // Interval overlap check:
      const overlapExists = startNew < endExist && startExist < endNew;

      if (overlapExists) {
        const existingNoOverlap = resServiceDetail?.permite_superposicion === false;
        const newNoOverlap = selectedServiceDetail?.permite_superposicion === false;

        if (existingNoOverlap || newNoOverlap) {
          return {
            isAvailable: false,
            reason: existingNoOverlap
              ? `Horario ocupado por el servicio '${resServiceDetail?.nombre || "Bloqueante"}'`
              : "Este servicio no permite superponerse con otros turnos"
          };
        }
      }
    }

    return { isAvailable: true };
  };

  const generateTimeSlots = () => {
    if (!selectedDate) return [];

    const dayIndex = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1;
    const dayConfig = scheduleList.find(s => s.dia === dayIndex);

    const startTimeStr = dayConfig ? dayConfig.hora_inicio : "09:00";
    const endTimeStr = dayConfig ? dayConfig.hora_fin : "18:00";

    // Si el día no está activo, no hay horarios
    if (dayConfig && !dayConfig.activo) return [];

    const serviceDetail = servicesList.find(s => s.id === selectedService);
    const duration = serviceDetail ? serviceDetail.duracion : 30; // minutos

    const slots = [];

    // Parse hours and minutes
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    let current = new Date(selectedDate);
    current.setHours(startH, startM, 0, 0);

    const end = new Date(selectedDate);
    end.setHours(endH, endM, 0, 0);

    while (current < end) {
      const hours = String(current.getHours()).padStart(2, '0');
      const minutes = String(current.getMinutes()).padStart(2, '0');
      const timeSlotStr = `${hours}:${minutes}`;

      // TODO: Para soportar la funcionalidad de Cupo o Capacidad por turno:
      // 1. Cargar las reservas existentes de la tabla `reservas` para este business_id y fecha (selectedDate).
      // 2. Contar la cantidad de reservas agendadas para este bloque horario exacto (timeSlotStr).
      // 3. Obtener el cupo configurado para el servicio actual: `serviceDetail?.cupo || 1`.
      // 4. Si el recuento >= cupo del servicio, marcar esta franja horaria como "Agotada" en la UI
      //    (por ejemplo, devolviendo un objeto { hora: timeSlotStr, agotado: true } para deshabilitar el botón).

      slots.push(timeSlotStr);
      current.setMinutes(current.getMinutes() + duration);
    }

    return slots;
  };

  // Generate calendar days
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);

  const rawFirstDay = firstDayOfMonth.getDay();
  const offset = rawFirstDay === 0 ? 6 : rawFirstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < offset; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(year, month, d));
  }

  // Format date safely for display
  const formatFullSelectedDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Handle form submission
  const handleSubmitBooking = async (e) => {
    e.preventDefault();

    // Validations
    if (!selectedService) {
      setMessage({ type: 'error', text: 'Por favor, selecciona un tipo de servicio.' });
      return;
    }
    if (!selectedDate) {
      setMessage({ type: 'error', text: 'Por favor, selecciona un día para tu turno.' });
      return;
    }
    if (!selectedTime) {
      setMessage({ type: 'error', text: 'Por favor, selecciona un horario disponible.' });
      return;
    }
    const availability = checkSlotAvailability(selectedTime);
    if (!availability.isAvailable) {
      setMessage({ type: 'error', text: `El horario seleccionado no está disponible: ${availability.reason}` });
      return;
    }
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setMessage({ type: 'error', text: 'Por favor, completa todos los campos del formulario.' });
      return;
    }

    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      // Format selected date locally as YYYY-MM-DD
      const localYear = selectedDate.getFullYear();
      const localMonth = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const localDay = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${localYear}-${localMonth}-${localDay}`;

      // Insert record in Supabase
      const { error } = await supabase
        .from('reservas')
        .insert([
          {
            nombre: fullName.trim(),
            email: email.trim(),
            telefono: phone.trim(),
            fecha: formattedDate,
            hora: selectedTime,
            servicio: selectedService,
            business_id: businessUserId // linked to the business owner user id
          }
        ]);

      if (error) throw error;

      // Send confirmation email via Resend API endpoint
      try {
        const serviceName = servicesList.find(s => s.id === selectedService)?.nombre || 'Servicio';
        const emailPrueba = 'keywayscontacto@gmail.com';
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: emailPrueba.trim(),
            clientName: fullName.trim(),
            serviceName,
            date: formattedDate,
            time: selectedTime,
            businessName: businessName || 'TurnosYa',
          }),
        });
      } catch (emailErr) {
        console.error('Error enviando email de confirmación:', emailErr);
      }

      // Show success alert using the specified tones (#9BF2C1 and #73D97A)
      setMessage({
        type: 'success',
        text: `¡Reserva confirmada con éxito! Tu turno para el servicio de ${servicesList.find(s => s.id === selectedService)?.nombre
          } ha sido agendado para el día ${formatFullSelectedDate(selectedDate)} a las ${selectedTime} hs.`
      });

      // Clear selections & inputs
      setSelectedService("");
      setSelectedDate(null);
      setSelectedTime(null);
      setFullName("");
      setEmail("");
      setPhone("");
    } catch (err) {
      console.error("Error creating reservation:", err);
      setMessage({
        type: 'error',
        text: err.message || 'Ocurrió un error al procesar tu reserva. Asegúrate de que las tablas en Supabase estén creadas mediante el script SQL.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-brand-dark flex flex-col font-sans">
      {/* Brand Header */}
      <header className="border-b border-brand-teal/10 bg-white py-5 px-6 sm:px-12 flex justify-between items-center shadow-sm select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-cyan flex items-center justify-center text-white shadow-md shadow-brand-cyan/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
            </svg>
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-brand-dark">
              Turnos<span className="text-brand-cyan">Ya</span>
            </span>
            <span className="text-xs ml-2 text-brand-teal font-medium border-l border-brand-teal/20 pl-2">
              Reservas {businessName ? `- ${businessName}` : ''}
            </span>
          </div>
        </div>
        <a
          href="/login"
          className="text-xs font-bold text-brand-cyan hover:text-brand-teal transition-colors border border-brand-cyan/20 px-3 py-1.5 rounded-lg hover:bg-brand-mint/10"
        >
          Acceso Administrador
        </a>
      </header>

      {/* Main Content Area */}
      {loadingBusiness ? (
        <div className="flex-grow flex flex-col justify-center items-center bg-white">
          <svg className="animate-spin h-8 w-8 text-brand-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs font-semibold text-brand-teal mt-3">Cargando información del negocio...</span>
        </div>
      ) : !slug ? (
        /* Warning for missing slug in tenant SaaS mode */
        <div className="flex-grow flex flex-col justify-center items-center p-8 bg-white max-w-lg mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-4 border border-amber-200">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#034959] mb-2">Enlace de reserva incompleto</h2>
          <p className="text-sm text-slate-500 mb-6">
            Para solicitar un turno, debes acceder a través del enlace compartido por el negocio (por ejemplo, <code className="bg-slate-100 px-1.5 py-0.5 rounded text-brand-cyan text-xs">/reservas?slug=nombre-de-negocio</code>).
          </p>
          <a
            href="/login"
            className="px-4 py-2.5 bg-brand-cyan text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#034959] transition-all"
          >
            Iniciar Sesión como Administrador
          </a>
        </div>
      ) : !businessUserId ? (
        /* Warning for invalid business slug */
        <div className="flex-grow flex flex-col justify-center items-center p-8 bg-white max-w-lg mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4 border border-red-200">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#034959] mb-2">Negocio no registrado</h2>
          <p className="text-sm text-slate-500 mb-6">
            No se pudo encontrar ningún perfil registrado con el nombre de enlace: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-red-600 text-xs">{slug}</code>. Por favor, verifica la dirección.
          </p>
          <a
            href="/login"
            className="px-4 py-2.5 bg-brand-cyan text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#034959] transition-all"
          >
            Configurar un nuevo negocio
          </a>
        </div>
      ) : (
        /* Valid tenant bookings portal */
        <main className="flex-grow max-w-6xl w-full mx-auto p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white">

          {/* LEFT COLUMN: Selector, Calendar and Time Grid (7 cols) */}
          <section className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-brand-teal/10 p-5 sm:p-7 shadow-sm">
              <h2 className="text-2xl font-extrabold text-brand-dark mb-1">Reserva tu Turno</h2>
              <p className="text-sm text-brand-teal mb-6">Selecciona el servicio, fecha y hora de tu preferencia en el calendario.</p>

              {/* 1. Service Dropdown Selector */}
              <div className="mb-6">
                <label htmlFor="service-select" className="block text-sm font-bold text-[#034959] mb-2">
                  Tipo de Servicio
                </label>
                <select
                  id="service-select"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-brand-teal/20 text-brand-dark bg-white focus:outline-none focus:border-[#049DBF] focus:ring-4 focus:ring-[#049DBF]/10 transition-all font-medium cursor-pointer"
                >
                  <option value="" disabled>-- Elige una opción de servicio --</option>
                  {servicesList.map(service => {
                    const priceFormatted = Number(service.precio) > 0
                      ? `$ ${Number(service.precio).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                      : 'Gratis';
                    return (
                      <option key={service.id} value={service.id}>
                        {service.nombre} ({service.duracion} min) - {priceFormatted}
                      </option>
                    );
                  })}
                </select>
                {selectedService && (
                  <p className="text-xs text-brand-teal mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                    Duración estimada del turno: {servicesList.find(s => s.id === selectedService)?.duracion} minutos.
                  </p>
                )}
              </div>

              {/* 2. Interactive Calendar */}
              <div className="border border-brand-teal/10 rounded-2xl p-4 sm:p-5 bg-white mb-6">
                <div className="flex justify-between items-center mb-5">
                  <span className="text-base font-bold text-[#034959]">
                    {MONTH_NAMES[month]} {year}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded-lg border border-brand-teal/15 text-brand-dark hover:bg-brand-mint/40 transition-colors"
                      aria-label="Mes anterior"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1.5 rounded-lg border border-brand-teal/15 text-brand-dark hover:bg-brand-mint/40 transition-colors"
                      aria-label="Mes siguiente"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Weekdays */}
                <div className="grid grid-cols-7 text-center text-xs font-bold text-brand-teal mb-3">
                  {WEEK_DAYS.map((day, idx) => (
                    <div key={idx} className="py-1">{day}</div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {calendarDays.map((dayDate, idx) => {
                    if (dayDate === null) {
                      return <div key={`empty-${idx}`} className="p-2"></div>;
                    }

                    const dayNum = dayDate.getDate();
                    const isSelected = selectedDate &&
                      dayDate.getDate() === selectedDate.getDate() &&
                      dayDate.getMonth() === selectedDate.getMonth() &&
                      dayDate.getFullYear() === selectedDate.getFullYear();
                    const today = isToday(dayDate);

                    const isAvailable = isDayAvailable(dayDate);

                    let dayStyles = "p-2 rounded-xl text-sm font-semibold transition-all relative flex flex-col items-center justify-center aspect-square select-none ";

                    if (isSelected) {
                      dayStyles += "bg-[#9BF2C1] text-[#034959] font-bold border-2 border-[#73D97A] shadow-sm";
                    } else if (!isAvailable) {
                      dayStyles += "text-slate-300 cursor-not-allowed";
                    } else {
                      dayStyles += "text-brand-dark cursor-pointer hover:bg-brand-mint/55 hover:text-brand-dark";
                    }

                    return (
                      <button
                        key={`day-${dayNum}`}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => {
                          setSelectedDate(dayDate);
                          setSelectedTime(null);
                        }}
                        className={dayStyles}
                      >
                        <span>{dayNum}</span>
                        <div className="flex gap-0.5 absolute bottom-1.5">
                          {isAvailable && !isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-green"></span>
                          )}
                          {today && (
                            <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-brand-dark' : 'bg-brand-dark'}`}></span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Time Slots Grid */}
              {!selectedService ? (
                <div className="text-center py-6 px-4 border border-dashed border-brand-teal/20 rounded-2xl bg-slate-50/10">
                  <p className="text-sm font-semibold text-brand-teal/70">
                    Selecciona un tipo de servicio para calcular la duración y ver los horarios.
                  </p>
                </div>
              ) : selectedDate ? (
                <div className="animate-fadeIn">
                  <h4 className="text-sm font-bold text-[#034959] mb-3 flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-brand-teal">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Horarios Disponibles para el {selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]} ({servicesList.find(s => s.id === selectedService)?.duracion} min)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {generateTimeSlots().map((time, idx) => {
                      const isTimeSelected = selectedTime === time;
                      const availability = checkSlotAvailability(time);
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!availability.isAvailable}
                          onClick={() => setSelectedTime(time)}
                          className={`py-2.5 px-3 text-xs font-bold rounded-lg border transition-all text-center ${!availability.isAvailable
                            ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed'
                            : isTimeSelected
                              ? 'bg-[#73D97A] text-[#034959] border-[#29A68F] font-bold shadow-sm cursor-pointer'
                              : 'bg-white text-brand-dark border-brand-teal/20 hover:bg-brand-mint/50 active:scale-[0.97] cursor-pointer'
                            }`}
                          title={!availability.isAvailable ? `Bloqueado: ${availability.reason}` : ''}
                        >
                          {time} hs
                        </button>
                      );
                    })}
                    {generateTimeSlots().length === 0 && (
                      <p className="text-xs font-semibold text-slate-400 col-span-full py-2">
                        No hay horarios disponibles configurados para este día de la semana.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 px-4 border-2 border-dashed border-brand-teal/10 rounded-2xl bg-slate-50/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-10 h-10 text-brand-teal/40 mx-auto mb-2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <p className="text-sm font-semibold text-brand-teal/70">
                    Selecciona un día en el calendario para desplegar los horarios.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT COLUMN: Contact Form & Summary (5 cols) */}
          <section className="lg:col-span-5 space-y-6">
            {/* Summary Panel */}
            <div className="bg-[#034959] text-white rounded-2xl p-6 shadow-md shadow-brand-dark/10">
              <h3 className="text-lg font-bold mb-4 border-b border-white/10 pb-2">Resumen de tu Turno</h3>
              <ul className="space-y-3.5 text-sm">
                <li className="flex justify-between">
                  <span className="text-[#9BF2C1] font-medium">Servicio:</span>
                  <span className="font-bold text-right text-white text-right break-words max-w-[70%]">
                    {selectedService ? servicesList.find(s => s.id === selectedService)?.nombre : "No seleccionado"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#9BF2C1] font-medium">Fecha:</span>
                  <span className="font-bold text-right text-white capitalize">
                    {selectedDate ? formatFullSelectedDate(selectedDate) : "No seleccionada"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#9BF2C1] font-medium">Horario:</span>
                  <span className="font-bold text-right text-white">
                    {selectedTime ? `${selectedTime} hs` : "No seleccionado"}
                  </span>
                </li>
                <li className="flex justify-between border-t border-white/10 pt-3.5">
                  <span className="text-[#9BF2C1] font-medium">Precio:</span>
                  <span className="font-bold text-right text-white">
                    {selectedService
                      ? (() => {
                        const s = servicesList.find(x => x.id === selectedService);
                        const price = Number(s?.precio || 0);
                        return price > 0
                          ? `$ ${price.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                          : "Gratis";
                      })()
                      : "No seleccionado"
                    }
                  </span>
                </li>
              </ul>
            </div>

            {/* Booking Request Form */}
            <div className="bg-white rounded-2xl border border-brand-teal/10 p-5 sm:p-6 shadow-sm">
              <h3 className="text-lg font-extrabold text-[#034959] mb-4">Información de Contacto</h3>
              <form onSubmit={handleSubmitBooking} className="space-y-4">

                <div>
                  <label htmlFor="fullname" className="block text-sm font-bold text-[#034959] mb-1.5">
                    Nombre Completo
                  </label>
                  <input
                    id="fullname"
                    type="text"
                    required
                    placeholder="Juan Pérez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-brand-teal/20 text-brand-dark bg-white placeholder-slate-400 focus:outline-none focus:border-[#29A68F] focus:ring-4 focus:ring-[#29A68F]/10 transition-all font-medium"
                  />
                </div>

                <div>
                  <label htmlFor="client-email" className="block text-sm font-bold text-[#034959] mb-1.5">
                    Correo Electrónico
                  </label>
                  <input
                    id="client-email"
                    type="email"
                    required
                    placeholder="juan@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-brand-teal/20 text-brand-dark bg-white placeholder-slate-400 focus:outline-none focus:border-[#29A68F] focus:ring-4 focus:ring-[#29A68F]/10 transition-all font-medium"
                  />
                </div>

                <div>
                  <label htmlFor="client-phone" className="block text-sm font-bold text-[#034959] mb-1.5">
                    Número de Teléfono
                  </label>
                  <input
                    id="client-phone"
                    type="tel"
                    required
                    placeholder="+54 9 11 1234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-brand-teal/20 text-brand-dark bg-white placeholder-slate-400 focus:outline-none focus:border-[#29A68F] focus:ring-4 focus:ring-[#29A68F]/10 transition-all font-medium"
                  />
                </div>

                {/* Alert Message Banner */}
                {message.text && (
                  <div className={`p-4 rounded-xl flex items-start gap-3 transition-all ${message.type === 'success'
                    ? 'bg-[#9BF2C1]/40 border border-[#73D97A] text-[#034959]'
                    : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                    <div className="mt-0.5 flex-shrink-0">
                      {message.type === 'success' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-brand-teal">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-600">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs font-semibold leading-tight">{message.text}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-4 bg-[#29A68F] hover:bg-[#034959] text-white font-extrabold rounded-xl shadow-md shadow-brand-teal/10 hover:shadow-brand-dark/20 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-[#29A68F]/25 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center cursor-pointer text-sm"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Procesando...</span>
                    </div>
                  ) : (
                    "Confirmar Reserva"
                  )}
                </button>
              </form>
            </div>
          </section>

        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-brand-teal/10 py-6 text-center text-xs text-slate-400 select-none bg-white">
        &copy; {new Date().getFullYear()} TurnosYa. Todos los derechos reservados.
      </footer>
    </div>
  );
}

export default function ReservasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex flex-col justify-center items-center">
        <svg className="animate-spin h-10 w-10 text-brand-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm font-semibold text-brand-teal mt-4 font-sans">Cargando portal de reservas...</span>
      </div>
    }>
      <ReservasContent />
    </Suspense>
  );
}
