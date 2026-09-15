import logger from '../helpers/winston.js';
export function handleError(error, req, res, next) {
  if (res.headersSent) return next(error);
  logger.error(error.message, { stack: error.stack, method: req.method, path: req.originalUrl, userId: req.user?.id });
  const status = Number(error.status || 500);
  return res.status(status).json({ message: status >= 500 ? 'Error interno del servidor' : error.message });
}
