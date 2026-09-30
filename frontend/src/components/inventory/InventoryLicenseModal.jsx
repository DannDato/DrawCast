import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function InventoryLicenseModal({ name, busy, onClose, children }) {
  const modalRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (document.querySelector('.dc-system-alert-backdrop')) return;
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const controls = [...modalRef.current.querySelectorAll('button:not(:disabled), select:not(:disabled), [href], [tabindex="0"]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        modalRef.current.focus();
      } else if (event.shiftKey && (document.activeElement === first || !modalRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !modalRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  return createPortal(
    <div className="dc-store-modal-backdrop dc-inventory-modal-backdrop" onMouseDown={() => { if (!busy) onClose(); }}>
      <section ref={modalRef} className="dc-store-modal dc-inventory-modal" role="dialog" aria-modal="true" aria-label={name} aria-busy={busy} tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
        <button ref={closeRef} type="button" className="dc-inventory-modal-close" onClick={onClose} disabled={busy} aria-label="Cerrar detalle de licencia"><X size={18} /></button>
        {children}
      </section>
    </div>,
    document.body
  );
}
