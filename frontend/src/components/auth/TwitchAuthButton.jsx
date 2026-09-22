import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { clearPendingVerifyAccess } from '../../utils/verifyAccessStorage';

export default function TwitchAuthButton({ onError, iconOnly = false, connectMode = false, className = '' }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/twitch/config')
      .then(({ data }) => setEnabled(Boolean(data.enabled)))
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false));
  }, []);

  const start = () => {
    if (!enabled) {
      onError?.('Twitch OAuth todavía no está configurado en el servidor.');
      return;
    }
    clearPendingVerifyAccess();
    const apiBase = String(api.defaults.baseURL || '').replace(/\/$/, '');
    window.location.assign(`${apiBase}/auth/twitch${connectMode ? '?mode=connect' : ''}`);
  };

  if (iconOnly) return <button type="button" className={`${className || 'grid h-[88px] w-[88px] place-items-center border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] p-4 transition hover:border-[var(--dc-accent)]'} disabled:cursor-wait disabled:opacity-60`} onClick={start} disabled={loading} title={loading ? 'Preparando Twitch…' : connectMode ? 'Conectar Twitch' : 'Iniciar con Twitch'}><img src="/icons/twitch.svg" alt="Twitch" className="h-full w-full object-contain grayscale opacity-55 transition" /></button>;

  return <button type="button" className="dc-oauth-button dc-oauth-twitch" onClick={start} disabled={loading}><img src="/icons/twitch.svg" alt="Twitch" className="dc-oauth-icon" /><span>{loading ? 'PREPARANDO TWITCH...' : 'TWITCH'}</span></button>;
}
