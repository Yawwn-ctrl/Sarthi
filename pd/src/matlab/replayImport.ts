/**
 * Simulink trajectory CSV -> ReplayFrame[].
 *
 * Expected header (order-independent, case-insensitive):
 *   t, x, y, heading, speed, accel, steer, curvature, active_planner, latency_ms
 *
 * Only t, x, y and heading are strictly required; the rest default to 0 / 'SIMULINK'
 * so a partially instrumented model still replays.
 */

import { ReplayFrame } from '../types/planner';

export interface ReplayParseResult {
  frames: ReplayFrame[];
  error: string | null;
  warnings: string[];
  durationSec: number;
}

const REQUIRED = ['t', 'x', 'y', 'heading'];

const ALIASES: Record<string, string> = {
  time: 't',
  time_s: 't',
  t_sec: 't',
  x_m: 'x',
  y_m: 'y',
  yaw: 'heading',
  yaw_rad: 'heading',
  theta: 'heading',
  v: 'speed',
  speed_mps: 'speed',
  a: 'accel',
  acceleration: 'accel',
  delta: 'steer',
  steer_angle: 'steer',
  steerangle: 'steer',
  kappa: 'curvature',
  planner: 'active_planner',
  activeplanner: 'active_planner',
  mode: 'active_planner',
  latency: 'latency_ms',
  latencyms: 'latency_ms'
};

const normaliseKey = (raw: string): string => {
  const k = raw.trim().toLowerCase().replace(/^"|"$/g, '');
  return ALIASES[k] || k;
};

export function parseReplayCsv(text: string): ReplayParseResult {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('%'));

  if (lines.length < 2) {
    return {
      frames: [],
      error: 'CSV has no data rows. Expected a header line plus at least one logged step.',
      warnings,
      durationSec: 0
    };
  }

  const header = lines[0].split(',').map(normaliseKey);
  const missing = REQUIRED.filter(r => !header.includes(r));
  if (missing.length > 0) {
    return {
      frames: [],
      error: `CSV is missing required column(s): ${missing.join(', ')}. Found: ${header.join(', ')}`,
      warnings,
      durationSec: 0
    };
  }

  const idx = (name: string): number => header.indexOf(name);
  const iT = idx('t');
  const iX = idx('x');
  const iY = idx('y');
  const iH = idx('heading');
  const iV = idx('speed');
  const iA = idx('accel');
  const iS = idx('steer');
  const iK = idx('curvature');
  const iP = idx('active_planner');
  const iL = idx('latency_ms');

  const num = (cols: string[], i: number, fallback: number = 0): number => {
    if (i < 0 || i >= cols.length) return fallback;
    const v = parseFloat(cols[i]);
    return Number.isFinite(v) ? v : fallback;
  };

  const frames: ReplayFrame[] = [];
  let skipped = 0;

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(',');
    const t = num(cols, iT, NaN);
    const x = num(cols, iX, NaN);
    const y = num(cols, iY, NaN);
    if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y)) {
      skipped++;
      continue;
    }
    frames.push({
      t,
      x,
      y,
      heading: num(cols, iH, 0),
      speed: num(cols, iV, 0),
      accel: num(cols, iA, 0),
      steer: num(cols, iS, 0),
      curvature: num(cols, iK, 0),
      activePlanner: iP >= 0 && cols[iP] ? cols[iP].trim().replace(/^"|"$/g, '') : 'SIMULINK',
      latencyMs: num(cols, iL, 0)
    });
  }

  if (frames.length < 2) {
    return {
      frames: [],
      error: `Only ${frames.length} valid row(s) parsed. Need at least 2 to replay a trajectory.`,
      warnings,
      durationSec: 0
    };
  }

  frames.sort((a, b) => a.t - b.t);

  // Normalise so the log starts at t = 0
  const t0 = frames[0].t;
  if (Math.abs(t0) > 1e-9) {
    for (const f of frames) f.t -= t0;
    warnings.push(`Log started at t=${t0.toFixed(3)}s; shifted to zero.`);
  }

  if (skipped > 0) {
    warnings.push(`${skipped} malformed row(s) skipped.`);
  }
  if (iV < 0) {
    warnings.push('No speed column found; speed will read 0 during replay.');
  }

  return {
    frames,
    error: null,
    warnings,
    durationSec: frames[frames.length - 1].t
  };
}

/**
 * Linear interpolation of the logged trajectory at an arbitrary sim time.
 * Heading is interpolated on the shortest arc so wraparound doesn't spin the car.
 */
export function sampleReplay(frames: ReplayFrame[], t: number): ReplayFrame {
  if (frames.length === 0) {
    return {
      t,
      x: 0,
      y: 0,
      heading: 0,
      speed: 0,
      accel: 0,
      steer: 0,
      curvature: 0,
      activePlanner: 'SIMULINK',
      latencyMs: 0
    };
  }
  if (t <= frames[0].t) return { ...frames[0], t };
  const last = frames[frames.length - 1];
  if (t >= last.t) return { ...last, t };

  // Binary search for the bracketing pair
  let lo = 0;
  let hi = frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid;
  }

  const a = frames[lo];
  const b = frames[hi];
  const span = b.t - a.t;
  const u = span > 1e-9 ? (t - a.t) / span : 0;

  let dh = b.heading - a.heading;
  while (dh > Math.PI) dh -= 2 * Math.PI;
  while (dh < -Math.PI) dh += 2 * Math.PI;

  const lerp = (p: number, q: number): number => p + (q - p) * u;

  return {
    t,
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y),
    heading: a.heading + dh * u,
    speed: lerp(a.speed, b.speed),
    accel: lerp(a.accel, b.accel),
    steer: lerp(a.steer, b.steer),
    curvature: lerp(a.curvature, b.curvature),
    activePlanner: u < 0.5 ? a.activePlanner : b.activePlanner,
    latencyMs: lerp(a.latencyMs, b.latencyMs)
  };
}
