import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Cpu, Gauge, RefreshCw, Server, Wifi, WifiOff } from 'lucide-react';
import { getConnectionDiagnostics } from '../../api/diagnostics';

const MAX_NETWORK_SAMPLES = 18;
const REFRESH_MS = 10000;
const LONG_TASK_WINDOW_MS = 30000;

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
  if (values.length < 2) return <div className="dc-connection-sparkline-empty">Esperando muestras...</div>;
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
    <svg className="dc-connection-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Historial reciente de latencia">
      <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function diagnose({ online, failedChecks, latency, jitterMs, server, fps, longTasks }) {
  if (!online) return { tone: 'bad', title: 'Sin conexión a internet', message: 'El navegador reporta que este equipo está desconectado.' };
  if (failedChecks >= 2) return { tone: 'bad', title: 'No podemos alcanzar DrawCast', message: 'La red local, el proveedor o la ruta hacia el servidor pueden estar fallando.' };

  const serverLoop = server?.eventLoop?.p95Ms;
  const serverLoad = server?.cpu?.loadPercent;
  if ((Number.isFinite(serverLoop) && serverLoop > 80) || (Number.isFinite(serverLoad) && serverLoad > 95)) {
    return { tone: 'bad', title: 'El servidor parece saturado', message: 'Tu conexión llega a DrawCast, pero el servidor está tardando en atender trabajo interno.' };
  }

  const worstLongTask = longTasks.reduce((max, item) => Math.max(max, item.duration), 0);
  if ((Number.isFinite(fps) && fps < 42) || longTasks.length >= 4 || worstLongTask > 220) {
    return { tone: 'warn', title: 'El navegador está trabajando de más', message: 'La red y el servidor responden, pero este equipo está bloqueando el hilo principal o dibujando pocos frames.' };
  }

  if ((Number.isFinite(latency) && latency > 180) || jitterMs > 60) {
    return { tone: 'warn', title: 'La red se ve inestable', message: 'DrawCast responde, pero la latencia o su variación son altas. Wi‑Fi, VPN o tu proveedor pueden ser la causa.' };
  }

  return { tone: 'good', title: 'Conexión estable', message: 'Red, navegador y servidor están dentro de rangos normales en esta muestra.' };
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
    <section className="dc-connection-panel">
      <div className="dc-connection-head">
        <div>
          <span className="dc-kicker">ESTADO DE CONEXIÓN</span>
          <h2>Diagnóstico en tiempo real</h2>
          <p>Ayuda a distinguir problemas de red, del navegador o del servidor. No sustituye una prueba de velocidad.</p>
        </div>
        <button type="button" onClick={runCheck} disabled={checking} title="Actualizar diagnóstico"><RefreshCw size={15} className={checking ? 'spinning' : ''} /> {checking ? 'Midiendo...' : 'Actualizar'}</button>
      </div>

      <div className={`dc-connection-verdict ${diagnosis.tone}`}>
        <span className="dc-connection-verdict-icon">{diagnosis.tone === 'bad' && !online ? <WifiOff size={18} /> : <Activity size={18} />}</span>
        <div><strong>{diagnosis.title}</strong><span>{diagnosis.message}</span></div>
      </div>

      <div className="dc-connection-grid">
        <article className="dc-connection-card">
          <div className="dc-connection-card-head"><span><Wifi size={17} /> Red</span><i className={toneForLatency(latency)} /></div>
          <div className="dc-connection-primary"><strong>{formatMs(latency)}</strong><span>latencia a DrawCast</span></div>
          <div className="dc-connection-stats"><span><b>{formatMs(jitterMs)}</b> jitter</span><span><b>{online ? 'En línea' : 'Sin red'}</b> navegador</span></div>
          <Sparkline values={samples} />
          <p>{connectionLabel(connection)}</p>
        </article>

        <article className="dc-connection-card">
          <div className="dc-connection-card-head"><span><Cpu size={17} /> Este equipo</span><i className={toneForFps(fps)} /></div>
          <div className="dc-connection-primary"><strong>{Number.isFinite(fps) ? `${fps} FPS` : '—'}</strong><span>fluidez del navegador</span></div>
          <div className="dc-connection-stats"><span><b>{recentLongTasks.length}</b> bloqueos &gt;50 ms</span><span><b>{worstLongTask ? `${Math.round(worstLongTask)} ms` : '0 ms'}</b> peor bloqueo</span></div>
          <p>{navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} hilos lógicos` : 'CPU no reportada'}{navigator.deviceMemory ? ` · ~${navigator.deviceMemory} GB RAM` : ''}</p>
        </article>

        <article className="dc-connection-card">
          <div className="dc-connection-card-head"><span><Server size={17} /> Servidor</span><i className={toneForEventLoop(server?.eventLoop?.p95Ms)} /></div>
          <div className="dc-connection-primary"><strong>{formatMs(server?.eventLoop?.p95Ms)}</strong><span>espera interna p95</span></div>
          <div className="dc-connection-stats"><span><b>{Number.isFinite(server?.cpu?.loadPercent) ? `${Math.round(server.cpu.loadPercent)}%` : '—'}</b> carga CPU</span><span><b>{Number.isFinite(server?.memory?.heapPercent) ? `${Math.round(server.memory.heapPercent)}%` : '—'}</b> heap Node</span></div>
          <p>{server ? `Activo hace ${Math.max(1, Math.round(server.uptimeSeconds / 60))} min · ${server.cpu?.cores || '—'} cores` : 'Esperando respuesta del servidor...'}</p>
        </article>
      </div>

      <div className="dc-connection-foot"><Gauge size={14} /><span>Las cifras son muestras recientes de este navegador y pueden cambiar con Wi‑Fi, VPN, carga del equipo o distancia al servidor.</span></div>
    </section>
  );
}
