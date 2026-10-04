import { RotateCcw, Save } from 'lucide-react';
import { normalizeEditorPreferences } from '../editor/editorDefaults';
import { BRUSH_PRESETS } from '../editor/tools/drawing/drawingTool';
import { SHAPE_TYPES } from '../editor/tools/shapes/shapeTool';
import { TEXT_FONTS } from '../editor/tools/text/textTool';
import { formatSecondsAsHms, parseHmsToSeconds } from '../editor/tools/timer/timerTool';
import { rouletteReleaseMultiplier } from '../editor/tools/roulette/rouletteTool';
import { roulettePaletteFromColor } from '../editor/tools/roulette/rouletteTheme';

const fieldClass = 'w-full border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[10px] text-[var(--dc-text)] outline-none focus:border-[var(--dc-accent-three)]';
const labelClass = 'grid gap-1.5 text-sm font-bold';

function ColorField({ label, value, onChange }) {
  return <label className={labelClass}>{label}<div className="flex items-center gap-2"><input className="h-10 w-14 cursor-pointer border border-[var(--dc-input-border)] bg-transparent p-1" type="color" value={value} onChange={(event) => onChange(event.target.value)} /><code className="flex h-10 flex-1 items-center border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 text-sm uppercase text-[var(--dc-text-muted)]">{value}</code></div></label>;
}

function RangeField({ label, value, min, max, step = 1, suffix = '', displayValue, onChange }) {
  const shown = displayValue ?? (step < 1 ? Math.round(value * 100) : value);
  return <label className={labelClass}><span>{label} <b className="text-[var(--dc-accent-four)]">{shown}{suffix}</b></span><input className="dc-settings-range" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Card({ title, description, children }) {
  return <section className="border border-[var(--dc-line-soft)] bg-[var(--dc-surface-1)] p-4"><div className="mb-4"><h3 className="m-0 font-['Bebas_Neue'] text-[1.3rem] font-normal uppercase leading-none tracking-[.025em] text-[var(--dc-text-muted)]">{title}</h3><p className="mt-1 text-[13px] text-[var(--dc-text-muted)]">{description}</p></div><div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div></section>;
}

export default function EditorPreferencesSettings({ value, onChange, onSave, onReset, saving }) {
  const preferences = normalizeEditorPreferences(value);
  const patch = (section, next) => onChange({ ...preferences, [section]: { ...preferences[section], ...next } });

  return <div className="dc-editor-preferences grid gap-[14px]">
    <div className="flex flex-col justify-between gap-3 bg-[var(--dc-surface-raised)] p-4 md:flex-row md:items-center"><div className="order-2 text-right md:order-2"><strong className="block">Preferencias recordadas</strong><span className="text-sm text-[var(--dc-text-muted)]">TRAZIO aprende automáticamente los últimos ajustes que usas en cada herramienta. Aquí puedes revisarlos, cambiarlos o restaurarlos.</span></div><div className="order-1 flex shrink-0 flex-wrap gap-2"><button className="inline-flex items-center gap-2 border border-[var(--dc-button-secondary-border)] bg-[var(--dc-button-secondary-bg)] px-3.5 py-2.5 text-sm font-bold" onClick={onReset} disabled={saving}><RotateCcw size={15} /> Restaurar</button><button className="inline-flex items-center gap-2 border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 py-2.5 text-sm font-bold text-[var(--dc-button-primary-text)] disabled:opacity-50" onClick={onSave} disabled={saving}><Save size={15} /> {saving ? 'Guardando…' : 'Guardar configuración'}</button></div></div>

    <Card title="Dibujo" description="Valores que recibe el pincel cuando abres una nueva sesión del editor.">
      <label className={labelClass}>Pincel<select className={fieldClass} value={preferences.drawing.brush} onChange={(event) => patch('drawing', { brush: event.target.value })}>{BRUSH_PRESETS.map((brush) => <option key={brush.value} value={brush.value}>{brush.label}</option>)}</select></label>
      <ColorField label="Color" value={preferences.drawing.color} onChange={(color) => patch('drawing', { color })} />
      <RangeField label="Tamaño" value={preferences.drawing.size} min={2} max={100} suffix=" px" onChange={(size) => patch('drawing', { size })} />
      <RangeField label="Opacidad" value={preferences.drawing.opacity} min={0.05} max={1} step={0.01} suffix="%" onChange={(opacity) => patch('drawing', { opacity })} />
    </Card>

    <Card title="Línea" description="Color y grosor que TRAZIO recuerda para la próxima línea.">
      <ColorField label="Color" value={preferences.line.strokeColor} onChange={(strokeColor) => patch('line', { strokeColor })} />
      <RangeField label="Grosor" value={preferences.line.strokeWidth} min={1} max={64} suffix=" px" onChange={(strokeWidth) => patch('line', { strokeWidth })} />
    </Card>

    <Card title="Formas" description="Tipo y apariencia inicial de las formas nuevas.">
      <label className={labelClass}>Forma<select className={fieldClass} value={preferences.shape.shapeType} onChange={(event) => patch('shape', { shapeType: event.target.value })}>{SHAPE_TYPES.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}</select></label>
      <RangeField label="Esquinas redondeadas" value={preferences.shape.borderRadius} min={0} max={200} suffix=" px" onChange={(borderRadius) => patch('shape', { borderRadius })} />
      <ColorField label="Relleno" value={preferences.shape.fillColor} onChange={(fillColor) => patch('shape', { fillColor })} />
      <ColorField label="Borde" value={preferences.shape.strokeColor} onChange={(strokeColor) => patch('shape', { strokeColor })} />
      <RangeField label="Grosor del borde" value={preferences.shape.strokeWidth} min={0} max={24} suffix=" px" onChange={(strokeWidth) => patch('shape', { strokeWidth })} />
    </Card>

    <Card title="Imágenes y GIF" description="Apariencia inicial al subir, importar o soltar una imagen.">
      <RangeField label="Esquinas redondeadas" value={preferences.image.borderRadius} min={0} max={300} suffix=" px" onChange={(borderRadius) => patch('image', { borderRadius })} />
      <RangeField label="Opacidad" value={preferences.image.opacity} min={0} max={1} step={0.01} suffix="%" onChange={(opacity) => patch('image', { opacity })} />
    </Card>

    <Card title="Texto" description="Tipografía y apariencia que se usan al crear una capa de texto.">
      <label className={labelClass}>Fuente<select className={fieldClass} value={preferences.text.fontKey} onChange={(event) => patch('text', { fontKey: event.target.value })}>{TEXT_FONTS.map((font) => <option key={font.key} value={font.key}>{font.label}</option>)}</select></label>
      <RangeField label="Tamaño" value={preferences.text.fontSize} min={5} max={400} suffix=" px" onChange={(fontSize) => patch('text', { fontSize })} />
      <ColorField label="Color" value={preferences.text.color} onChange={(color) => patch('text', { color })} />
      <ColorField label="Color del borde" value={preferences.text.strokeColor} onChange={(strokeColor) => patch('text', { strokeColor })} />
      <RangeField label="Grosor del borde" value={preferences.text.strokeWidth} min={0} max={24} suffix=" px" onChange={(strokeWidth) => patch('text', { strokeWidth })} />
    </Card>

    <Card title="Temporizador" description="Valores iniciales del temporizador antes de colocarlo en el lienzo.">
      <label className={labelClass}>Conteo<select className={fieldClass} value={preferences.timer.timerMode} onChange={(event) => patch('timer', { timerMode: event.target.value })}><option value="up">Hacia arriba</option><option value="down">Cuenta regresiva</option></select></label>
      <label className={labelClass}>Fuente<select className={fieldClass} value={preferences.timer.fontKey} onChange={(event) => patch('timer', { fontKey: event.target.value })}>{TEXT_FONTS.map((font) => <option key={font.key} value={font.key}>{font.label}</option>)}</select></label>
      <label className={labelClass}>Tiempo inicial<input className={fieldClass} key={`start-${preferences.timer.startSeconds}`} defaultValue={formatSecondsAsHms(preferences.timer.startSeconds)} maxLength={8} onBlur={(event) => patch('timer', { startSeconds: parseHmsToSeconds(event.currentTarget.value, preferences.timer.startSeconds) })} /></label>
      <label className={labelClass}>Límite<input className={fieldClass} key={`limit-${preferences.timer.limitSeconds}`} defaultValue={formatSecondsAsHms(preferences.timer.limitSeconds)} maxLength={8} onBlur={(event) => patch('timer', { limitSeconds: parseHmsToSeconds(event.currentTarget.value, preferences.timer.limitSeconds) })} /></label>
      <ColorField label="Color" value={preferences.timer.color} onChange={(color) => patch('timer', { color })} />
      <ColorField label="Color al finalizar" value={preferences.timer.finishColor} onChange={(finishColor) => patch('timer', { finishColor })} />
      <ColorField label="Color del borde" value={preferences.timer.strokeColor} onChange={(strokeColor) => patch('timer', { strokeColor })} />
      <RangeField label="Grosor del borde" value={preferences.timer.strokeWidth} min={0} max={24} suffix=" px" onChange={(strokeWidth) => patch('timer', { strokeWidth })} />
      <RangeField label="Tamaño" value={preferences.timer.fontSize} min={5} max={400} suffix=" px" onChange={(fontSize) => patch('timer', { fontSize })} />
    </Card>

    <Card title="Ruleta" description="Apariencia y física inicial de las ruletas nuevas.">
      <div className="grid gap-2">
        <ColorField label="Color base" value={preferences.roulette.baseColor} onChange={(baseColor) => patch('roulette', { baseColor })} />
        <div className="flex h-8 overflow-hidden border border-[var(--dc-input-border)]" aria-label="Paleta automática de la ruleta">{roulettePaletteFromColor(preferences.roulette.baseColor).map((paletteColor) => <span key={paletteColor} className="flex-1" style={{ background: paletteColor }} title={paletteColor} />)}</div>
      </div>
      <ColorField label="Color de texto" value={preferences.roulette.textColor} onChange={(textColor) => patch('roulette', { textColor })} />
      <ColorField label="Centro" value={preferences.roulette.centerColor} onChange={(centerColor) => patch('roulette', { centerColor })} />
      <ColorField label="Puntero" value={preferences.roulette.pointerColor} onChange={(pointerColor) => patch('roulette', { pointerColor })} />
      <RangeField label="Velocidad" value={preferences.roulette.spinSpeed} min={0.5} max={3.5} step={0.1} displayValue={preferences.roulette.spinSpeed.toFixed(1)} suffix="x" onChange={(spinSpeed) => patch('roulette', { spinSpeed })} />
      <RangeField label="Sustain" value={preferences.roulette.spinDurationMs / 1000} min={2} max={30} step={0.25} displayValue={(preferences.roulette.spinDurationMs / 1000).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')} suffix=" s" onChange={(seconds) => patch('roulette', { spinDurationMs: Math.round(seconds * 1000) })} />
      <label className={labelClass}><span>Release final <b className="text-[var(--dc-accent-four)]">{Math.round(preferences.roulette.spinDecay * 100)}%</b></span><input className="dc-settings-range" type="range" min="0.10" max="0.90" step="0.01" value={preferences.roulette.spinDecay} onChange={(event) => patch('roulette', { spinDecay: Number(event.target.value) })} /><span className="text-[10px] font-normal text-[var(--dc-text-muted)]">Cola {rouletteReleaseMultiplier(preferences.roulette.spinDecay).toFixed(2)}×.</span></label>
    </Card>

  </div>;
}
