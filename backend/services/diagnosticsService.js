import os from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function msFromNs(value) {
  return finite(Number(value) / 1e6);
}

function rounded(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(finite(value) * factor) / factor;
}

export function getServerDiagnostics() {
  const cpuCount = Math.max(1, os.cpus()?.length || 1);
  const [load1 = 0] = os.loadavg();
  const memory = process.memoryUsage();
  const totalMemory = Math.max(1, os.totalmem());
  const freeMemory = Math.max(0, os.freemem());

  const snapshot = {
    ok: true,
    serverTime: Date.now(),
    uptimeSeconds: Math.round(process.uptime()),
    eventLoop: {
      meanMs: rounded(msFromNs(histogram.mean)),
      p95Ms: rounded(msFromNs(histogram.percentile(95))),
      maxMs: rounded(msFromNs(histogram.max))
    },
    cpu: {
      cores: cpuCount,
      loadPercent: rounded((finite(load1) / cpuCount) * 100)
    },
    memory: {
      heapPercent: rounded((memory.heapUsed / Math.max(1, memory.heapTotal)) * 100),
      systemPercent: rounded(((totalMemory - freeMemory) / totalMemory) * 100)
    }
  };

  // Trabajamos por ventanas. Así un pico antiguo no deja el indicador rojo para siempre.
  histogram.reset();
  return snapshot;
}
