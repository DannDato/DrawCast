import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';

export default function GoogleConnectButton({ onConnected, onError }) {
  const ref = useRef(null);
  const [clientId, setClientId] = useState('');

  useEffect(() => { api.get('/auth/google/config').then(({ data }) => setClientId(data.clientId || '')).catch(() => setClientId('')); }, []);
  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    let timer;
    const render = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id || !ref.current) { timer = setTimeout(render, 100); return; }
      ref.current.innerHTML = '';
      window.google.accounts.id.initialize({ client_id: clientId, callback: async ({ credential }) => {
        try { const { data } = await api.post('/user/profile/google/connect', { credential }); onConnected?.(data); }
        catch (error) { onError?.(error.response?.data?.message || 'No se pudo conectar Google'); }
      }});
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', width: 280, text: 'continue_with' });
    };
    render();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [clientId, onConnected, onError]);
  if (!clientId) return null;
  return <div ref={ref} />;
}
