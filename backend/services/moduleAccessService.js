import { models } from '../models/index.js';
import { clearSettingsCache, getSettingBoolean } from './settingsService.js';

export const SYSTEM_MODULES = Object.freeze({
  login: { settingKey: 'module.login.enabled', label: 'Login', fallback: true },
  registration: { settingKey: 'auth.registration.enabled', label: 'Registro', fallback: true },
  editor: { settingKey: 'module.editor.enabled', label: 'Editor', fallback: true },
  store: { settingKey: 'module.store.enabled', label: 'Tienda', fallback: true }
});

export async function isModuleEnabled(moduleKey) {
  const module = SYSTEM_MODULES[moduleKey];
  if (!module) return false;
  return getSettingBoolean(module.settingKey, module.fallback);
}

export async function getSystemModuleStates() {
  const entries = await Promise.all(Object.entries(SYSTEM_MODULES).map(async ([key, module]) => [key, {
    key,
    label: module.label,
    enabled: await isModuleEnabled(key)
  }]));
  return Object.fromEntries(entries);
}

export async function setSystemModuleState(moduleKey, enabled) {
  const module = SYSTEM_MODULES[moduleKey];
  if (!module) throw Object.assign(new Error('Módulo desconocido.'), { status: 404 });
  const [row] = await models.SystemSetting.findOrCreate({
    where: { key: module.settingKey },
    defaults: { value: enabled ? 'true' : 'false', description: `Habilita o bloquea el módulo ${module.label}.`, public: true }
  });
  await row.update({ value: enabled ? 'true' : 'false', public: true });
  clearSettingsCache();
  return { key: moduleKey, label: module.label, enabled };
}
