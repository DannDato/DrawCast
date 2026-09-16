import { TEXT_FONTS, normalizeTextConfig } from './textTool';

export default function TextControls({ selected, config, setConfig, onPatchSelected }) {
  const selectedText = selected?.tipo === 'text' || selected?.tipo === 'texto';
  const value = normalizeTextConfig(selectedText ? selected : config);

  const update = (patch) => {
    if (selectedText) onPatchSelected(patch);
    else setConfig((current) => ({ ...current, ...patch, ...(patch.fontKey ? { fontFamily: TEXT_FONTS.find((font) => font.key === patch.fontKey)?.family } : {}) }));
  };

  return (
    <section>
      <h3>[02] CONFIG TEXTO</h3>

      <label>FUENTE</label>
      <select value={value.fontKey} onChange={(event) => update({ fontKey: event.target.value, fontFamily: TEXT_FONTS.find((font) => font.key === event.target.value)?.family })}>
        {TEXT_FONTS.map((font) => <option key={font.key} value={font.key}>{font.label}</option>)}
      </select>

      <label>RELLENO</label>
      <input type="color" value={value.color} onChange={(event) => update({ color: event.target.value })} />

      <label>BORDE</label>
      <input type="color" value={value.strokeColor} onChange={(event) => update({ strokeColor: event.target.value })} />

      <label>GROSOR BORDE <b>{value.strokeWidth}</b></label>
      <input type="range" min="0" max="24" value={value.strokeWidth} onChange={(event) => update({ strokeWidth: Number(event.target.value) })} />

      <label>TAMAÑO <b>{value.fontSize}</b></label>
      <input type="range" min="5" max="400" value={value.fontSize} onChange={(event) => update({ fontSize: Number(event.target.value) })} />

      <p className="dc-help">CLICK EN CANVAS PARA ESCRIBIR // ENTER = APLICAR // SHIFT+ENTER = SALTO // DOBLE CLICK = EDITAR</p>
    </section>
  );
}
