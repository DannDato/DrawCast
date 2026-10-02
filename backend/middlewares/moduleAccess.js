import { isModuleEnabled, SYSTEM_MODULES } from '../services/moduleAccessService.js';

export const requireModuleEnabled = (moduleKey) => async (req, res, next) => {
  if (await isModuleEnabled(moduleKey)) return next();
  const label = SYSTEM_MODULES[moduleKey]?.label || moduleKey;
  return res.status(503).json({ code: 'MODULE_DISABLED', module: moduleKey, message: `${label} está deshabilitado temporalmente.` });
};
