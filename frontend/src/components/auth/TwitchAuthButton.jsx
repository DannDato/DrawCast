import { useEffect, useState } from 'react';
// import { Twitch } from 'lucide-react';

import api from '../../api/axios';
import { clearPendingVerifyAccess } from '../../utils/verifyAccessStorage';

export default function TwitchAuthButton({ onError }) {
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
    window.location.assign(`${apiBase}/auth/twitch`);
  };

  return (
    <button type="button" className="dc-oauth-button dc-oauth-twitch" onClick={start} disabled={loading}>
      <img src="/icons/twitch.svg" alt="Twitch" className="w-8 h-8 m-[-10px]" />
      <span>{loading ? 'PREPARANDO TWITCH...' : 'ENTRAR CON TWITCH'}</span>
    </button>
  );
}
