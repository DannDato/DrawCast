import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Group, Maximize2, Minimize2, Ungroup } from 'lucide-react';
import ImagePanel from './ImagePanel';
import TextControls from './tools/text/TextControls';
import TimerControls from './tools/timer/TimerControls';
import DrawingControls from './tools/drawing/DrawingControls';
import { DEFAULT_SHAPE_CONFIG, SHAPE_TYPES } from './tools/shapes/shapeTool';

const PROPERTY_MODE_KEY = 'drawcast.editor.properties.mode';
const TOOL_NAMES = {
  select: 'Selección',
  draw: 'Lápiz / pincel',
  eraser: 'Borrador',
  image: 'Imagen / GIF',
  shape: 'Formas',
  text: 'Texto',
  timer: 'Temporizador'
};

function NumberField({ value, onChange, min }) {
  return <input type="number" min={min} value={Math.round(Number(value) || 0)} onChange={(event) => onChange(Number(event.target.value))} />;
}

export default function Inspector({
  tool,
  selected,
  selectedObjects = [],
  selectionCount = 0,
  selectedGroupCount = 0,
  drawConfig,
  setDrawConfig,
  shapeConfig,
  setShapeConfig,
  imageConfig,
  setImageConfig,
  textConfig,
  setTextConfig,
  timerConfig,
  setTimerConfig,
  channelId,
  onUploadFile,
  onImportUrl,
  onPatch,
  onPatchText,
  onPatchTimer,
  onToggleTimer,
  onAdjustTimer,
  onDelete,
  onGroup,
  onUngroup,
  onDuplicate,
  onMoveLayer,
  activeDrawLayer,
  onNewDrawLayer,
  onClearDrawLayer,
  onSelectDraw,
  onSelectEraser
}) {
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem(PROPERTY_MODE_KEY) === 'compact'; } catch { return false; }
  });
  const previousToolRef = useRef(tool);
  const isShape = selected?.tipo === 'shape' || selected?.tipo === 'forma';
  const isImage = selected?.tipo === 'image' || selected?.tipo === 'imagen';
  const isText = selected?.tipo === 'text' || selected?.tipo === 'texto';
  const isTimer = selected?.tipo === 'timer';
  const isMulti = selectionCount > 1;
  const canGroup = selectedObjects.filter((object) => [object?.x, object?.y, object?.w, object?.h].every((value) => Number.isFinite(Number(value)))).length >= 2;
  const showShapePanel = tool === 'shape' || isShape;
  const showImagePanel = tool === 'image' || isImage;
  const showTextPanel = tool === 'text' || isText;
  const showTimerPanel = tool === 'timer' || isTimer;
  const showDrawingPanel = tool === 'draw' || tool === 'eraser';

  useEffect(() => {
    if (previousToolRef.current !== tool) {
      previousToolRef.current = tool;
      setCompact(false);
    }
  }, [tool]);

  useEffect(() => {
    try { localStorage.setItem(PROPERTY_MODE_KEY, compact ? 'compact' : 'expanded'); } catch { /* noop */ }
  }, [compact]);

  const shapeValue = (canonical, legacy) => {
    if (isShape) return selected[canonical] ?? selected[legacy] ?? DEFAULT_SHAPE_CONFIG[canonical];
    return shapeConfig[canonical];
  };

  const updateShape = (patch) => {
    setShapeConfig((current) => ({ ...current, ...patch }));
    if (isShape) onPatch(patch);
  };

  return (
    <aside className={`dc-inspector ${compact ? 'is-compact' : ''}`}>
      <header className="dc-inspector-head">
        <div className="dc-inspector-title">
          <span>Propiedades</span>
          <small>· {TOOL_NAMES[tool] || 'Herramienta'}{selected ? ` · ${selected.layerName || selected.name || selected.tipo || 'capa'}` : ''}</small>
        </div>
        <button type="button" className="dc-inspector-toggle" onClick={() => setCompact((value) => !value)} title={compact ? 'Mostrar propiedades' : 'Compactar propiedades'} aria-label={compact ? 'Mostrar propiedades' : 'Compactar propiedades'}>
          {compact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        </button>
      </header>

      {!compact && <div className="dc-inspector-body">
        {showDrawingPanel && (
          <DrawingControls
            tool={tool}
            config={drawConfig}
            setConfig={setDrawConfig}
            activeLayer={activeDrawLayer}
            onNewLayer={onNewDrawLayer}
            onClearLayer={onClearDrawLayer}
            onSelectDraw={onSelectDraw}
            onSelectEraser={onSelectEraser}
          />
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

        {showTextPanel && (
          <TextControls
            selected={isText ? selected : null}
            config={textConfig}
            setConfig={setTextConfig}
            onPatchSelected={onPatchText}
          />
        )}

        {showShapePanel && (
          <section>
            <h3>FORMAS</h3>
            <label>TIPO</label>
            <select value={shapeValue('shapeType', 'shape')} onChange={(event) => updateShape({ shapeType: event.target.value })}>
              {SHAPE_TYPES.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
            </select>

            <label>RELLENO</label>
            <input type="color" value={shapeValue('fillColor', 'fill')} onChange={(event) => updateShape({ fillColor: event.target.value })} />

            <label>BORDE</label>
            <input type="color" value={shapeValue('strokeColor', 'stroke')} onChange={(event) => updateShape({ strokeColor: event.target.value })} />

            <label>GROSOR DEL BORDE <b>{shapeValue('strokeWidth', 'strokeSize')}</b></label>
            <input type="range" min="0" max="24" value={shapeValue('strokeWidth', 'strokeSize')} onChange={(event) => updateShape({ strokeWidth: Number(event.target.value) })} />

            <label>ESQUINAS REDONDEADAS <b>{shapeValue('borderRadius', 'radius')}</b></label>
            <input type="range" min="0" max="200" value={shapeValue('borderRadius', 'radius')} onChange={(event) => updateShape({ borderRadius: Number(event.target.value) })} />
            <p className="dc-help">Arrastra sobre el lienzo para crear la forma. Shift mantiene la proporción y Alt dibuja desde el centro.</p>
          </section>
        )}

        {showTimerPanel && (
          <TimerControls
            selected={isTimer ? selected : null}
            config={timerConfig}
            setConfig={setTimerConfig}
            onPatchSelected={onPatchTimer}
            onToggle={onToggleTimer}
            onAdjust={onAdjustTimer}
          />
        )}

        {isMulti && tool === 'select' && (
          <section className="dc-multi-selection-panel">
            <h3>{selectionCount} CAPAS SELECCIONADAS</h3>
            <p className="dc-help">Arrastra cualquiera de las capas seleccionadas para moverlas juntas.</p>
            <div className="dc-selection-grid">
              {canGroup && <button type="button" onClick={onGroup}><Group size={14} /> AGRUPAR</button>}
              {selectedGroupCount > 0 && <button type="button" onClick={onUngroup}><Ungroup size={14} /> DESAGRUPAR</button>}
              <button type="button" onClick={onDuplicate}><Copy size={14} /> DUPLICAR</button>
            </div>
            <button className="dc-danger-wide" onClick={onDelete}>ELIMINAR {selectionCount} CAPAS</button>
            <p className="dc-help">Ctrl/Cmd + clic agrega capas a la selección. Ctrl/Cmd + G agrupa y Ctrl/Cmd + Shift + G desagrupa.</p>
          </section>
        )}

        {!selected && !isMulti && !showShapePanel && !showImagePanel && !showTextPanel && !showTimerPanel && tool !== 'draw' && tool !== 'eraser' && <p className="muted dc-inspector-empty">Selecciona una capa para ver sus propiedades.</p>}

        {selected && (
          <section>
            <h3>CAPA // POSICIÓN Y TAMAÑO</h3>

            <label>NOMBRE DE LA CAPA</label>
            <input value={selected.layerName || selected.fileName || selected.name || selected.tipo || 'CAPA'} onChange={(event) => onPatch({ layerName: event.target.value })} />

            {isImage && <p className="dc-help">{selected.mediaKind === 'gif' ? 'GIF animado, se reproduce directo en OBS.' : 'Capa de imagen.'}{selected.naturalWidth && selected.naturalHeight ? ` Tamaño original: ${selected.naturalWidth}×${selected.naturalHeight}.` : ''}</p>}

            <label>POSICIÓN X / Y</label>
            <div className="dc-grid">
              <NumberField value={selected.x} onChange={(x) => onPatch({ x })} />
              <NumberField value={selected.y} onChange={(y) => onPatch({ y })} />
            </div>

            {selected.w != null && (
              <>
                <label>ANCHO / ALTO</label>
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

            <div className="dc-selection-grid three">
              <button type="button" onClick={() => onMoveLayer('up')}><ArrowUp size={14} /> SUBIR</button>
              <button type="button" onClick={() => onMoveLayer('down')}><ArrowDown size={14} /> BAJAR</button>
              <button type="button" onClick={onDuplicate}><Copy size={14} /> DUPLICAR</button>
            </div>

            {selected.groupId && (
              <button type="button" className="dc-secondary-wide" onClick={onUngroup}><Ungroup size={14} /> DESAGRUPAR // {selected.groupName || 'GRUPO'}</button>
            )}

            <button className="dc-danger-wide" onClick={onDelete}>ELIMINAR CAPA</button>
          </section>
        )}
      </div>}
    </aside>
  );
}
