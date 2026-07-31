"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { createClient } from '@/utils/supabase/client';

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const TIME_SLOTS = [
  "08:30", "09:15", "10:00", "10:45", "11:30", 
  "14:00", "14:45", "15:30", "16:15", "17:00"
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth states
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState({ type: '', text: '' });

  // Calendar states
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [currentDateObj, setCurrentDateObj] = useState(null);

  // Sync today's date on hydration and check current session
  useEffect(() => {
    setCurrentDateObj(new Date());

    const checkSession = async () => {
      if (!isSupabaseConfigured) {
        console.warn("Supabase no está configurado. Se omite la validación de sesión.");
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error("Error al obtener la sesión de Supabase:", error);
      }
    };
    checkSession();
  }, [router]);

  // Handle month navigation
  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Check if a calendar day is today
  const isToday = (dayDate) => {
    if (!dayDate || !currentDateObj) return false;
    return dayDate.getDate() === currentDateObj.getDate() &&
           dayDate.getMonth() === currentDateObj.getMonth() &&
           dayDate.getFullYear() === currentDateObj.getFullYear();
  };

  // Check if a day is in the past
  const isPast = (dayDate) => {
    if (!dayDate || !currentDateObj) return false;
    // Set hours to 0 to compare just the date
    const compareDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    const todayDate = new Date(currentDateObj.getFullYear(), currentDateObj.getMonth(), currentDateObj.getDate());
    return compareDate < todayDate;
  };

  // Check if weekend (Saturday or Sunday)
  const isWeekend = (dayDate) => {
    if (!dayDate) return false;
    const day = dayDate.getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
  };

  // Generate calendar days grid
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  
  // getDay returns 0 for Sunday. Adjust so Monday is 0, Sunday is 6
  const rawFirstDay = firstDayOfMonth.getDay();
  const offset = rawFirstDay === 0 ? 6 : rawFirstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  // Offset padding
  for (let i = 0; i < offset; i++) {
    calendarDays.push(null);
  }
  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(year, month, d));
  }

  // Auth submission
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage({ type: '', text: '' });

    if (!isSupabaseConfigured) {
      setAuthMessage({
        type: 'error',
        text: 'Error de configuración: Las variables de entorno de Supabase no están configuradas correctamente. Por favor, crea un archivo .env.local en la raíz del proyecto con las claves correspondientes (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY) y reinicia el servidor de desarrollo.',
      });
      setAuthLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setAuthMessage({
          type: 'success',
          text: '¡Registro exitoso! Por favor revisa tu correo electrónico para confirmar tu cuenta.',
        });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setAuthMessage({
          type: 'success',
          text: `¡Bienvenido de nuevo! Has iniciado sesión como ${data.user.email}. Redirigiendo al panel...`,
        });
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }
    } catch (error) {
      console.error("Error de autenticación capturado:", error);
      let errorMsg = 'Ocurrió un error inesperado al intentar autenticar.';
      if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
        errorMsg = 'Error de conexión: No se pudo conectar con el servidor de autenticación de Supabase. Esto ocurre si no tienes conexión a internet o si la URL de Supabase es inválida o inexistente.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      setAuthMessage({
        type: 'error',
        text: errorMsg,
      });
    } finally {
      setAuthLoading(false);
    }
  };

  // Formatting date for summary
  const formatFullSelectedDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 min-h-screen bg-white text-brand-dark">
      {/* LEFT COLUMN: Auth & Brand Info */}
      <div className="lg:col-span-5 flex flex-col justify-between p-8 sm:p-12 lg:p-16 border-r border-brand-teal/15 bg-white">
        {/* Brand Header */}
        <div className="flex items-center gap-3 select-none">
          <div className="w-10 h-10 rounded-xl bg-brand-cyan flex items-center justify-center text-white shadow-md shadow-brand-cyan/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-brand-dark">
              Turnos<span className="text-brand-cyan">Ya</span>
            </h1>
            <p className="text-xs text-brand-teal font-medium">Gestión inteligente de citas</p>
          </div>
        </div>

        {/* Auth Form Card */}
        <div className="my-10 lg:my-0 max-w-md w-full mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-brand-dark mb-2">
              {isSignUp ? 'Crear una cuenta' : 'Iniciar sesión'}
            </h2>
            <p className="text-sm text-brand-teal">
              {isSignUp 
                ? 'Regístrate para reservar y administrar tus turnos online.' 
                : 'Accede a tu cuenta para confirmar y ver tus reservas.'
              }
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-brand-dark mb-1.5">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full px-4 py-3 rounded-xl border border-brand-teal/20 text-brand-dark bg-white placeholder-slate-400 focus:outline-none focus:border-brand-cyan focus:ring-4 focus:ring-brand-cyan/10 transition-all"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-brand-dark">
                  Contraseña
                </label>
                {!isSignUp && (
                  <a href="#" className="text-xs font-semibold text-brand-cyan hover:text-brand-teal transition-colors">
                    ¿Olvidaste tu contraseña?
                  </a>
                )}
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-brand-teal/20 text-brand-dark bg-white placeholder-slate-400 focus:outline-none focus:border-brand-cyan focus:ring-4 focus:ring-brand-cyan/10 transition-all"
              />
            </div>

            {/* Notification Messages */}
            {authMessage.text && (
              <div className={`p-4 rounded-xl flex items-start gap-3 transition-all ${
                authMessage.type === 'success' 
                  ? 'bg-brand-mint/40 border border-brand-green/30 text-brand-dark' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <div className="mt-0.5">
                  {authMessage.type === 'success' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-brand-teal">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-600">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="text-sm font-medium leading-tight">{authMessage.text}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 px-4 bg-brand-dark text-white font-semibold rounded-xl shadow-md shadow-brand-dark/10 hover:bg-brand-cyan hover:shadow-brand-cyan/20 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-brand-cyan/25 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center"
            >
              {authLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                isSignUp ? 'Registrarse' : 'Ingresar'
              )}
            </button>
          </form>

          {/* Social Sign In Divider */}
          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-brand-teal/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">O continuar con</span>
            </div>
          </div>

          <button
            type="button"
            className="w-full py-3 px-4 border border-brand-teal/20 bg-white hover:bg-brand-mint/35 text-brand-dark font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.58 15.02 1 12 1 7.35 1 3.39 3.67 1.41 7.56l3.82 2.96c.92-2.77 3.51-4.48 6.77-4.48z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.57l3.77 2.92c2.2-2.03 3.68-5.02 3.68-8.64z"/>
              <path fill="#FBBC05" d="M5.23 10.52c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L1.41 2.99C.51 4.79 0 6.8 0 8.91s.51 4.12 1.41 5.92l3.82-3.31z"/>
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.77-2.92c-1.05.7-2.4 1.13-4.19 1.13-3.26 0-5.85-1.71-6.77-4.48l-3.82 2.96C3.39 20.33 7.35 23 12 23z"/>
            </svg>
            Google
          </button>

          {/* Toggle login/signup link */}
          <div className="mt-8 text-center text-sm">
            <span className="text-slate-500">
              {isSignUp ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta aún?'}
            </span>{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthMessage({ type: '', text: '' });
              }}
              className="font-bold text-brand-cyan hover:text-brand-teal transition-colors focus:outline-none"
            >
              {isSignUp ? 'Iniciar Sesión' : 'Registrarse Gratis'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-slate-400 text-center lg:text-left mt-6 lg:mt-0 select-none">
          &copy; {new Date().getFullYear()} TurnosYa. Todos los derechos reservados.
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Calendar */}
      <div className="lg:col-span-7 bg-slate-50/50 p-8 sm:p-12 lg:p-16 flex flex-col justify-center items-center">
        <div className="w-full max-w-xl bg-white rounded-3xl border border-brand-teal/15 p-6 sm:p-8 shadow-xl shadow-slate-100/50">
          
          {/* Header */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-teal">Simulador de reservas</span>
              <h3 className="text-xl font-extrabold text-brand-dark">Selecciona Fecha y Hora</h3>
            </div>
            {/* Legend for Availability */}
            <div className="flex gap-4 items-center text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-green"></span>
                <span>Disponible</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>
                <span>No disponible</span>
              </div>
            </div>
          </div>

          {/* Calendar Box */}
          <div className="border border-brand-teal/10 rounded-2xl p-4 sm:p-5 bg-white mb-6">
            
            {/* Month & Nav Controls */}
            <div className="flex justify-between items-center mb-5">
              <span className="text-base font-bold text-brand-dark">
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

            {/* Weekdays Labels */}
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
                const past = isPast(dayDate);
                const weekend = isWeekend(dayDate);
                const isSelected = selectedDate && 
                  dayDate.getDate() === selectedDate.getDate() &&
                  dayDate.getMonth() === selectedDate.getMonth() &&
                  dayDate.getFullYear() === selectedDate.getFullYear();
                const today = isToday(dayDate);

                // Determine if date is pickable
                const isAvailable = !past && !weekend;

                let dayStyles = "p-2 rounded-xl text-sm font-semibold transition-all relative flex flex-col items-center justify-center aspect-square select-none ";
                
                if (isSelected) {
                  dayStyles += "bg-brand-cyan text-white shadow-md shadow-brand-cyan/20";
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
                      setSelectedTime(null); // Reset selected time slot when changing dates
                    }}
                    className={dayStyles}
                  >
                    <span>{dayNum}</span>
                    {/* Visual Indicators */}
                    <div className="flex gap-0.5 absolute bottom-1.5">
                      {isAvailable && !isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-green"></span>
                      )}
                      {today && (
                        <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-dark'}`}></span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slot Selection */}
          {selectedDate ? (
            <div className="animate-fadeIn transition-all duration-300">
              <h4 className="text-sm font-bold text-brand-dark mb-3 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-brand-teal">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Horarios Disponibles para el {selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {TIME_SLOTS.map((time, idx) => {
                  const isTimeSelected = selectedTime === time;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedTime(time)}
                      className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all text-center ${
                        isTimeSelected
                          ? 'bg-brand-dark text-white border-brand-dark shadow-sm'
                          : 'bg-white text-brand-dark border-brand-teal/20 hover:bg-brand-mint/50 active:scale-[0.97]'
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 px-4 border-2 border-dashed border-brand-teal/10 rounded-2xl bg-slate-50/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-10 h-10 text-brand-teal/40 mx-auto mb-2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <p className="text-sm font-semibold text-brand-teal/70">
                Selecciona un día en el calendario para ver los horarios.
              </p>
            </div>
          )}

          {/* Summary Panel */}
          {selectedDate && selectedTime && (
            <div className="mt-6 p-4 rounded-xl bg-brand-mint/30 border border-brand-teal/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-slideUp">
              <div>
                <p className="text-xs font-semibold text-brand-teal uppercase tracking-wider">Turno pre-seleccionado</p>
                <p className="text-sm font-bold text-brand-dark mt-0.5 capitalize">
                  {formatFullSelectedDate(selectedDate)}
                </p>
                <p className="text-xs font-bold text-brand-cyan mt-0.5">
                  Horario: {selectedTime} hs
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAuthMessage({
                    type: 'success',
                    text: `Has pre-seleccionado el turno para el ${selectedDate.getDate()}/${selectedDate.getMonth() + 1} a las ${selectedTime}. ¡Inicia sesión o regístrate en la izquierda para confirmar tu reserva!`
                  });
                }}
                className="w-full sm:w-auto px-4 py-2 bg-brand-teal hover:bg-brand-dark text-white font-bold text-xs rounded-lg transition-all shadow-sm active:scale-[0.97]"
              >
                Confirmar Pre-Reserva
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
