import { Keyboard, X } from 'lucide-react';
import { HOTKEY_SECTIONS } from './shortcuts';

export default function HotkeysModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="dc-shortcuts-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dc-shortcuts-modal" role="dialog" aria-modal="true" aria-label="Atajos de teclado de TRAZIO" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="dc-shortcuts-kicker"><Keyboard size={15} /> MAPA DE CONTROLES</span>
            <h2>ATAJOS // TRAZIO</h2>
          </div>
          <button type="button" className="dc-shortcuts-close" onClick={onClose} aria-label="Cerrar atajos"><X size={18} /></button>
        </header>

        <div className="dc-shortcuts-body">
          {HOTKEY_SECTIONS.map((section) => (
            <section key={section.title} className="dc-shortcuts-section">
              <h3>{section.title}</h3>
              <div>
                {section.items.map(([keys, description]) => (
                  <div key={`${section.title}-${keys}-${description}`} className="dc-shortcuts-row">
                    <span className="dc-shortcuts-keys">{keys}</span>
                    <span className="dc-shortcuts-description">{description}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer>Los atajos se pausan mientras escribes en un campo, selector o texto editable.</footer>
      </section>
    </div>
  );
}
