import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { clearPendingVerifyAccess } from '../../utils/verifyAccessStorage';

const PROVIDERS = {
  kick: { label: 'Kick', config: '/auth/kick/config', icon: '/icons/kick.svg', className: 'dc-oauth-kick' },
  discord: { label: 'Discord', config: '/auth/discord/config', icon: '/icons/discord.svg', className: 'dc-oauth-discord' }
};

export default function ExternalOAuthButton({ provider, onError, iconOnly = false, connectMode = false, className = '' }) {
  const config = PROVIDERS[provider];
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config) return;
    api.get(config.config)
      .then(({ data }) => setEnabled(Boolean(data.enabled)))
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false));
  }, [config]);

  if (!config) return null;

  const start = () => {
    if (!enabled) {
      onError?.(`${config.label} OAuth todavía no está configurado en el servidor.`);
      return;
    }
    clearPendingVerifyAccess();
    const apiBase = String(api.defaults.baseURL || '').replace(/\/$/, '');
    window.location.assign(`${apiBase}/auth/${provider}${connectMode ? '?mode=connect' : ''}`);
  };

  if (iconOnly) return <button type="button" className={`${className || 'grid h-[88px] w-[88px] place-items-center border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] p-4 transition hover:border-[var(--dc-accent)]'} disabled:cursor-wait disabled:opacity-60`} onClick={start} disabled={loading} title={loading ? `Preparando ${config.label}…` : connectMode ? `Conectar ${config.label}` : `Iniciar con ${config.label}`}><img src={config.icon} alt={config.label} className="h-full w-full object-contain grayscale opacity-55 transition" /></button>;

  return <button type="button" className={`dc-oauth-button ${config.className}`} onClick={start} disabled={loading}><img src={config.icon} alt={config.label} className="dc-oauth-icon" /><span>{loading ? `PREPARANDO ${config.label.toUpperCase()}...` : config.label.toUpperCase()}</span></button>;
}
