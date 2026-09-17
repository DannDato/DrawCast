import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { requestGoogleCode } from '../../utils/googleIdentity';

export default function GoogleConnectButton({ onConnected, onError }) {
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
      const { data } = await api.post('/user/profile/google/connect/code', { code }, { headers: { 'X-Requested-With': 'XmlHttpRequest' } });
      await onConnected?.(data);
    } catch (error) {
      onError?.(error.response?.data?.message || 'No se pudo conectar Google');
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [onConnected, onError]);

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
    <button type="button" className="dc-oauth-button dc-oauth-google dc-google-connect-button" onClick={start} disabled={busy}>
      <span className="dc-google-mark" aria-hidden="true">G</span>
      <span>{busy ? 'ABRIENDO GOOGLE...' : 'CONECTAR GOOGLE'}</span>
    </button>
  );
}
