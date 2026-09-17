import { Pause, Play } from 'lucide-react';
import { TEXT_FONTS } from '../text/textTool';
import { MAX_TIMER_SECONDS, formatSecondsAsHms, normalizeTimerConfig } from './timerTool';

export default function TimerControls({ selected, config, setConfig, onPatchSelected, onToggle, onAdjust }) {
  const selectedTimer = selected?.tipo === 'timer';
  const value = normalizeTimerConfig(selectedTimer ? selected : config);

  const update = (patch) => {
    if (selectedTimer) onPatchSelected(patch);
    else setConfig((current) => ({ ...current, ...patch }));
  };

  const commitTime = (field, input) => {
    const match = String(input.value).trim().match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) {
      input.value = formatSecondsAsHms(field === 'startSeconds' ? value.startSeconds : value.limitSeconds);
      return;
    }

    const seconds = (Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3]);
    update({ [field]: seconds });
  };

  return (
    <section>
      <h3>TEMPORIZADOR</h3>

      <label>CONTEO</label>
      <select value={value.timerMode} onChange={(event) => {
        const timerMode = event.target.value;
        if (selectedTimer) update({ timerMode });
        else update({ timerMode, limitSeconds: timerMode === 'down' ? Math.min(value.startSeconds, value.limitSeconds) : Math.max(value.startSeconds, value.limitSeconds || MAX_TIMER_SECONDS) });
      }}>
        <option value="up">Hacia arriba</option>
        <option value="down">Cuenta regresiva</option>
      </select>

      <label>TIEMPO INICIAL</label>
      <input key={`start-${selected?.id || 'new'}-${value.startSeconds}`} defaultValue={formatSecondsAsHms(value.startSeconds)} maxLength={8} placeholder="HH:MM:SS" onBlur={(event) => commitTime('startSeconds', event.currentTarget)} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} />

      <label>LÍMITE</label>
      <input key={`limit-${selected?.id || 'new'}-${value.limitSeconds}`} defaultValue={formatSecondsAsHms(value.limitSeconds)} maxLength={8} placeholder="HH:MM:SS" onBlur={(event) => commitTime('limitSeconds', event.currentTarget)} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} />

      <div className="dc-timer-actions">
        <button type="button" disabled={!selectedTimer} onClick={() => onAdjust(-5)}>-5s</button>
        <button type="button" disabled={!selectedTimer} onClick={() => onAdjust(-2)}>-2s</button>
        <button type="button" className="primary" disabled={!selectedTimer} onClick={onToggle}>
          {(selected?.timerRunning ?? selected?.running) ? <Pause size={14} /> : <Play size={14} />}
          {(selected?.timerRunning ?? selected?.running) ? 'PAUSAR' : 'INICIAR'}
        </button>
        <button type="button" disabled={!selectedTimer} onClick={() => onAdjust(2)}>+2s</button>
        <button type="button" disabled={!selectedTimer} onClick={() => onAdjust(5)}>+5s</button>
      </div>

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

      <p className="dc-help">Haz clic en el lienzo para crear el temporizador. El tiempo queda sincronizado sin enviar actualizaciones cada segundo.</p>
    </section>
  );
}
