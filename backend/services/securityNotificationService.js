import { sendSecurityNotification } from './emailService.js';
import logger from '../helpers/winston.js';

export async function notifySecurity(user, title, lines = []) {
  if (!user?.email) return;
  try { await sendSecurityNotification(user.email, title, lines); }
  catch (error) { logger.warn('No fue posible enviar notificación de seguridad', { userId: user.id, error: error.message }); }
}
