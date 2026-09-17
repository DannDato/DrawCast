import { Keyboard, X } from 'lucide-react';
import { HOTKEY_SECTIONS } from './shortcuts';

export default function HotkeysModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="dc-hotkeys-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dc-hotkeys-modal" role="dialog" aria-modal="true" aria-label="Atajos de teclado de DrawCast" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="dc-hotkeys-kicker"><Keyboard size={15} /> MAPA DE CONTROLES</span>
            <h2>ATAJOS // DRAWCAST</h2>
          </div>
          <button type="button" className="dc-hotkeys-close" onClick={onClose} aria-label="Cerrar atajos"><X size={18} /></button>
        </header>

        <div className="dc-hotkeys-grid">
          {HOTKEY_SECTIONS.map((section) => (
            <section key={section.title} className="dc-hotkey-section">
              <h3>{section.title}</h3>
              <div>
                {section.items.map(([keys, description]) => (
                  <div key={`${section.title}-${keys}-${description}`} className="dc-hotkey-row">
                    <span className="dc-hotkey-keys">{keys}</span>
                    <span>{description}</span>
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
