import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.warn('Advertencia: RESEND_API_KEY no está configurada en las variables de entorno.');
}

export const resend = new Resend(process.env.RESEND_API_KEY);
