import ImagePanel from './ImagePanel';
import { DEFAULT_SHAPE_CONFIG, SHAPE_TYPES } from './tools/shapes/shapeTool';

function NumberField({ value, onChange, min }) {
  return <input type="number" min={min} value={Math.round(Number(value) || 0)} onChange={(event) => onChange(Number(event.target.value))} />;
}

export default function Inspector({ tool, selected, drawConfig, setDrawConfig, shapeConfig, setShapeConfig, imageConfig, setImageConfig, channelId, onUploadFile, onImportUrl, onPatch, onDelete }) {
  const isShape = selected?.tipo === 'shape' || selected?.tipo === 'forma';
  const isImage = selected?.tipo === 'image' || selected?.tipo === 'imagen';
  const showShapePanel = tool === 'shape' || isShape;
  const showImagePanel = tool === 'image' || isImage;

  const shapeValue = (canonical, legacy) => {
    if (isShape) return selected[canonical] ?? selected[legacy] ?? DEFAULT_SHAPE_CONFIG[canonical];
    return shapeConfig[canonical];
  };

  const updateShape = (patch) => {
    setShapeConfig((current) => ({ ...current, ...patch }));
    if (isShape) onPatch(patch);
  };

  return (
    <aside className="dc-inspector">
      <h2>[ SYS // PROPERTIES ]</h2>

      {tool === 'draw' && (
        <section>
          <h3>[01] PINCEL</h3>
          <label>COLOR</label>
          <input type="color" value={drawConfig.color} onChange={(event) => setDrawConfig({ ...drawConfig, color: event.target.value })} />
          <label>GROSOR <b>{drawConfig.size}</b></label>
          <input type="range" min="2" max="100" value={drawConfig.size} onChange={(event) => setDrawConfig({ ...drawConfig, size: Number(event.target.value) })} />
        </section>
      )}

      {showImagePanel && (
        <ImagePanel
          channelId={channelId}
          tool={tool}
          selected={selected}
          imageConfig={imageConfig}
          setImageConfig={setImageConfig}
          onPatch={onPatch}
          onUploadFile={onUploadFile}
          onImportUrl={onImportUrl}
        />
      )}

      {showShapePanel && (
        <section>
          <h3>[02B] FORMAS</h3>
          <label>TIPO</label>
          <select value={shapeValue('shapeType', 'shape')} onChange={(event) => updateShape({ shapeType: event.target.value })}>
            {SHAPE_TYPES.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
          </select>

          <label>RELLENO</label>
          <input type="color" value={shapeValue('fillColor', 'fill')} onChange={(event) => updateShape({ fillColor: event.target.value })} />

          <label>BORDE</label>
          <input type="color" value={shapeValue('strokeColor', 'stroke')} onChange={(event) => updateShape({ strokeColor: event.target.value })} />

          <label>GROSOR BORDE <b>{shapeValue('strokeWidth', 'strokeSize')}</b></label>
          <input type="range" min="0" max="24" value={shapeValue('strokeWidth', 'strokeSize')} onChange={(event) => updateShape({ strokeWidth: Number(event.target.value) })} />

          <label>BORDER-RADIUS <b>{shapeValue('borderRadius', 'radius')}</b></label>
          <input type="range" min="0" max="200" value={shapeValue('borderRadius', 'radius')} onChange={(event) => updateShape({ borderRadius: Number(event.target.value) })} />
          <p className="dc-help">ARRASTRA EN EL CANVAS // SHIFT = PROPORCIÓN // ALT = DESDE EL CENTRO</p>
        </section>
      )}

      {!selected && !showShapePanel && !showImagePanel && tool !== 'draw' && <p className="muted">SELECT A LAYER</p>}

      {selected && (
        <section>
          <h3>[ LAYER // TRANSFORM ]</h3>
          {selected.tipo === 'text' && (
            <>
              <label>LAYER NAME / TEXT</label>
              <input value={selected.text || ''} onChange={(event) => onPatch({ text: event.target.value })} />
            </>
          )}

          {(selected.tipo === 'image' || selected.tipo === 'imagen') && (
            <>
              <label>MEDIA</label>
              <input value={selected.layerName || selected.fileName || selected.name || 'IMAGE'} onChange={(event) => onPatch({ layerName: event.target.value })} />
              <p className="dc-help">{selected.mediaKind === 'gif' ? 'ANIMATED GIF // LIVE IN OBS' : 'IMAGE LAYER'}{selected.naturalWidth && selected.naturalHeight ? ` // ${selected.naturalWidth}×${selected.naturalHeight}` : ''}</p>
            </>
          )}

          <label>X / Y</label>
          <div className="dc-grid">
            <NumberField value={selected.x} onChange={(x) => onPatch({ x })} />
            <NumberField value={selected.y} onChange={(y) => onPatch({ y })} />
          </div>

          {selected.w != null && (
            <>
              <label>WIDTH / HEIGHT</label>
              <div className="dc-grid">
                <NumberField min="8" value={selected.w} onChange={(w) => onPatch({ w: Math.max(8, w) })} />
                <NumberField min="8" value={selected.h} onChange={(h) => onPatch({ h: Math.max(8, h) })} />
              </div>
            </>
          )}

          <label className="dc-check-row">
            <span>VISIBLE</span>
            <input type="checkbox" checked={!selected.hidden} onChange={(event) => onPatch({ hidden: !event.target.checked })} />
          </label>

          <button className="dc-danger-wide" onClick={onDelete}>DELETE LAYER</button>
        </section>
      )}
    </aside>
  );
}
