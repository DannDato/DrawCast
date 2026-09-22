import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { requestGoogleCode } from '../../utils/googleIdentity';
import { clearPendingVerifyAccess, setPendingVerifyAccess } from '../../utils/verifyAccessStorage';

export default function GoogleAuthButton({ mode = 'signin', onError }) {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const cleanupRequestRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupRequestRef.current?.();
      cleanupRequestRef.current = null;
    };
  }, []);

  const handleCode = useCallback(async (code) => {
    try {
      clearPendingVerifyAccess();
      const { data } = await api.post('/auth/google/code', { code }, { headers: { 'X-Requested-With': 'XmlHttpRequest' } });
      if (data.requiresOtp) {
        setPendingVerifyAccess(data);
        navigate('/verify-access');
        return;
      }
      await refresh();
      navigate('/app');
    } catch (error) {
      onError?.(error.response?.data?.message || 'No se pudo continuar con Google');
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [navigate, refresh, onError]);

  const start = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    cleanupRequestRef.current?.();
    cleanupRequestRef.current = null;

    try {
      cleanupRequestRef.current = await requestGoogleCode({
        onCode: handleCode,
        onCancel: () => { if (mountedRef.current) setBusy(false); },
        onError: (message) => {
          if (mountedRef.current) setBusy(false);
          onError?.(message);
        }
      });
    } catch (error) {
      if (mountedRef.current) setBusy(false);
      onError?.(error.message || 'No se pudo abrir Google.');
    }
  }, [busy, handleCode, onError]);

  return (
    <button type="button" className="dc-oauth-button dc-oauth-google" onClick={start} disabled={busy}>
      {/* <span className="dc-google-mark" aria-hidden="true">G</span> */}
      <img src="/icons/google.svg" alt="Google" className="dc-oauth-icon" />
      <span>{busy ? 'ABRIENDO GOOGLE...' : mode === 'signup' ? 'GOOGLE' : 'GOOGLE'}</span>
    </button>
  );
}
