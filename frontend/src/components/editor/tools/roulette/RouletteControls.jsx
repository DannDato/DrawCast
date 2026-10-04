import { useEffect, useState } from 'react';
import { Play, Shuffle, Square, Trash2, Volume2, VolumeX } from 'lucide-react';
import { normalizeRouletteConfig, rouletteColors, rouletteEntries, rouletteIsAnimating, rouletteReleaseMultiplier, rouletteWinnerAtRotation } from './rouletteTool';
import '../../../../styles/editor/roulette.css';

export default function RouletteControls({ selected, config, setConfig, onPatchSelected, onSpin, onStop, onShuffle, onRemoveWinner }) {
  const isSelected = selected?.tipo === 'roulette';
  const value = normalizeRouletteConfig(isSelected ? selected : config);
  const entries = rouletteEntries(value.entriesText);
  const wheelColors = rouletteColors(value).slice(0, 3);
  const baseColor = value.baseColor || wheelColors[0] || '#6C63FF';
  const [now, setNow] = useState(() => Date.now());
  const spinning = isSelected && rouletteIsAnimating(selected, now);
  const winner = isSelected && !spinning ? rouletteWinnerAtRotation(selected) : null;
  const resultVisible = Boolean(winner);

  useEffect(() => {
    if (!isSelected || !rouletteIsAnimating(selected, Date.now())) return undefined;
    const timer = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (!rouletteIsAnimating(selected, nextNow)) window.clearInterval(timer);
    }, 160);
    return () => window.clearInterval(timer);
  }, [isSelected, selected?.rouletteSpinSerial, selected?.rouletteStartedAtMs]);

  const update = (patch) => {
    setConfig?.((current) => ({ ...current, ...patch }));
    if (isSelected) {
      const entriesChanging = Object.prototype.hasOwnProperty.call(patch, 'entriesText');
      onPatchSelected?.(entriesChanging ? { ...patch, rouletteRunning: false, rouletteWinnerIndex: null, rouletteWinnerText: '', rouletteStartedAtMs: null, rouletteSpinDurationMs: null } : patch);
    }
  };

  return (
    <section className="dc-roulette-controls">
      {isSelected && (
        <div className={`dc-roulette-primary-actions ${spinning ? 'is-spinning' : ''}`}>
          <button type="button" className="dc-roulette-spin" onClick={() => { setNow(Date.now()); onSpin?.(); }} disabled={entries.length < 2 || spinning}><Play size={15} /> {spinning ? 'Girando…' : 'Girar ruleta'}</button>
          {spinning && <button type="button" className="dc-roulette-stop" onClick={() => { setNow(Date.now()); onStop?.(); }}><Square size={14} /> Cancelar</button>}
          <button
            type="button"
            className={`dc-roulette-mute ${value.rouletteMuted ? 'is-muted' : ''}`}
            onClick={() => update({ rouletteMuted: !value.rouletteMuted })}
            aria-pressed={value.rouletteMuted}
            title={value.rouletteMuted ? 'Activar sonido de ruleta' : 'Mutear ruleta'}
          >
            {value.rouletteMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            {value.rouletteMuted ? 'Sin sonido' : 'Sonido'}
          </button>
        </div>
      )}

      <label>Opciones · una por línea</label>
      <textarea
        className="dc-roulette-entries"
        rows="8"
        value={value.entriesText}
        spellCheck="false"
        disabled={spinning}
        onChange={(event) => update({ entriesText: event.target.value })}
        placeholder={'Opción 1\nOpción 2\nOpción 3'}
      />

      <div className="dc-roulette-toolbar">
        <button type="button" onClick={() => onShuffle?.()} disabled={!isSelected || entries.length < 2 || spinning}><Shuffle size={14} /> Mezclar</button>
        <span>{entries.length}/100</span>
      </div>

      <div className="dc-roulette-sliders">
        <label>Velocidad <b>{value.spinSpeed.toFixed(1)}x</b></label>
        <input type="range" min="0.5" max="3.5" step="0.1" value={value.spinSpeed} onChange={(event) => update({ spinSpeed: Number(event.target.value) })} />
        <label>Sustain <b>{(value.spinDurationMs / 1000).toFixed(1)}s</b></label>
        <input type="range" min="2000" max="30000" step="250" value={value.spinDurationMs} onChange={(event) => update({ spinDurationMs: Number(event.target.value) })} />
        <span className="dc-roulette-micro-help">Mantiene la velocidad.</span>
        <label>Release final <b>{Math.round(value.spinDecay * 100)}%</b></label>
        <input type="range" min="0.10" max="0.90" step="0.01" value={value.spinDecay} onChange={(event) => update({ spinDecay: Number(event.target.value) })} />
        <span className="dc-roulette-micro-help">Cola {rouletteReleaseMultiplier(value.spinDecay).toFixed(2)}×.</span>
      </div>

      <div className="dc-roulette-palette-control">
        <label>Color base<input type="color" value={baseColor} onChange={(event) => update({ baseColor: event.target.value })} /></label>
        <div className="dc-roulette-palette-preview" aria-label="Paleta automática">
          {wheelColors.map((color) => <span key={color} style={{ background: color }} title={color} />)}
        </div>
      </div>

      <div className="dc-roulette-colors">
        <label>Color de texto<input type="color" value={value.textColor} onChange={(event) => update({ textColor: event.target.value })} /></label>
        <label>Centro<input type="color" value={value.centerColor} onChange={(event) => update({ centerColor: event.target.value })} /></label>
        <label>Puntero<input type="color" value={value.pointerColor} onChange={(event) => update({ pointerColor: event.target.value })} /></label>
      </div>

      {isSelected ? (
        resultVisible && (
          <div className="dc-roulette-result">
            <span>Resultado</span>
            <strong>{winner?.text}</strong>
            <button type="button" className="dc-roulette-remove-winner" onClick={() => onRemoveWinner?.()} disabled={entries.length <= 2} title={entries.length <= 2 ? 'La ruleta necesita al menos 2 opciones' : 'Eliminar la opción ganadora'}><Trash2 size={14} /> {entries.length <= 2 ? 'Mínimo 2 opciones' : 'Eliminar opción'}</button>
          </div>
        )
      ) : <p className="dc-help">Arrastra en el lienzo para dibujarla. Después selecciónala y pulsa “Girar ruleta”.</p>}
    </section>
  );
}
