import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Cpu, Gauge, RefreshCw, Server, Wifi, WifiOff } from 'lucide-react';
import { getConnectionDiagnostics } from '../../api/diagnostics';

const MAX_NETWORK_SAMPLES = 18;
const REFRESH_MS = 10000;
const LONG_TASK_WINDOW_MS = 30000;

const TONE_DOT = {
  idle: 'bg-[var(--dc-text-disabled)] text-[var(--dc-text-disabled)]',
  good: 'bg-[var(--dc-success)] text-[var(--dc-success)]',
  warn: 'bg-[var(--dc-warning)] text-[var(--dc-warning)]',
  bad: 'bg-[var(--dc-danger)] text-[var(--dc-danger)]'
};

const VERDICT_TONE = {
  good: 'border-[var(--dc-success-border)] bg-[var(--dc-success-bg)] text-[var(--dc-success)]',
  warn: 'border-[var(--dc-warning-border)] bg-[var(--dc-warning-bg)] text-[var(--dc-warning)]',
  bad: 'border-[var(--dc-danger-border)] bg-[var(--dc-danger-bg)] text-[var(--dc-danger)]'
};

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function jitter(values) {
  if (values.length < 2) return 0;
  const differences = [];
  for (let index = 1; index < values.length; index += 1) differences.push(Math.abs(values[index] - values[index - 1]));
  return average(differences);
}

function formatMs(value) {
  return Number.isFinite(value) ? `${Math.round(value)} ms` : '—';
}

function toneForLatency(latency) {
  if (!Number.isFinite(latency)) return 'idle';
  if (latency <= 80) return 'good';
  if (latency <= 180) return 'warn';
  return 'bad';
}

function toneForEventLoop(value) {
  if (!Number.isFinite(value)) return 'idle';
  if (value <= 35) return 'good';
  if (value <= 80) return 'warn';
  return 'bad';
}

function toneForFps(value) {
  if (!Number.isFinite(value)) return 'idle';
  if (value >= 55) return 'good';
  if (value >= 42) return 'warn';
  return 'bad';
}

function connectionLabel(connection) {
  if (!connection) return 'Sin datos del navegador';
  const parts = [];
  if (connection.effectiveType) parts.push(String(connection.effectiveType).toUpperCase());
  if (Number.isFinite(connection.downlink)) parts.push(`~${connection.downlink} Mbps`);
  return parts.length ? parts.join(' · ') : 'Conexión detectada';
}

function measureFps(duration = 850) {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function' || document.hidden) {
      resolve(null);
      return;
    }
    const startedAt = performance.now();
    let frames = 0;
    let rafId = 0;
    const tick = (now) => {
      frames += 1;
      const elapsed = now - startedAt;
      if (elapsed >= duration) {
        resolve(Math.min(144, Math.round((frames * 1000) / Math.max(1, elapsed))));
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.setTimeout(() => {
      if (performance.now() - startedAt > duration + 500) {
        cancelAnimationFrame(rafId);
        resolve(null);
      }
    }, duration + 550);
  });
}

function Sparkline({ values }) {
  if (values.length < 2) return <div className="mt-2.5 grid h-12 place-items-center border-b border-dashed border-[var(--dc-line-soft)] text-[13px] text-[var(--dc-text-dim)]">Esperando muestras...</div>;
  const width = 260;
  const height = 54;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - 5 - ((value - min) / span) * (height - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="mt-2.5 h-12 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Historial reciente de latencia">
      <polyline className="stroke-[var(--dc-accent-one)] [stroke-width:1.5]" points={points} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function diagnose({ online, failedChecks, latency, jitterMs, server, fps, longTasks }) {
  if (!online) return { tone: 'bad', title: 'Sin conexión a internet', message: 'El navegador reporta que este equipo está desconectado.' };
  if (failedChecks >= 2) return { tone: 'bad', title: 'No podemos alcanzar TRAZIO', message: 'La red local, el proveedor o la ruta hacia el servidor pueden estar fallando.' };

  const serverLoop = server?.eventLoop?.p95Ms;
  const serverLoad = server?.cpu?.loadPercent;
  if ((Number.isFinite(serverLoop) && serverLoop > 80) || (Number.isFinite(serverLoad) && serverLoad > 95)) {
    return { tone: 'bad', title: 'El servidor parece saturado', message: 'Tu conexión llega a TRAZIO, pero el servidor está tardando en atender trabajo interno.' };
  }

  const worstLongTask = longTasks.reduce((max, item) => Math.max(max, item.duration), 0);
  if ((Number.isFinite(fps) && fps < 42) || longTasks.length >= 4 || worstLongTask > 220) {
    return { tone: 'warn', title: 'El navegador está trabajando de más', message: 'La red y el servidor responden, pero este equipo está bloqueando el hilo principal o dibujando pocos frames.' };
  }

  if ((Number.isFinite(latency) && latency > 180) || jitterMs > 60) {
    return { tone: 'warn', title: 'La red se ve inestable', message: 'TRAZIO responde, pero la latencia o su variación son altas. Wi‑Fi, VPN o tu proveedor pueden ser la causa.' };
  }

  return { tone: 'good', title: 'Conexión estable', message: 'Red, navegador y servidor están dentro de rangos normales en esta muestra.' };
}

function DiagnosticCard({ icon, title, tone, primary, primaryLabel, stats, children, accent = 'var(--dc-accent-one)' }) {
  return <article style={{ '--dc-diagnostic-accent': accent }} className="flex min-h-[205px] min-w-0 flex-col bg-[var(--dc-surface-1)] p-3.5 max-[980px]:min-h-0">
    <div className="flex items-center justify-between gap-2.5 text-[var(--dc-muted)]"><span className="inline-flex items-center gap-[7px] font-extrabold text-[var(--dc-text)]"><span className="text-[var(--dc-diagnostic-accent)]">{icon}</span> {title}</span><i className={`h-2 w-2 rounded-full shadow-[0_0_9px_currentColor] ${TONE_DOT[tone] || TONE_DOT.idle}`} /></div>
    <div className="mt-[18px] grid gap-[3px]"><strong className="text-[27px] leading-none text-[var(--dc-diagnostic-accent)]">{primary}</strong><span className="text-[13px] text-[var(--dc-muted)]">{primaryLabel}</span></div>
    <div className="mt-3.5 grid grid-cols-2 gap-[7px] max-[680px]:grid-cols-1">{stats.map(([value, label]) => <span className="grid min-w-0 gap-0.5 border border-[var(--dc-line-soft)] p-2 text-[13px] text-[var(--dc-muted)]" key={label}><b className="truncate text-[13px] text-[var(--dc-text)]">{value}</b>{label}</span>)}</div>
    {children}
  </article>;
}

export default function ConnectionDiagnostics() {
  const [samples, setSamples] = useState([]);
  const [server, setServer] = useState(null);
  const [fps, setFps] = useState(null);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const [failedChecks, setFailedChecks] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [longTasks, setLongTasks] = useState([]);
  const mountedRef = useRef(true);
  const requestRef = useRef(null);

  const runCheck = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    const fpsPromise = measureFps();
    try {
      const next = await getConnectionDiagnostics({ signal: controller.signal });
      if (!mountedRef.current) return;
      setServer(next);
      setSamples((current) => [...current, Math.round(next.roundTripMs)].slice(-MAX_NETWORK_SAMPLES));
      setFailedChecks(0);
    } catch (error) {
      if (error?.name !== 'CanceledError' && error?.code !== 'ERR_CANCELED' && mountedRef.current) setFailedChecks((current) => current + 1);
    } finally {
      const nextFps = await fpsPromise;
      checkingRef.current = false;
      if (mountedRef.current) {
        const cutoff = performance.now() - LONG_TASK_WINDOW_MS;
        setLongTasks((current) => current.filter((item) => item.at >= cutoff));
        setFps(nextFps);
        setChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initial = window.setTimeout(runCheck, 0);
    const timer = window.setInterval(runCheck, REFRESH_MS);
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [runCheck]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!('PerformanceObserver' in window)) return undefined;
    let observer;
    try {
      observer = new PerformanceObserver((list) => {
        const now = performance.now();
        const additions = list.getEntries().map((entry) => ({ at: now, duration: entry.duration }));
        setLongTasks((current) => [...current.filter((item) => now - item.at <= LONG_TASK_WINDOW_MS), ...additions].slice(-40));
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch { return undefined; }
    return () => observer?.disconnect();
  }, []);

  const recentLongTasks = longTasks;
  const latency = samples.length ? average(samples.slice(-6)) : null;
  const jitterMs = samples.length ? jitter(samples.slice(-8)) : 0;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const diagnosis = diagnose({ online, failedChecks, latency, jitterMs, server, fps, longTasks: recentLongTasks });
  const worstLongTask = recentLongTasks.reduce((max, item) => Math.max(max, item.duration), 0);

  return (
    <section className="overflow-hidden bg-[var(--dc-panel)] text-[13px] shadow-[0_8px_24px_var(--dc-shadow-soft)]">
      <div className="flex items-center justify-between gap-5 px-[22px] pb-2.5 pt-5 max-[680px]:flex-col max-[680px]:items-start">
        <h1 className="m-0 font-['Bebas_Neue'] text-[1.9rem] font-normal uppercase leading-none tracking-[.015em] text-[var(--dc-text)] max-[980px]:text-[1.75rem] max-[680px]:text-[1.55rem]">
            DIAGNOSTICO <span className="text-[var(--dc-accent-four)]">DE RENDIMIENTO</span>
        </h1>
        <button type="button" className="inline-flex min-h-9 shrink-0 items-center justify-center gap-[7px] border border-[var(--dc-line)] bg-[var(--dc-surface-1)] px-[11px] text-[13px] font-bold leading-none text-[var(--dc-text)] hover:border-[var(--dc-accent-three)] hover:bg-[var(--dc-accent-three-soft)] disabled:cursor-wait disabled:opacity-60 max-[680px]:w-full" onClick={runCheck} disabled={checking} title="Actualizar diagnóstico"><RefreshCw size={15} className={checking ? 'animate-spin' : ''} /> {checking ? 'Midiendo...' : 'Actualizar'}</button>
      </div>

      <div className={`mx-5 mt-3.5 flex items-center gap-[11px] border p-3 px-3.5 max-[680px]:items-start ${VERDICT_TONE[diagnosis.tone] || VERDICT_TONE.good}`}>
        <span className="grid h-8 w-8 shrink-0 place-items-center border border-current">{diagnosis.tone === 'bad' && !online ? <WifiOff size={18} /> : <Activity size={18} />}</span>
        <div className="grid min-w-0 gap-0.5"><strong className="text-[13px]">{diagnosis.title}</strong><span className="text-[13px] leading-[1.4] text-current opacity-80">{diagnosis.message}</span></div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 px-5 pb-5 pt-3.5 max-[980px]:grid-cols-1">
        <DiagnosticCard icon={<Wifi size={17} />} title="Red" accent="var(--dc-accent-one)" tone={toneForLatency(latency)} primary={formatMs(latency)} primaryLabel="latencia a TRAZIO" stats={[[formatMs(jitterMs), 'jitter'], [online ? 'En línea' : 'Sin red', 'navegador']]}>
          <Sparkline values={samples} />
          <p className="mb-0 mt-auto pt-[11px] text-[13px] leading-[1.35] text-[var(--dc-muted)]">{connectionLabel(connection)}</p>
        </DiagnosticCard>

        <DiagnosticCard icon={<Cpu size={17} />} title="Este equipo" accent="var(--dc-accent-three)" tone={toneForFps(fps)} primary={Number.isFinite(fps) ? `${fps} FPS` : '—'} primaryLabel="fluidez del navegador" stats={[[recentLongTasks.length, 'bloqueos >50 ms'], [worstLongTask ? `${Math.round(worstLongTask)} ms` : '0 ms', 'peor bloqueo']]}>
          <p className="mb-0 mt-auto pt-[11px] text-[13px] leading-[1.35] text-[var(--dc-muted)]">{navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} hilos lógicos` : 'CPU no reportada'}{navigator.deviceMemory ? ` · ~${navigator.deviceMemory} GB RAM` : ''}</p>
        </DiagnosticCard>

        <DiagnosticCard icon={<Server size={17} />} title="Servidor" accent="var(--dc-accent-four)" tone={toneForEventLoop(server?.eventLoop?.p95Ms)} primary={formatMs(server?.eventLoop?.p95Ms)} primaryLabel="espera interna p95" stats={[[Number.isFinite(server?.cpu?.loadPercent) ? `${Math.round(server.cpu.loadPercent)}%` : '—', 'carga CPU'], [Number.isFinite(server?.memory?.heapPercent) ? `${Math.round(server.memory.heapPercent)}%` : '—', 'heap Node']]}>
          <p className="mb-0 mt-auto pt-[11px] text-[13px] leading-[1.35] text-[var(--dc-muted)]">{server ? `Activo hace ${Math.max(1, Math.round(server.uptimeSeconds / 60))} min · ${server.cpu?.cores || '—'} cores` : 'Esperando respuesta del servidor...'}</p>
        </DiagnosticCard>
      </div>

      <div className="flex min-h-[42px] items-center gap-[7px] px-[22px] pb-[18px] text-[13px] text-[var(--dc-muted)] max-[680px]:items-start max-[680px]:py-[11px]"><Gauge size={14} className="shrink-0 text-[var(--dc-accent-three)]" /><span>Las cifras son muestras recientes de este navegador y pueden cambiar con Wi‑Fi, VPN, carga del equipo o distancia al servidor.</span></div>
    </section>
  );
}
