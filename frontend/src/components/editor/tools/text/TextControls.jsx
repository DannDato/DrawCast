import { TEXT_FONTS, normalizeTextConfig } from './textTool';

export default function TextControls({ selected, config, setConfig, onPatchSelected }) {
  const selectedText = selected?.tipo === 'text' || selected?.tipo === 'texto';
  const value = normalizeTextConfig(selectedText ? selected : config);

  const update = (patch) => {
    const configPatch = { ...patch, ...(patch.fontKey ? { fontFamily: TEXT_FONTS.find((font) => font.key === patch.fontKey)?.family } : {}) };
    setConfig((current) => ({ ...current, ...configPatch }));
    if (selectedText) onPatchSelected(patch);
  };

  return (
    <section>
      <h3>Texto</h3>

      <label>Fuente</label>
      <select value={value.fontKey} onChange={(event) => update({ fontKey: event.target.value, fontFamily: TEXT_FONTS.find((font) => font.key === event.target.value)?.family })}>
        {TEXT_FONTS.map((font) => <option key={font.key} value={font.key}>{font.label}</option>)}
      </select>

      <label>Color</label>
      <input type="color" value={value.color} onChange={(event) => update({ color: event.target.value })} />

      <label>Color del borde</label>
      <input type="color" value={value.strokeColor} onChange={(event) => update({ strokeColor: event.target.value })} />

      <label>Grosor del borde <b>{value.strokeWidth}</b></label>
      <input type="range" min="0" max="24" value={value.strokeWidth} onChange={(event) => update({ strokeWidth: Number(event.target.value) })} />

      <label>Tamaño <b>{value.fontSize}</b></label>
      <input type="range" min="5" max="400" value={value.fontSize} onChange={(event) => update({ fontSize: Number(event.target.value) })} />

      <p className="dc-help">Haz clic en el lienzo para escribir. Enter aplica, Shift+Enter agrega una línea y doble clic edita un texto existente.</p>
    </section>
  );
}
