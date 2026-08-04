import { NextResponse } from 'next/server';
import { sendBookingConfirmationEmail } from '@/lib/emailService';

export async function POST(request) {
  try {
    const body = await request.json();
    const { to, clientName, serviceName, date, time, businessName, idempotencyKey } = body;

    if (!to || !clientName || !serviceName || !date || !time) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (to, clientName, serviceName, date, time)' },
        { status: 400 }
      );
    }

    const result = await sendBookingConfirmationEmail({
      to,
      clientName,
      serviceName,
      date,
      time,
      businessName,
      idempotencyKey,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message || 'Error al enviar el correo' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('Error en API /api/send-email:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
