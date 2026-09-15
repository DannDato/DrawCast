import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { clearPendingVerifyAccess, setPendingVerifyAccess } from '../../utils/verifyAccessStorage';

export default function GoogleAuthButton({ mode = 'signin', onError }) {
  const ref = useRef(null);
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    api.get('/auth/google/config').then(({ data }) => setClientId(data.clientId || '')).catch(() => setClientId(''));
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    let timer;

    const render = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id || !ref.current) {
        timer = setTimeout(render, 100);
        return;
      }

      ref.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            clearPendingVerifyAccess();
            const { data } = await api.post('/auth/google', { credential });
            if (data.requiresOtp) {
              setPendingVerifyAccess(data);
              navigate('/verify-access');
              return;
            }
            await refresh();
            navigate('/app');
          } catch (error) {
            onError?.(error.response?.data?.message || 'No se pudo continuar con Google');
          }
        }
      });

      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: mode === 'signup' ? 'signup_with' : 'signin_with'
      });
    };

    render();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [clientId, mode, navigate, onError, refresh]);

  if (!clientId) return null;
  return <div className="flex min-h-10 justify-center"><div ref={ref} /></div>;
}
