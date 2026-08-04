import { resend } from './resend';

/**
 * Envia un correo de confirmación de reserva.
 * 
 * @param {Object} params
 * @param {string} params.to - Email del destinatario.
 * @param {string} params.clientName - Nombre del cliente.
 * @param {string} params.serviceName - Nombre del servicio reservado.
 * @param {string} params.date - Fecha del turno (ej: '2026-08-10').
 * @param {string} params.time - Hora del turno (ej: '15:30').
 * @param {string} [params.businessName] - Nombre de la empresa o local.
 * @param {string} [params.idempotencyKey] - Clave de idempotencia opcional.
 */
export async function sendBookingConfirmationEmail({
  to,
  clientName,
  serviceName,
  date,
  time,
  businessName = 'TurnosYa',
  idempotencyKey,
}) {
  const from = process.env.RESEND_FROM_EMAIL || 'TurnosYa <onboarding@resend.dev>';

  const emailOptions = {
    from,
    to: [to],
    subject: `Confirmación de reserva: ${serviceName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; margin-top: 0;">¡Reserva Confirmada! 🎉</h2>
        <p style="color: #374151; font-size: 16px;">Hola <strong>${clientName}</strong>,</p>
        <p style="color: #374151; font-size: 16px;">Tu turno en <strong>${businessName}</strong> ha sido agendado con éxito.</p>
        
        <div style="background-color: #f9fafb; border-left: 4px solid #4f46e5; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 4px 0; color: #111827; font-size: 15px;">📌 <strong>Servicio:</strong> ${serviceName}</p>
          <p style="margin: 4px 0; color: #111827; font-size: 15px;">📅 <strong>Fecha:</strong> ${date}</p>
          <p style="margin: 4px 0; color: #111827; font-size: 15px;">⏰ <strong>Hora:</strong> ${time}</p>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">Si necesitas modificar o cancelar tu turno, contáctanos con anticipación.</p>
      </div>
    `,
  };

  if (idempotencyKey) {
    emailOptions.idempotencyKey = idempotencyKey;
  }

  const { data, error } = await resend.emails.send(emailOptions);

  if (error) {
    console.error('Error enviando correo de confirmación de reserva:', error);
    return { success: false, error };
  }

  return { success: true, data };
}
