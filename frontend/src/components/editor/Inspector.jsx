import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Group, Maximize2, Minimize2, Move, RotateCcw, Ungroup, X } from 'lucide-react';
import ImagePanel from './ImagePanel';
import TextControls from './tools/text/TextControls';
import TimerControls from './tools/timer/TimerControls';
import DrawingControls from './tools/drawing/DrawingControls';
import { DEFAULT_SHAPE_CONFIG, SHAPE_TYPES } from './tools/shapes/shapeTool';

const PROPERTY_MODE_KEY = 'drawcast.editor.properties.mode';
const PROPERTY_POSITION_KEY = 'drawcast.editor.properties.position';
const DEFAULT_PROPERTY_POSITION = { x: 18, y: 18 };

function readPropertyPosition() {
  try {
    const value = JSON.parse(localStorage.getItem(PROPERTY_POSITION_KEY) || 'null');
    if (Number.isFinite(value?.x) && Number.isFinite(value?.y)) return value;
  } catch { /* noop */ }
  return DEFAULT_PROPERTY_POSITION;
}
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
  open = false,
  anchor = null,
  onClose,
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
    if (anchor?.requestId) return false;
    try { return localStorage.getItem(PROPERTY_MODE_KEY) === 'compact'; } catch { return false; }
  });
  const [position, setPosition] = useState(readPropertyPosition);
  const [revealed, setRevealed] = useState(false);
  const [layerNameDraft, setLayerNameDraft] = useState('');
  const previousToolRef = useRef(tool);
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const layerNameEditingRef = useRef(false);

  const clampPosition = useCallback((x, y) => {
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!panel || !parent) return { x: Math.max(8, x), y: Math.max(8, y) };

    const maxX = Math.max(8, parent.clientWidth - panel.offsetWidth - 8);
    const maxY = Math.max(8, parent.clientHeight - panel.offsetHeight - 52);
    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(8, y), maxY)
    };
  }, []);
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
  const selectedLayerName = selected ? String(selected.layerName ?? selected.fileName ?? selected.name ?? selected.tipo ?? 'CAPA') : '';

  useEffect(() => {
    if (!layerNameEditingRef.current) setLayerNameDraft(selectedLayerName);
  }, [selected?.id, selectedLayerName]);

  useEffect(() => {
    if (previousToolRef.current !== tool) {
      previousToolRef.current = tool;
      setCompact(false);
    }
  }, [tool]);

  useEffect(() => {
    try { localStorage.setItem(PROPERTY_MODE_KEY, compact ? 'compact' : 'expanded'); } catch { /* noop */ }
  }, [compact]);

  useEffect(() => {
    try { localStorage.setItem(PROPERTY_POSITION_KEY, JSON.stringify(position)); } catch { /* noop */ }
  }, [position]);

  useEffect(() => {
    if (!open) return undefined;

    let measureFrame;
    let revealFrame;
    const prepareFrame = window.requestAnimationFrame(() => {
      if (anchor?.requestId) setCompact(false);

      measureFrame = window.requestAnimationFrame(() => {
        const panel = panelRef.current;
        const parent = panel?.parentElement;
        if (!panel || !parent) return;

        if (anchor?.requestId) {
          const parentBounds = parent.getBoundingClientRect();
          const cursorX = anchor.clientX - parentBounds.left;
          const cursorY = anchor.clientY - parentBounds.top;
          const gap = 14;
          const bottomReserve = 52;
          const panelWidth = panel.offsetWidth || 310;
          const panelHeight = panel.offsetHeight || 260;

          let x = cursorX + gap;
          let y = cursorY + gap;
          if (x + panelWidth > parent.clientWidth - 8) x = cursorX - panelWidth - gap;
          if (y + panelHeight > parent.clientHeight - bottomReserve) y = cursorY - panelHeight - gap;
          setPosition(clampPosition(x, y));
        } else {
          setPosition((current) => clampPosition(current.x, current.y));
        }

        revealFrame = window.requestAnimationFrame(() => setRevealed(true));
      });
    });

    return () => {
      window.cancelAnimationFrame(prepareFrame);
      if (measureFrame) window.cancelAnimationFrame(measureFrame);
      if (revealFrame) window.cancelAnimationFrame(revealFrame);
    };
  }, [open, anchor?.requestId, anchor?.clientX, anchor?.clientY, clampPosition]);

  useEffect(() => {
    if (!open) return undefined;
    const keepInsideWorkspace = () => setPosition((current) => clampPosition(current.x, current.y));
    window.addEventListener('resize', keepInsideWorkspace);
    return () => window.removeEventListener('resize', keepInsideWorkspace);
  }, [open, compact, clampPosition]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape' || document.querySelector('.dc-system-alert-backdrop')) return;
      onClose?.();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  const startDrag = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    dragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: position.x, y: position.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(clampPosition(drag.x + event.clientX - drag.clientX, drag.y + event.clientY - drag.clientY));
  };

  const endDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const resetPosition = () => setPosition(clampPosition(DEFAULT_PROPERTY_POSITION.x, DEFAULT_PROPERTY_POSITION.y));

  const commitLayerName = () => {
    layerNameEditingRef.current = false;
    if (!selected || layerNameDraft === selectedLayerName) return;
    onPatch({ layerName: layerNameDraft });
  };

  const cancelLayerName = () => {
    layerNameEditingRef.current = false;
    setLayerNameDraft(selectedLayerName);
  };

  const shapeValue = (canonical, legacy) => {
    if (isShape) return selected[canonical] ?? selected[legacy] ?? DEFAULT_SHAPE_CONFIG[canonical];
    return shapeConfig[canonical];
  };

  const updateShape = (patch) => {
    setShapeConfig((current) => ({ ...current, ...patch }));
    if (isShape) onPatch(patch);
  };

  if (!open) return null;

  return (
    <aside ref={panelRef} className={`dc-inspector dc-inspector-floating ${compact ? 'is-compact' : ''} ${revealed ? 'is-visible' : 'is-positioning'}`} style={{ left: position.x, top: position.y }}>
      <header className="dc-inspector-head" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} title="Arrastra para mover las propiedades">
        <div className="dc-inspector-title">
          <Move size={13} className="dc-inspector-drag-icon" aria-hidden="true" />
          <span>Propiedades</span>
          <small>· {TOOL_NAMES[tool] || 'Herramienta'}{selected ? ` · ${selected.layerName || selected.name || selected.tipo || 'capa'}` : ''}</small>
        </div>
        <div className="dc-inspector-actions">
          <button type="button" className="dc-inspector-toggle" onClick={resetPosition} title="Restablecer posición" aria-label="Restablecer posición">
            <RotateCcw size={13} />
          </button>
          <button type="button" className="dc-inspector-toggle" onClick={() => setCompact((value) => !value)} title={compact ? 'Mostrar propiedades' : 'Compactar propiedades'} aria-label={compact ? 'Mostrar propiedades' : 'Compactar propiedades'}>
            {compact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button type="button" className="dc-inspector-toggle" onClick={onClose} title="Cerrar propiedades" aria-label="Cerrar propiedades">
            <X size={14} />
          </button>
        </div>
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
            <p className="dc-help">Mueve, redimensiona o rota toda la selección desde el cuadro exterior. Shift ajusta la rotación en pasos de 15°.</p>
            <div className="dc-selection-grid">
              {canGroup && <button type="button" onClick={onGroup}><Group size={14} /> AGRUPAR</button>}
              {selectedGroupCount > 0 && <button type="button" onClick={onUngroup}><Ungroup size={14} /> DESAGRUPAR</button>}
              <button type="button" onClick={onDuplicate}><Copy size={14} /> DUPLICAR</button>
            </div>
            <button className="dc-danger-wide" onClick={onDelete}>ELIMINAR {selectionCount} CAPAS</button>
            <p className="dc-help">Ctrl/Cmd + clic agrega capas a la selección. Ctrl/Cmd + G agrupa y Ctrl/Cmd + Shift + G desagrupa.</p>
          </section>
        )}

        {!selected && !isMulti && !showShapePanel && !showImagePanel && !showTextPanel && !showTimerPanel && tool !== 'draw' && tool !== 'eraser' && <p className="dc-inspector-empty text-[var(--dc-muted)]">Selecciona una capa para ver sus propiedades.</p>}

        {selected && (
          <section>
            <h3>CAPA // POSICIÓN Y TAMAÑO</h3>

            <label>NOMBRE DE LA CAPA</label>
            <input
              value={layerNameDraft}
              onFocus={() => { layerNameEditingRef.current = true; }}
              onChange={(event) => setLayerNameDraft(event.target.value)}
              onBlur={commitLayerName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelLayerName();
                  event.currentTarget.blur();
                }
              }}
            />

            {isImage && <p className="dc-help">{selected.mediaKind === 'gif' ? 'GIF animado, se reproduce directo en OBS.' : 'Capa de imagen.'}{selected.naturalWidth && selected.naturalHeight ? ` Tamaño original: ${selected.naturalWidth}×${selected.naturalHeight}.` : ''}</p>}

            <label>POSICIÓN X / Y</label>
            <div className="grid grid-cols-2 gap-1.5">
              <NumberField value={selected.x} onChange={(x) => onPatch({ x })} />
              <NumberField value={selected.y} onChange={(y) => onPatch({ y })} />
            </div>

            {selected.w != null && (
              <>
                <label>ANCHO / ALTO</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <NumberField min="8" value={selected.w} onChange={(w) => onPatch({ w: Math.max(8, w) })} />
                  <NumberField min="8" value={selected.h} onChange={(h) => onPatch({ h: Math.max(8, h) })} />
                </div>
              </>
            )}

            <label>ROTACIÓN °</label>
            <NumberField value={selected.rotation || 0} onChange={(rotation) => onPatch({ rotation })} />

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
