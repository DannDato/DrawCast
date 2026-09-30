import { createPortal } from 'react-dom';
import '../../styles/loading.css';

export default function LoadingOverlay({ active = false, message = 'Cargando...' }) {
  return createPortal(
    <div className={`dc-loading-overlay ${active ? 'is-active' : ''}`} aria-hidden={!active}>
      <div className="dc-loading-content" role="status" aria-live="polite" aria-atomic="true">
        <span className="dc-loading-spinner" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>,
    document.body
  );
}
