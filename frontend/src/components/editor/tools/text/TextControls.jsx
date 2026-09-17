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
      <h3>TEXTO</h3>

      <label>FUENTE</label>
      <select value={value.fontKey} onChange={(event) => update({ fontKey: event.target.value, fontFamily: TEXT_FONTS.find((font) => font.key === event.target.value)?.family })}>
        {TEXT_FONTS.map((font) => <option key={font.key} value={font.key}>{font.label}</option>)}
      </select>

      <label>COLOR</label>
      <input type="color" value={value.color} onChange={(event) => update({ color: event.target.value })} />

      <label>COLOR DEL BORDE</label>
      <input type="color" value={value.strokeColor} onChange={(event) => update({ strokeColor: event.target.value })} />

      <label>GROSOR DEL BORDE <b>{value.strokeWidth}</b></label>
      <input type="range" min="0" max="24" value={value.strokeWidth} onChange={(event) => update({ strokeWidth: Number(event.target.value) })} />

      <label>TAMAÑO <b>{value.fontSize}</b></label>
      <input type="range" min="5" max="400" value={value.fontSize} onChange={(event) => update({ fontSize: Number(event.target.value) })} />

      <p className="dc-help">Haz clic en el lienzo para escribir. Enter aplica, Shift+Enter agrega una línea y doble clic edita un texto existente.</p>
    </section>
  );
}
