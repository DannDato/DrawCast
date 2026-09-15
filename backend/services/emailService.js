import nodemailer from 'nodemailer';
import logger from '../helpers/winston.js';

function transporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;

  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { type: 'login', user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function sendMail(options) {
  const mailer = transporter();
  if (!mailer) throw new Error('SMTP no configurado. Define SMTP_USER y SMTP_PASS.');
  await mailer.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, ...options });
}

export async function sendPasswordReset(email, token) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: 'Restablecer contraseña',
    text: `Usa este enlace para restablecer tu contraseña: ${url}`,
    html: `<p>Solicitaste restablecer tu contraseña.</p><p><a href="${url}">Restablecer contraseña</a></p><p>Si no fuiste tú, ignora este correo.</p>`
  });
  return true;
}

export async function sendAccessCodeEmail(email, code, minutes) {
  await sendMail({
    to: email,
    subject: 'Código de acceso',
    text: `Tu código de acceso es ${code}. Expira en ${minutes} minutos. Si no intentaste iniciar sesión, cambia tu contraseña.`,
    html: `<p>Tu código de acceso es:</p><p style="font-size:32px;font-weight:800;letter-spacing:8px">${code}</p><p>Expira en ${minutes} minutos.</p><p>Si no intentaste iniciar sesión, cambia tu contraseña.</p>`
  });
  logger.info('Código OTP enviado', { email: String(email).replace(/^(.{2}).*(@.*)$/, '$1***$2') });
  return true;
}

export async function sendEmailVerificationCode(email, code, minutes) {
  await sendMail({ to: email, subject: 'Verifica tu correo', text: `Tu código de verificación es ${code}. Expira en ${minutes} minutos.`, html: `<p>Tu código de verificación es:</p><p style="font-size:32px;font-weight:800;letter-spacing:8px">${code}</p><p>Expira en ${minutes} minutos.</p>` });
}

export async function sendEmailChangeCode(email, code, minutes) {
  await sendMail({ to: email, subject: 'Confirma tu nuevo correo', text: `Tu código para confirmar este correo es ${code}. Expira en ${minutes} minutos.`, html: `<p>Confirma este correo con el código:</p><p style="font-size:32px;font-weight:800;letter-spacing:8px">${code}</p><p>Expira en ${minutes} minutos.</p>` });
}

export async function sendSecurityNotification(email, title, lines = []) {
  const text = [title, '', ...lines, '', 'Si no reconoces esta actividad, cambia tu contraseña y cierra las demás sesiones.'].join('\n');
  const html = `<h2>${title}</h2>${lines.map((line) => `<p>${line}</p>`).join('')}<p>Si no reconoces esta actividad, cambia tu contraseña y cierra las demás sesiones.</p>`;
  await sendMail({ to: email, subject: `Seguridad: ${title}`, text, html });
}

export async function sendChannelInvitation(email, token, channelName, inviterName) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: `Invitación para editar ${channelName} en DrawCast`,
    text: `${inviterName} te invitó a colaborar en ${channelName}. Inicia sesión con este correo y acepta la invitación: ${url}`,
    html: `<h2>DrawCast // COLLAB INVITE</h2><p><strong>${inviterName}</strong> te invitó a editar <strong>${channelName}</strong>.</p><p><a href="${url}">Aceptar invitación</a></p><p>El enlace es único, expira en 7 días y sólo funciona para este correo.</p>`
  });
}
