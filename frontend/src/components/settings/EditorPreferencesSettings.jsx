import { RotateCcw, Save } from 'lucide-react';
import { normalizeEditorPreferences } from '../editor/editorDefaults';
import { BRUSH_PRESETS } from '../editor/tools/drawing/drawingTool';
import { SHAPE_TYPES } from '../editor/tools/shapes/shapeTool';
import { TEXT_FONTS } from '../editor/tools/text/textTool';
import { formatSecondsAsHms, parseHmsToSeconds } from '../editor/tools/timer/timerTool';

const fieldClass = 'w-full border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 py-[10px] text-[var(--dc-text)] outline-none focus:border-[var(--dc-accent)]';
const labelClass = 'grid gap-1.5 text-sm font-bold';

function ColorField({ label, value, onChange }) {
  return <label className={labelClass}>{label}<div className="flex items-center gap-2"><input className="h-10 w-14 cursor-pointer border border-[var(--dc-input-border)] bg-transparent p-1" type="color" value={value} onChange={(event) => onChange(event.target.value)} /><code className="flex h-10 flex-1 items-center border border-[var(--dc-input-border)] bg-[var(--dc-button-secondary-bg)] px-3 text-sm uppercase text-[var(--dc-text-muted)]">{value}</code></div></label>;
}

function RangeField({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return <label className={labelClass}><span>{label} <b className="text-[var(--dc-accent)]">{step < 1 ? Math.round(value * 100) : value}{suffix}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Card({ title, description, children }) {
  return <section className="bg-[var(--dc-panel)] p-5 shadow-[0_8px_24px_var(--dc-shadow-soft)]"><div className="mb-5"><h3 className="m-0 font-['Bebas_Neue'] text-[1.3rem] font-normal uppercase leading-none tracking-[.025em] text-[var(--dc-text-muted)]">{title}</h3><p className="mt-1 text-[13px] text-[var(--dc-text-muted)]">{description}</p></div><div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div></section>;
}

export default function EditorPreferencesSettings({ value, onChange, onSave, onReset, saving }) {
  const preferences = normalizeEditorPreferences(value);
  const patch = (section, next) => onChange({ ...preferences, [section]: { ...preferences[section], ...next } });

  return <div className="grid gap-[18px]">
    <div className="flex flex-col justify-between gap-3 bg-[var(--dc-surface-raised)] p-4 md:flex-row md:items-center"><div className="order-2 text-right md:order-2"><strong className="block">Predeterminados de herramientas</strong><span className="text-sm text-[var(--dc-text-muted)]">Se aplican al crear elementos nuevos. Nunca se guardan dentro de un diseño ni modifican capas que ya existen.</span></div><div className="order-1 flex shrink-0 flex-wrap gap-2"><button className="inline-flex items-center gap-2 border border-[var(--dc-button-secondary-border)] bg-[var(--dc-button-secondary-bg)] px-3.5 py-2.5 text-sm font-bold" onClick={onReset} disabled={saving}><RotateCcw size={15} /> Restaurar</button><button className="inline-flex items-center gap-2 border border-[var(--dc-button-primary-border)] bg-[var(--dc-button-primary-bg)] px-3.5 py-2.5 text-sm font-bold text-[var(--dc-button-primary-text)] disabled:opacity-50" onClick={onSave} disabled={saving}><Save size={15} /> {saving ? 'Guardando…' : 'Guardar configuración'}</button></div></div>

    <Card title="Dibujo" description="Valores que recibe el pincel cuando abres una nueva sesión del editor.">
      <label className={labelClass}>Pincel<select className={fieldClass} value={preferences.drawing.brush} onChange={(event) => patch('drawing', { brush: event.target.value })}>{BRUSH_PRESETS.map((brush) => <option key={brush.value} value={brush.value}>{brush.label}</option>)}</select></label>
      <ColorField label="Color" value={preferences.drawing.color} onChange={(color) => patch('drawing', { color })} />
      <RangeField label="Tamaño" value={preferences.drawing.size} min={2} max={100} suffix=" px" onChange={(size) => patch('drawing', { size })} />
      <RangeField label="Opacidad" value={preferences.drawing.opacity} min={0.05} max={1} step={0.01} suffix="%" onChange={(opacity) => patch('drawing', { opacity })} />
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
      <ColorField label="Color del borde" value={preferences.timer.strokeColor} onChange={(strokeColor) => patch('timer', { strokeColor })} />
      <RangeField label="Grosor del borde" value={preferences.timer.strokeWidth} min={0} max={24} suffix=" px" onChange={(strokeWidth) => patch('timer', { strokeWidth })} />
      <RangeField label="Tamaño" value={preferences.timer.fontSize} min={5} max={400} suffix=" px" onChange={(fontSize) => patch('timer', { fontSize })} />
    </Card>

  </div>;
}
