import { Eraser, Layers3, Paintbrush, Plus, Trash2 } from 'lucide-react';
import { BRUSH_PRESETS } from './drawingTool';

export default function DrawingControls({ tool, config, setConfig, activeLayer, onNewLayer, onClearLayer, onSelectDraw, onSelectEraser }) {
  const update = (patch) => setConfig((current) => ({ ...current, ...patch }));

  return (
    <section className="dc-drawing-controls">
      <h3>DIBUJO</h3>

      <div className="dc-brush-mode-grid">
        <button type="button" className={tool === 'draw' ? 'active' : ''} onClick={onSelectDraw}><Paintbrush size={15} /> PINCEL</button>
        <button type="button" className={tool === 'eraser' ? 'active' : ''} onClick={onSelectEraser}><Eraser size={15} /> BORRADOR</button>
      </div>

      <label>TIPO DE PINCEL</label>
      <select value={config.brush} disabled={tool === 'eraser'} onChange={(event) => {
        const brush = event.target.value;
        const preset = BRUSH_PRESETS.find((item) => item.value === brush);
        update({ brush, opacity: preset?.opacity ?? config.opacity });
      }}>
        {BRUSH_PRESETS.map((brush) => <option key={brush.value} value={brush.value}>{brush.label}</option>)}
      </select>

      <label>COLOR</label>
      <input type="color" disabled={tool === 'eraser'} value={config.color} onChange={(event) => update({ color: event.target.value })} />

      <label>TAMAÑO <b>{config.size}px</b></label>
      <input type="range" min="2" max="100" value={config.size} onChange={(event) => update({ size: Number(event.target.value) })} />

      <label>OPACIDAD <b>{Math.round(config.opacity * 100)}%</b></label>
      <input type="range" min="5" max="100" disabled={tool === 'eraser'} value={Math.round(config.opacity * 100)} onChange={(event) => update({ opacity: Number(event.target.value) / 100 })} />

      <p className="dc-help">{tool === 'eraser' ? 'El borrador elimina trazos únicamente dentro de la capa de dibujo activa.' : 'Lápiz: sólido. Marcador: 78% de opacidad. Resaltador: 36%.'}</p>

      <div className="dc-draw-layer-card">
        <span><Layers3 size={14} /> CAPA DE DIBUJO ACTIVA</span>
        <b>{activeLayer?.layerName || 'NINGUNA CAPA DE DIBUJO'}</b>
      </div>

      <div className="dc-brush-mode-grid">
        <button type="button" onClick={onNewLayer}><Plus size={14} /> NUEVA CAPA</button>
        <button type="button" className="danger" disabled={!activeLayer} onClick={onClearLayer}><Trash2 size={14} /> LIMPIAR</button>
      </div>

      <p className="dc-help">P abre el pincel y E el borrador. Cada dibujo es una capa normal: puedes moverlo, agruparlo y cambiar su orden.</p>
    </section>
  );
}
