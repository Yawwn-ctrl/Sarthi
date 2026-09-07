/**
 * Real-Time Evaluation Dashboard & Telemetry Visualizer
 * Displays live performance metrics: Collision Count, Smoothness (\int \kappa^2 ds),
 * Minimum Clearance, Compute Latency, Travel Time, and Live Dynamic Charts.
 */

import React, { useState } from 'react';
import { PerceptionState, PlannerOutput, SimulationMetrics } from '../types/planner';
import {
  Activity,
  AlertOctagon,
  Award,
  CheckCircle2,
  Clock,
  Gauge,
  Milestone,
  Navigation,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wifi,
  Zap
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface MetricsDashboardProps {
  metrics: SimulationMetrics;
  plannerOutput: PlannerOutput | null;
  perception?: PerceptionState | null;
  history: Array<{
    timestamp: number;
    metrics: SimulationMetrics;
    plannerOutput: PlannerOutput;
  }>;
  onOpenBenchmark: () => void;
  onOpenWebotsBridge: () => void;
  onOpenTheory: () => void;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  metrics,
  plannerOutput,
  perception,
  history,
  onOpenBenchmark,
  onOpenWebotsBridge,
  onOpenTheory
}) => {
  const [showSensorTable, setShowSensorTable] = useState(false);
  // Extract last 35 points for telemetry graphs
  const recentHistory = history.slice(-35).map((h, i) => ({
    time: h.timestamp.toFixed(1),
    speed: (h.metrics.currentSpeed * 3.6).toFixed(1),
    curvature: (h.metrics.currentCurvature * 10).toFixed(2),
    lateralOffset: h.metrics.currentLateralOffset.toFixed(2),
    latency: h.metrics.computeLatencyMs.toFixed(1)
  }));

  const isCollisionFree = metrics.collisionCount === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Quick Primary Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Collisions */}
        <div className={`p-3 rounded-2xl border flex flex-col justify-between transition-all ${
          isCollisionFree
            ? 'bg-slate-900/90 border-emerald-500/30'
            : 'bg-red-950/40 border-red-500/50 text-red-200'
        }`}>
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Collisions</span>
            <AlertOctagon className={`w-4 h-4 ${isCollisionFree ? 'text-emerald-400' : 'text-red-400'}`} />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black ${isCollisionFree ? 'text-emerald-400' : 'text-red-400'}`}>
              {metrics.collisionCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
              {isCollisionFree ? 'Target: 0 (Flawless)' : 'Safety Breach!'}
            </div>
          </div>
        </div>

        {/* Metric 2: Path Smoothness (\int \kappa^2 ds) */}
        <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Smoothness</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-cyan-300">
              {metrics.smoothness.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
              ∫ κ² ds (Lower = Straighter)
            </div>
          </div>
        </div>

        {/* Metric 3: Minimum Clearance */}
        <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Min Clearance</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black ${
              metrics.minClearance === Infinity ? 'text-slate-500' :
              metrics.minClearance < 0.5 ? 'text-amber-400' : 'text-blue-300'
            }`}>
              {metrics.minClearance === Infinity ? '∞' : `${metrics.minClearance.toFixed(2)} m`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Distance to nearest obstacle
            </div>
          </div>
        </div>

        {/* Metric 4: Travel Time */}
        <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Travel Time</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-purple-300">
              {metrics.timeElapsed.toFixed(1)} s
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Cumulative traversal
            </div>
          </div>
        </div>

        {/* Metric 5: Path Length */}
        <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Path Length</span>
            <Milestone className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-300">
              {metrics.pathLength.toFixed(1)} m
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Traveled distance
            </div>
          </div>
        </div>

        {/* Metric 6: Compute Latency */}
        <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Compute Latency</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-300">
              {metrics.computeLatencyMs.toFixed(1)} ms
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Per planning cycle (~20Hz)
            </div>
          </div>
        </div>
      </div>

      {/* 1.5 Indian Road Hazard Safety & Edge Guard Telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Pothole Safety Stats */}
        <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-base">🕳️</span>
              <span>Potholes Avoided / Impacts</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black text-emerald-400">{metrics.potholesAvoided || 0}</span>
              <span className="text-xs text-slate-400">safe passes</span>
              <span className="text-slate-600">/</span>
              <span className={`text-xl font-black ${metrics.potholeImpacts ? 'text-red-400' : 'text-slate-400'}`}>
                {metrics.potholeImpacts || 0}
              </span>
              <span className="text-xs text-slate-400">crater drops</span>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-lg border font-semibold ${
            plannerOutput?.potholeRepulsionActive
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {plannerOutput?.potholeRepulsionActive ? 'APF REPULSION ACTIVE' : 'Clear'}
          </span>
        </div>

        {/* Unrailed Road Edge Margin (Bush Slip Protection) */}
        <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-base">🌿</span>
              <span>Roadside Bushes Clearance</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-xl font-black ${
                metrics.edgeClearance !== undefined && metrics.edgeClearance < 1.5
                  ? 'text-red-400'
                  : metrics.edgeClearance !== undefined && metrics.edgeClearance < 2.5
                  ? 'text-amber-400'
                  : 'text-cyan-400'
              }`}>
                {metrics.edgeClearance !== undefined ? `${metrics.edgeClearance.toFixed(2)} m` : '--'}
              </span>
              <span className="text-xs text-slate-400">to unrailed edge</span>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-lg border font-semibold ${
            plannerOutput?.roadEdgeWarning
              ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {plannerOutput?.roadEdgeWarning ? 'SLIP HAZARD' : 'Safe Margin'}
          </span>
        </div>

        {/* Imaginary Centerline Guidance */}
        <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-base">📍</span>
              <span>Imaginary Centerline Guidance</span>
            </div>
            <div className="mt-1 text-xs text-slate-300">
              Corridor Vector: <span className="font-mono text-cyan-300 font-bold">{plannerOutput?.imaginaryCenterline?.length || 0} pts</span>
            </div>
          </div>
          <span className="text-xs px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold">
            Vehicle Origin Locked
          </span>
        </div>
      </div>

      {/* 2. Real-Time Telemetry Plots (Velocity, Curvature, Lateral Offset) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Plot 1: Velocity Profile */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              Velocity Profile
            </span>
            <span className="font-mono text-cyan-300 font-bold">
              {(metrics.currentSpeed * 3.6).toFixed(1)} km/h
            </span>
          </div>
          <div className="h-28 w-full">
            {recentHistory.length > 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={recentHistory} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 'auto']} tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    labelFormatter={(val) => `Time: ${val}s`}
                    formatter={(val) => [`${val} km/h`, 'Speed']}
                  />
                  <Area type="monotone" dataKey="speed" stroke="#06b6d4" strokeWidth={2} fill="url(#speedGrad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                Awaiting telemetry stream...
              </div>
            )}
          </div>
        </div>

        {/* Plot 2: Path Curvature (kappa) */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Path Curvature (κ)
            </span>
            <span className="font-mono text-emerald-300 font-bold">
              {metrics.currentCurvature.toFixed(3)} m⁻¹
            </span>
          </div>
          <div className="h-28 w-full">
            {recentHistory.length > 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={recentHistory} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <XAxis dataKey="time" hide />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    labelFormatter={(val) => `Time: ${val}s`}
                    formatter={(val) => [`${val}`, 'Curvature κ']}
                  />
                  <Line type="monotone" dataKey="curvature" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                Awaiting telemetry stream...
              </div>
            )}
          </div>
        </div>

        {/* Plot 3: Lateral Offset (d) from Centerline */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-purple-400" />
              Lateral Offset (d)
            </span>
            <span className="font-mono text-purple-300 font-bold">
              {metrics.currentLateralOffset.toFixed(2)} m
            </span>
          </div>
          <div className="h-28 w-full">
            {recentHistory.length > 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={recentHistory} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <XAxis dataKey="time" hide />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    labelFormatter={(val) => `Time: ${val}s`}
                    formatter={(val) => [`${val} m`, 'Lateral Offset d']}
                  />
                  <Line type="monotone" dataKey="lateralOffset" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                Awaiting telemetry stream...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2.5 LiDAR & 77GHz RADAR Perception Live Telemetry */}
      {perception && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  3D Perception & Sensor Telemetry (32-Beam LiDAR & 77GHz FMCW RADAR)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Real-time point cloud returns, Doppler radial velocities & Time-to-Collision (TTC)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSensorTable(!showSensorTable)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-medium border border-slate-700"
              >
                {showSensorTable ? 'Hide Target Table' : 'Show RADAR Target Table'}
              </button>
            </div>
          </div>

          {/* Quick Sensor Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>LiDAR Point Cloud</span>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="text-lg font-black text-cyan-300 mt-1">
                {perception.sensorStats.lidarPointsCount} pts
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                32 Rings • 20 Hz Scan Rate
              </div>
            </div>

            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>RADAR Tracks</span>
                <Wifi className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-lg font-black text-blue-300 mt-1">
                {perception.sensorStats.radarTargetsCount} objects
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                77 GHz FMCW • 70° FOV
              </div>
            </div>

            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Closest Target</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg font-black text-emerald-300 mt-1">
                {perception.sensorStats.closestTargetDistance < 90
                  ? `${perception.sensorStats.closestTargetDistance.toFixed(1)} m`
                  : 'Clear'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Range to front obstacle
              </div>
            </div>

            <div className={`p-2.5 rounded-xl border ${
              perception.sensorStats.closestTargetTTC < 2.5
                ? 'bg-red-950/40 border-red-500/50 text-red-300'
                : perception.sensorStats.closestTargetTTC < 4.5
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                : 'bg-slate-950/80 border-slate-800/80 text-purple-300'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span>Doppler TTC</span>
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg font-black mt-1">
                {perception.sensorStats.closestTargetTTC < 90
                  ? `${perception.sensorStats.closestTargetTTC.toFixed(1)} s`
                  : 'Safe (∞)'}
              </div>
              <div className="text-[10px] opacity-75 font-mono">
                {perception.sensorStats.emergencyBrakeRequired ? 'Emergency Stop Engaged' : 'Nominal Margin'}
              </div>
            </div>
          </div>

          {/* Expandable RADAR Doppler Targets Table */}
          {showSensorTable && perception.radarTargets.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2 mt-1">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-1.5 px-2">Target ID</th>
                    <th className="pb-1.5 px-2">Class</th>
                    <th className="pb-1.5 px-2">Range</th>
                    <th className="pb-1.5 px-2">Azimuth</th>
                    <th className="pb-1.5 px-2">Doppler V_r</th>
                    <th className="pb-1.5 px-2">TTC</th>
                    <th className="pb-1.5 px-2">Threat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {perception.radarTargets.map((target) => (
                    <tr key={target.id} className="text-slate-300 hover:bg-slate-800/40">
                      <td className="py-1.5 px-2 font-bold text-slate-200">{target.id.slice(0, 8)}</td>
                      <td className="py-1.5 px-2 text-cyan-300">{target.type}</td>
                      <td className="py-1.5 px-2">{target.distance.toFixed(1)} m</td>
                      <td className="py-1.5 px-2">{((target.azimuth * 180) / Math.PI).toFixed(1)}°</td>
                      <td className={`py-1.5 px-2 font-bold ${
                        target.radialVelocity < -1.0 ? 'text-red-400' : target.radialVelocity > 1.0 ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {target.radialVelocity > 0 ? `+${target.radialVelocity.toFixed(1)}` : target.radialVelocity.toFixed(1)} m/s
                      </td>
                      <td className="py-1.5 px-2">
                        {target.ttc !== undefined ? `${target.ttc.toFixed(1)} s` : '--'}
                      </td>
                      <td className="py-1.5 px-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          target.threatLevel === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : target.threatLevel === 'CAUTION'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {target.threatLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. Action Buttons for Benchmark Suite, Webots Bridge & Math Theory */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Real-time Guidance:</span>
          <span className="text-slate-200 font-medium italic">
            "{plannerOutput?.infoMessage || 'Ready to plan'}"
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTheory}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 hover:border-cyan-500/40 rounded-xl text-xs font-semibold transition-all"
          >
            Mathematical Formulation
          </button>

          <button
            onClick={onOpenWebotsBridge}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 hover:border-purple-500/40 rounded-xl text-xs font-semibold transition-all"
          >
            Webots / ROS2 Bridge
          </button>

          <button
            onClick={onOpenBenchmark}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-cyan-500/20 hover:brightness-110 transition-all"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Run Benchmark Suite</span>
          </button>
        </div>
      </div>
    </div>
  );
};
