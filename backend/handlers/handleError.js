import logger from '../helpers/winston.js';
export function handleError(error, req, res, next) {
  if (res.headersSent) return next(error);
  logger.error(error.message, { stack: error.stack, method: req.method, path: req.originalUrl, userId: req.user?.id });
  const status = Number(error.status || 500);
  const body = { message: status >= 500 ? 'Error interno del servidor' : error.message };
  if (status < 500 && ['FEATURE_LOCKED', 'ENTITLEMENT_LIMIT_REACHED'].includes(error.code)) {
    body.code = error.code;
    if (error.feature) body.feature = error.feature;
    if (error.limitKey) body.limitKey = error.limitKey;
    if (Number.isFinite(Number(error.limit))) body.limit = Number(error.limit);
  }
  return res.status(status).json(body);
}
