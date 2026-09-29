import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import api from '../../api/axios';

const SCRIPT_ID = 'TRAZIO-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const LOAD_TIMEOUT_MS = 7000;
let scriptPromise = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => finish(reject, new Error('Turnstile load timeout')), LOAD_TIMEOUT_MS);
    const existing = document.getElementById(SCRIPT_ID);

    if (existing) {
      existing.addEventListener('load', () => finish(resolve), { once: true });
      existing.addEventListener('error', () => finish(reject, new Error('Turnstile script error')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => finish(resolve);
    script.onerror = () => finish(reject, new Error('Turnstile script error'));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

const TurnstileWidget = forwardRef(function TurnstileWidget({ action, onTokenChange, onStateChange }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const onStateChangeRef = useRef(onStateChange);
  const [error, setError] = useState('');

  useEffect(() => { onTokenChangeRef.current = onTokenChange; }, [onTokenChange]);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenChangeRef.current?.('');
      if (window.turnstile && widgetIdRef.current !== null) window.turnstile.reset(widgetIdRef.current);
    }
  }), []);

  useEffect(() => {
    let active = true;
    let renderedWidgetId = null;

    onStateChangeRef.current?.({ enabled: true, available: false, loginFailOpen: false });

    api.get('/auth/turnstile/config')
      .then(async ({ data }) => {
        if (!active) return;

        if (data?.enabled === false) {
          setError('');
          onTokenChangeRef.current?.('');
          onStateChangeRef.current?.({ enabled: false, available: false, loginFailOpen: data?.loginFailOpen === true });
          return;
        }

        const loginFailOpen = data?.loginFailOpen === true;
        try {
          await loadTurnstile();
          if (!active || !containerRef.current || !window.turnstile) throw new Error('Turnstile unavailable');

          renderedWidgetId = window.turnstile.render(containerRef.current, {
            sitekey: data.siteKey,
            action,
            theme: 'dark',
            size: 'flexible',
            callback: (token) => {
              setError('');
              onTokenChangeRef.current?.(token);
              onStateChangeRef.current?.({ enabled: true, available: true, loginFailOpen });
            },
            'expired-callback': () => onTokenChangeRef.current?.(''),
            'error-callback': () => {
              onTokenChangeRef.current?.('');
              setError(loginFailOpen && action === 'login'
                ? 'La verificación anti-bot no está disponible. Puedes intentar iniciar sesión.'
                : 'No pudimos completar la verificación anti-bot.');
              onStateChangeRef.current?.({ enabled: true, available: false, loginFailOpen });
            }
          });
          widgetIdRef.current = renderedWidgetId;
          onStateChangeRef.current?.({ enabled: true, available: true, loginFailOpen });
        } catch {
          if (!active) return;
          onTokenChangeRef.current?.('');
          setError(loginFailOpen && action === 'login'
            ? 'La verificación anti-bot no pudo cargar. Puedes intentar iniciar sesión.'
            : 'No pudimos cargar la verificación anti-bot.');
          onStateChangeRef.current?.({ enabled: true, available: false, loginFailOpen });
        }
      })
      .catch((err) => {
        if (!active) return;
        const loginFailOpen = err.response?.data?.loginFailOpen === true;
        onTokenChangeRef.current?.('');
        setError(loginFailOpen && action === 'login'
          ? 'La verificación anti-bot no está disponible. Puedes intentar iniciar sesión.'
          : 'No pudimos cargar la verificación anti-bot.');
        onStateChangeRef.current?.({ enabled: true, available: false, loginFailOpen });
      });

    return () => {
      active = false;
      if (window.turnstile && renderedWidgetId !== null) window.turnstile.remove(renderedWidgetId);
      widgetIdRef.current = null;
    };
  }, [action]);

  return <div className="dc-turnstile">{error ? <p className="dc-auth-alert error">{error}</p> : <div ref={containerRef} />}</div>;
});

export default TurnstileWidget;
