import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import api from '../../api/axios';

const SCRIPT_ID = 'drawcast-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

const TurnstileWidget = forwardRef(function TurnstileWidget({ action, onTokenChange }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const [error, setError] = useState('');

  useEffect(() => { onTokenChangeRef.current = onTokenChange; }, [onTokenChange]);

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenChangeRef.current?.('');
      if (window.turnstile && widgetIdRef.current !== null) window.turnstile.reset(widgetIdRef.current);
    }
  }), []);

  useEffect(() => {
    let active = true;
    let renderedWidgetId = null;

    Promise.all([api.get('/auth/turnstile/config'), loadTurnstile()])
      .then(([{ data }]) => {
        if (!active || !containerRef.current || !window.turnstile) return;
        renderedWidgetId = window.turnstile.render(containerRef.current, {
          sitekey: data.siteKey,
          action,
          theme: 'dark',
          size: 'flexible',
          callback: (token) => { setError(''); onTokenChangeRef.current?.(token); },
          'expired-callback': () => onTokenChangeRef.current?.(''),
          'error-callback': () => { onTokenChangeRef.current?.(''); setError('No pudimos completar la verificación anti-bot.'); }
        });
        widgetIdRef.current = renderedWidgetId;
      })
      .catch(() => { if (active) setError('No pudimos cargar la verificación anti-bot.'); });

    return () => {
      active = false;
      if (window.turnstile && renderedWidgetId !== null) window.turnstile.remove(renderedWidgetId);
      widgetIdRef.current = null;
    };
  }, [action]);

  return <div className="dc-turnstile">{error ? <p className="dc-auth-alert error">{error}</p> : <div ref={containerRef} />}</div>;
});

export default TurnstileWidget;
