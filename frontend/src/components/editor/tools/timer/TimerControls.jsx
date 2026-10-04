import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { TEXT_FONTS } from '../text/textTool';
import {
  MAX_TIMER_SECONDS,
  formatSecondsAsHms,
  getTimerCurrentSeconds,
  normalizeTimerConfig,
  timerHasReachedEnd
} from './timerTool';

const QUICK_ADJUSTMENTS = [
  { seconds: 5, label: '5s' },
  { seconds: 60, label: '1m' },
  { seconds: 300, label: '5m' },
  { seconds: 600, label: '10m' },
  { seconds: 1800, label: '30m' },
  { seconds: 3600, label: '60m' }
];

export default function TimerControls({ selected, config, setConfig, onPatchSelected, onToggle, onAdjust, onRestart }) {
  const selectedTimer = selected?.tipo === 'timer';
  const value = normalizeTimerConfig(selectedTimer ? selected : config);
  const running = Boolean(selected?.timerRunning ?? selected?.running);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const currentSeconds = selectedTimer ? getTimerCurrentSeconds(selected, nowMs) : value.startSeconds;
  const finished = selectedTimer && timerHasReachedEnd(selected, nowMs);

  useEffect(() => {
    setNowMs(Date.now());
    if (!selectedTimer || !running || finished) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [selectedTimer, selected?.id, selected?.startedAtMs, selected?.timerResumeSeconds, selected?.timerRunning, running, finished]);

  const update = (patch) => {
    setConfig((current) => ({ ...current, ...patch }));
    if (selectedTimer) onPatchSelected(patch);
  };

  const setMode = (timerMode) => {
    if (timerMode === value.timerMode) return;
    if (timerMode === 'down' && value.startSeconds === 0 && value.limitSeconds === MAX_TIMER_SECONDS) {
      update({ timerMode, startSeconds: 300, limitSeconds: 0 });
      return;
    }
    update({ timerMode, startSeconds: value.limitSeconds, limitSeconds: value.startSeconds });
  };

  const commitTime = (field, input) => {
    const match = String(input.value).trim().match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) {
      input.value = formatSecondsAsHms(field === 'startSeconds' ? value.startSeconds : value.limitSeconds);
      return;
    }

    const seconds = Math.min(MAX_TIMER_SECONDS, (Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3]));
    update({ [field]: seconds });
  };

  return (
    <section className="dc-timer-panel">
      <div className="dc-timer-panel-head">
        <h3>TEMPORIZADOR</h3>
        <span className={`dc-timer-status ${finished ? 'is-finished' : running ? 'is-running' : ''}`}>
          {selectedTimer ? (finished ? 'FINALIZADO' : running ? 'EN MARCHA' : 'PAUSADO') : 'NUEVO'}
        </span>
      </div>

      <div className={`dc-timer-readout ${finished ? 'is-finished' : ''}`} style={finished ? { '--dc-timer-finish': value.finishColor } : undefined}>
        {formatSecondsAsHms(currentSeconds)}
      </div>

      <div className="dc-timer-mode" role="group" aria-label="Tipo de conteo">
        <button type="button" className={value.timerMode === 'down' ? 'active' : ''} onClick={() => setMode('down')}>REGRESIVA</button>
        <button type="button" className={value.timerMode === 'up' ? 'active' : ''} onClick={() => setMode('up')}>HACIA ARRIBA</button>
      </div>

      <div className="dc-timer-time-grid">
        <label>INICIO
          <input key={`start-${selected?.id || 'new'}-${value.startSeconds}`} defaultValue={formatSecondsAsHms(value.startSeconds)} maxLength={8} inputMode="numeric" placeholder="HH:MM:SS" onBlur={(event) => commitTime('startSeconds', event.currentTarget)} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} />
        </label>
        <label>FINAL
          <input key={`limit-${selected?.id || 'new'}-${value.limitSeconds}`} defaultValue={formatSecondsAsHms(value.limitSeconds)} maxLength={8} inputMode="numeric" placeholder="HH:MM:SS" onBlur={(event) => commitTime('limitSeconds', event.currentTarget)} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} />
        </label>
      </div>

      <div className="dc-timer-transport">
        <button type="button" className="primary" disabled={!selectedTimer} onClick={onToggle}>
          {running ? <Pause size={15} /> : <Play size={15} />}
          {running ? 'PAUSAR' : finished ? 'REINICIAR' : 'INICIAR'}
        </button>
        <button type="button" disabled={!selectedTimer} onClick={onRestart}><RotateCcw size={15} /> REINICIAR</button>
      </div>

      <div className="dc-timer-quick">
        <span>AJUSTE RÁPIDO</span>
        <div className="dc-timer-quick-grid">
          {QUICK_ADJUSTMENTS.map(({ seconds, label }) => (
            <div className="dc-timer-quick-pair" key={seconds}>
              <button type="button" disabled={!selectedTimer} onClick={() => onAdjust(-seconds)}>−{label}</button>
              <button type="button" disabled={!selectedTimer} onClick={() => onAdjust(seconds)}>+{label}</button>
            </div>
          ))}
        </div>
      </div>

      <div className="dc-timer-appearance">
        <div className="dc-timer-section-label">APARIENCIA</div>
        <div className="dc-timer-appearance-body">
          <label>FUENTE
            <select value={value.fontKey} onChange={(event) => update({ fontKey: event.target.value, fontFamily: TEXT_FONTS.find((font) => font.key === event.target.value)?.family })}>
              {TEXT_FONTS.map((font) => <option key={font.key} value={font.key}>{font.label}</option>)}
            </select>
          </label>

          <div className="dc-timer-color-grid">
            <label>COLOR<input type="color" value={value.color} onChange={(event) => update({ color: event.target.value })} /></label>
            <label>AL FINALIZAR<input type="color" value={value.finishColor} onChange={(event) => update({ finishColor: event.target.value })} /></label>
            <label>BORDE<input type="color" value={value.strokeColor} onChange={(event) => update({ strokeColor: event.target.value })} /></label>
          </div>

          <label>GROSOR DEL BORDE <b>{value.strokeWidth}</b></label>
          <input type="range" min="0" max="24" value={value.strokeWidth} onChange={(event) => update({ strokeWidth: Number(event.target.value) })} />

          <label>TAMAÑO <b>{value.fontSize}</b></label>
          <input type="range" min="5" max="400" value={value.fontSize} onChange={(event) => update({ fontSize: Number(event.target.value) })} />
          <small className="dc-timer-size-hint">También puedes cambiarlo arrastrando los controles del objeto en el lienzo.</small>
        </div>
      </div>

      <p className="dc-help">El conteo usa tiempo real: cambiar de pestaña o perder FPS no lo pausa. Sólo se detiene con PAUSAR.</p>
    </section>
  );
}
