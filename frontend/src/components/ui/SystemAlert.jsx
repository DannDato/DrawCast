import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const SystemAlertContext = createContext(null);

const TONE_ICONS = {
  danger: AlertTriangle,
  success: CheckCircle2,
  info: Info
};

function normalizeOptions(input, fallbackTitle) {
  if (typeof input === 'string') return { title: fallbackTitle, message: input };
  return { title: fallbackTitle, ...(input || {}) };
}

export function SystemAlertProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const activeRef = useRef(null);
  const queueRef = useRef([]);

  const showNext = useCallback(() => {
    if (activeRef.current || !queueRef.current.length) return;
    const next = queueRef.current.shift();
    activeRef.current = next;
    setDialog(next.options);
  }, []);

  const enqueue = useCallback((options) => new Promise((resolve) => {
    queueRef.current.push({ options, resolve });
    showNext();
  }), [showNext]);

  const close = useCallback((value) => {
    const active = activeRef.current;
    if (!active) return;
    activeRef.current = null;
    setDialog(null);
    active.resolve(value);
    requestAnimationFrame(showNext);
  }, [showNext]);

  const showAlert = useCallback((options) => enqueue({
    type: 'alert',
    tone: 'info',
    buttonLabel: 'Entendido',
    ...normalizeOptions(options, 'Aviso')
  }).then(() => undefined), [enqueue]);

  const confirmDialog = useCallback((options) => enqueue({
    type: 'confirm',
    tone: 'info',
    confirmLabel: 'Continuar',
    cancelLabel: 'Cancelar',
    ...normalizeOptions(options, 'Confirmar acción')
  }), [enqueue]);

  useEffect(() => () => {
    if (activeRef.current) activeRef.current.resolve(false);
    queueRef.current.forEach((item) => item.resolve(false));
    activeRef.current = null;
    queueRef.current = [];
  }, []);

  return (
    <SystemAlertContext.Provider value={{ showAlert, confirmDialog }}>
      {children}
      {dialog && <SystemAlertDialog dialog={dialog} onClose={close} />}
    </SystemAlertContext.Provider>
  );
}

function SystemAlertDialog({ dialog, onClose }) {
  const primaryRef = useRef(null);
  const isConfirm = dialog.type === 'confirm';
  const tone = ['danger', 'success', 'info'].includes(dialog.tone) ? dialog.tone : 'info';
  const Icon = TONE_ICONS[tone];

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    primaryRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) requestAnimationFrame(() => previousFocus.focus());
    };
  }, [onClose]);

  const content = (
    <div className="dc-system-alert-backdrop" role="presentation" onMouseDown={() => onClose(false)}>
      <section className={`dc-system-alert dc-system-alert-${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="dc-system-alert-title" aria-describedby="dc-system-alert-message" onMouseDown={(event) => event.stopPropagation()}>
        <div className="dc-system-alert-accent" />
        <button type="button" className="dc-system-alert-close" onClick={() => onClose(false)} aria-label="Cerrar"><X size={16} /></button>

        <div className="dc-system-alert-icon" aria-hidden="true"><Icon size={20} /></div>
        <div className="dc-system-alert-copy">
          <span className="dc-system-alert-kicker">DRAWCAST // {isConfirm ? 'CONFIRMACIÓN' : 'AVISO'}</span>
          <h2 id="dc-system-alert-title">{dialog.title}</h2>
          {dialog.message && <p id="dc-system-alert-message">{dialog.message}</p>}
        </div>

        <footer className="dc-system-alert-actions">
          {isConfirm && <button type="button" className="dc-system-alert-secondary" onClick={() => onClose(false)}>{dialog.cancelLabel}</button>}
          <button ref={primaryRef} type="button" className={`dc-system-alert-primary ${tone === 'danger' ? 'danger' : ''}`} onClick={() => onClose(true)}>{isConfirm ? dialog.confirmLabel : dialog.buttonLabel}</button>
        </footer>
      </section>
    </div>
  );

  return createPortal(content, document.body);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSystemAlert() {
  const context = useContext(SystemAlertContext);
  if (!context) throw new Error('useSystemAlert debe usarse dentro de SystemAlertProvider.');
  return context;
}
