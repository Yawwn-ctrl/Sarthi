/**
 * Interactive Control Panel Component
 * Features playback controls, scenario selector, manual/auto planner switching,
 * mathematical hyperparameter sliders (APF, Frenet, Gap Acceptance),
 * and dynamic traffic spawner.
 */

import React, { useState } from 'react';
import {
  Agent,
  APFConfig,
  FrenetConfig,
  GapAcceptanceConfig,
  PlannerType,
  Scenario,
  TrafficAgentType
} from '../types/planner';
import { SCENARIOS } from '../scenarios';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Cpu,
  FastForward,
  FileDown,
  FunctionSquare,
  Layers,
  Pause,
  Play,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  StepForward,
  Upload,
  Zap
} from 'lucide-react';

interface ControlPanelProps {
  currentScenario: Scenario;
  onSelectScenario: (scenario: Scenario) => void;
  isRunning: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  simulationSpeed: number;
  onChangeSpeed: (speed: number) => void;
  activePlannerMode: PlannerType;
  onChangePlannerMode: (mode: PlannerType) => void;
  apfConfig: APFConfig;
  onUpdateAPFConfig: (cfg: Partial<APFConfig>) => void;
  frenetConfig: FrenetConfig;
  onUpdateFrenetConfig: (cfg: Partial<FrenetConfig>) => void;
  gapConfig: GapAcceptanceConfig;
  onUpdateGapConfig: (cfg: Partial<GapAcceptanceConfig>) => void;
  selectedSpawnType: TrafficAgentType | null;
  onSelectSpawnType: (type: TrafficAgentType | null) => void;
  onTriggerStressTest: (testType: 'STALL_TRAP' | 'COW_SURPRISE' | 'FAST_CROSS_PULSE') => void;
  onExportScenarioJson: () => void;
  onImportReplayCsv: (file: File) => void;
  onClearReplay: () => void;
  replayInfo: { loaded: boolean; frames: number; duration: number; source: string; error: string | null };
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  currentScenario,
  onSelectScenario,
  isRunning,
  onTogglePlay,
  onStep,
  onReset,
  simulationSpeed,
  onChangeSpeed,
  activePlannerMode,
  onChangePlannerMode,
  apfConfig,
  onUpdateAPFConfig,
  frenetConfig,
  onUpdateFrenetConfig,
  gapConfig,
  onUpdateGapConfig,
  selectedSpawnType,
  onSelectSpawnType,
  onTriggerStressTest,
  onExportScenarioJson,
  onImportReplayCsv,
  onClearReplay,
  replayInfo
}) => {
  const [activeTab, setActiveTab] = useState<'PLAYBACK' | 'APF' | 'FRENET' | 'GAP' | 'SPAWN'>('PLAYBACK');

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col gap-4">
      {/* 1. Header with Scenario Selector & Primary Playback Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        {/* Scenario Dropdown */}
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
            Select Road Scenario & ODD Domain
          </label>
          <div className="relative">
            <select
              value={currentScenario.id}
              onChange={(e) => {
                const found = SCENARIOS.find(s => s.id === e.target.value);
                if (found) onSelectScenario(found);
              }}
              className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-xs sm:text-sm rounded-xl px-3 py-2 pr-8 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none cursor-pointer"
            >
              <optgroup label="🌟 Multi-Stage Master Scenario">
                {SCENARIOS.filter(s => s.category === 'MIXED_CORRIDOR').map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </optgroup>
              <optgroup label="🛍️ Market Context (APF Domain)">
                {SCENARIOS.filter(s => s.category === 'MARKET').map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </optgroup>
              <optgroup label="🌾 Village Track (Frenet Spline Domain)">
                {SCENARIOS.filter(s => s.category === 'VILLAGE').map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </optgroup>
              <optgroup label="🚦 Signal-less Intersection (Gap Acceptance)">
                {SCENARIOS.filter(s => s.category === 'INTERSECTION').map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </optgroup>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
              ▼
            </div>
          </div>
        </div>

        {/* Playback Controls & Speed Multipliers */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-lg transition-all ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
            }`}
          >
            {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isRunning ? 'Pause Sim' : 'Start Sim'}</span>
          </button>

          <button
            onClick={onStep}
            disabled={isRunning}
            className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-xl transition-colors"
            title="Step 1 Frame (dt = 0.05s)"
          >
            <StepForward className="w-4 h-4" />
          </button>

          <button
            onClick={onReset}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            title="Reset Simulation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed Selector Buttons */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[0.5, 1.0, 2.0, 4.0].map((spd) => (
              <button
                key={spd}
                onClick={() => onChangeSpeed(spd)}
                className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
                  simulationSpeed === spd
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Planner Supervisor Mode Selection */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span>Supervisory Planner Mode</span>
          <span className="text-xs text-slate-500 font-normal">
            {activePlannerMode === 'SUPERVISOR'
              ? 'Context-Adaptive Auto-Switching'
              : activePlannerMode === 'MATLAB_REPLAY'
                ? 'Model-in-the-Loop (MATLAB / Simulink)'
                : 'Forced Single-Planner Override'}
          </span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            onClick={() => onChangePlannerMode('SUPERVISOR')}
            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all ${
              activePlannerMode === 'SUPERVISOR'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Auto-Supervisor</span>
          </button>

          <button
            onClick={() => onChangePlannerMode('APF')}
            className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
              activePlannerMode === 'APF'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Force APF</span>
          </button>

          <button
            onClick={() => onChangePlannerMode('FRENET')}
            className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
              activePlannerMode === 'FRENET'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4 text-emerald-400" />
            <span>Force Frenet</span>
          </button>

          <button
            onClick={() => onChangePlannerMode('GAP_ACCEPTANCE')}
            className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
              activePlannerMode === 'GAP_ACCEPTANCE'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-md shadow-purple-500/10'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-400" />
            <span>Force Gap Acc.</span>
          </button>

          <button
            onClick={() => onChangePlannerMode('MATLAB_REPLAY')}
            className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
              activePlannerMode === 'MATLAB_REPLAY'
                ? 'bg-orange-500/20 text-orange-300 border-orange-500/50 shadow-md shadow-orange-500/10'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FunctionSquare className="w-4 h-4 text-orange-400" />
            <span>MATLAB / Simulink</span>
          </button>
        </div>

        {/* MATLAB / Simulink model-in-the-loop handoff */}
        {activePlannerMode === 'MATLAB_REPLAY' && (
          <div className="mt-2.5 p-3 rounded-xl border border-orange-500/30 bg-orange-500/5 space-y-2.5">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Planning, decision logic and vehicle motion execute in the Simulink model.
              Export the scenario, run it in MATLAB, then load the logged trajectory back
              here for closed-loop visualisation and metric scoring.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onExportScenarioJson}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>1. Export Scenario JSON</span>
              </button>

              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-orange-400" />
                <span>2. Load Trajectory CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    if (f) onImportReplayCsv(f);
                    e.target.value = '';
                  }}
                />
              </label>

              {replayInfo.loaded && (
                <button
                  onClick={onClearReplay}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-lg text-xs font-semibold border border-slate-800 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Unload</span>
                </button>
              )}
            </div>

            {replayInfo.error && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                <span className="text-[11px] text-red-300 font-mono">{replayInfo.error}</span>
              </div>
            )}

            {replayInfo.loaded && !replayInfo.error && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-[11px] text-emerald-300">
                  Loaded <span className="font-mono font-bold">{replayInfo.source}</span> —{' '}
                  {replayInfo.frames} logged steps over {replayInfo.duration.toFixed(2)}s.
                  Press play to replay the Simulink run.
                </span>
              </div>
            )}

            {!replayInfo.loaded && !replayInfo.error && (
              <p className="text-[11px] text-slate-500 font-mono">
                Expected CSV columns: t, x, y, heading, speed, accel, steer, curvature, active_planner, latency_ms
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3. Parameter Tuning Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('PLAYBACK')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${
            activeTab === 'PLAYBACK' ? 'bg-slate-800 text-cyan-300 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Scenario Info & Stress Tests
        </button>
        <button
          onClick={() => setActiveTab('APF')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${
            activeTab === 'APF' ? 'bg-slate-800 text-amber-300 border-b-2 border-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          APF Potential Field (Market)
        </button>
        <button
          onClick={() => setActiveTab('FRENET')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${
            activeTab === 'FRENET' ? 'bg-slate-800 text-emerald-300 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Frenet Frame (Village)
        </button>
        <button
          onClick={() => setActiveTab('GAP')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${
            activeTab === 'GAP' ? 'bg-slate-800 text-purple-300 border-b-2 border-purple-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Gap Acceptance (Junction)
        </button>
        <button
          onClick={() => setActiveTab('SPAWN')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${
            activeTab === 'SPAWN' ? 'bg-slate-800 text-pink-300 border-b-2 border-pink-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Custom Agent Spawner
        </button>
      </div>

      {/* 4. Tab Content */}
      {activeTab === 'PLAYBACK' && (
        <div className="flex flex-col gap-3">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {currentScenario.badge}
              </span>
              <span className="text-slate-300 font-semibold">{currentScenario.title}</span>
            </div>
            <p className="text-slate-400 leading-relaxed">{currentScenario.description}</p>
          </div>

          {/* Quick Stress Test Action Buttons */}
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
              Inject Dynamic Edge-Case Stress Tests
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => onTriggerStressTest('STALL_TRAP')}
                className="flex items-center gap-2 p-2 rounded-xl bg-amber-950/30 border border-amber-500/30 hover:bg-amber-900/30 text-amber-200 text-xs transition-colors text-left"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="font-bold">Stalled Truck Trap</div>
                  <div className="text-[10px] text-amber-400/80">Test zero-gradient escape</div>
                </div>
              </button>

              <button
                onClick={() => onTriggerStressTest('COW_SURPRISE')}
                className="flex items-center gap-2 p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30 hover:bg-emerald-900/30 text-emerald-200 text-xs transition-colors text-left"
              >
                <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold">Sudden Cattle Herd</div>
                  <div className="text-[10px] text-emerald-400/80">Test straight-line bias</div>
                </div>
              </button>

              <button
                onClick={() => onTriggerStressTest('FAST_CROSS_PULSE')}
                className="flex items-center gap-2 p-2 rounded-xl bg-purple-950/30 border border-purple-500/30 hover:bg-purple-900/30 text-purple-200 text-xs transition-colors text-left"
              >
                <FastForward className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <div className="font-bold">Fast Cross-Traffic</div>
                  <div className="text-[10px] text-purple-400/80">Test TTC Critical Gap</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'APF' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="flex justify-between text-slate-300 font-medium mb-1">
              <span>Attractive Gain (k_att)</span>
              <span className="text-amber-400 font-bold">{apfConfig.k_att.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.05"
              value={apfConfig.k_att}
              onChange={(e) => onUpdateAPFConfig({ k_att: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Pulls ego vehicle forward towards target goal position</p>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 font-medium mb-1">
              <span>Repulsive Gain (k_rep)</span>
              <span className="text-amber-400 font-bold">{apfConfig.k_rep.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="25.0"
              step="0.5"
              value={apfConfig.k_rep}
              onChange={(e) => onUpdateAPFConfig({ k_rep: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Guards against dynamic heterogeneous obstacles</p>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 font-medium mb-1">
              <span>Influence Distance (d_0)</span>
              <span className="text-amber-400 font-bold">{apfConfig.d_0.toFixed(1)} m</span>
            </div>
            <input
              type="range"
              min="1.5"
              max="12.0"
              step="0.5"
              value={apfConfig.d_0}
              onChange={(e) => onUpdateAPFConfig({ d_0: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Repulsion threshold boundary distance</p>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 font-medium mb-1">
              <span>Momentum Inertia (α_momentum)</span>
              <span className="text-amber-400 font-bold">{apfConfig.alpha_momentum.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.05"
              value={apfConfig.alpha_momentum}
              onChange={(e) => onUpdateAPFConfig({ alpha_momentum: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Damps zig-zag oscillations between close market obstacles</p>
          </div>
        </div>
      )}

      {activeTab === 'FRENET' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="flex justify-between text-slate-300 font-medium mb-1">
              <span>Lateral Offset Weight (w_d Straight Bias)</span>
              <span className="text-emerald-400 font-bold">{frenetConfig.w_d.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="20.0"
              step="0.5"
              value={frenetConfig.w_d}
              onChange={(e) => onUpdateFrenetConfig({ w_d: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">High weight strictly prevents unnecessary lateral weaving</p>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 font-medium mb-1">
              <span>Lateral Velocity Penalty (w_d_dot)</span>
              <span className="text-emerald-400 font-bold">{frenetConfig.w_d_dot.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="10.0"
              step="0.5"
              value={frenetConfig.w_d_dot}
              onChange={(e) => onUpdateFrenetConfig({ w_d_dot: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Penalizes rapid lateral rate of change</p>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 font-medium mb-1">
              <span>Target Rural Speed (v_target)</span>
              <span className="text-emerald-400 font-bold">{(frenetConfig.target_speed * 3.6).toFixed(0)} km/h ({frenetConfig.target_speed.toFixed(1)} m/s)</span>
            </div>
            <input
              type="range"
              min="3.0"
              max="14.0"
              step="0.5"
              value={frenetConfig.target_speed}
              onChange={(e) => onUpdateFrenetConfig({ target_speed: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Target longitudinal velocity along centerline</p>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 font-medium mb-1">
              <span>Collision Risk Weight (w_coll)</span>
              <span className="text-emerald-400 font-bold">{frenetConfig.w_coll.toFixed(0)}</span>
            </div>
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={frenetConfig.w_coll}
              onChange={(e) => onUpdateFrenetConfig({ w_coll: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Penalizes candidate trajectories close to cattle/vehicles</p>
          </div>
        </div>
      )}

      {activeTab === 'GAP' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="flex justify-between text-slate-300 font-medium mb-1">
              <span>Critical Gap Threshold (τ_crit)</span>
              <span className="text-purple-400 font-bold">{gapConfig.tau_crit.toFixed(1)} s</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="6.0"
              step="0.1"
              value={gapConfig.tau_crit}
              onChange={(e) => onUpdateGapConfig({ tau_crit: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Minimum TTC gap required before triggering COMMIT_CROSS</p>
          </div>

          <div>
            <div className="flex justify-between text-slate-300 font-medium mb-1">
              <span>Crossing Acceleration (a_cross)</span>
              <span className="text-purple-400 font-bold">{gapConfig.cross_accel.toFixed(1)} m/s²</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="4.0"
              step="0.2"
              value={gapConfig.cross_accel}
              onChange={(e) => onUpdateGapConfig({ cross_accel: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Uniform locked acceleration across intersection box</p>
          </div>
        </div>
      )}

      {activeTab === 'SPAWN' && (
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
            Click an Agent Icon, then Click Canvas to Spawn
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { type: 'PEDESTRIAN' as TrafficAgentType, label: 'Pedestrian', icon: '🚶' },
              { type: 'CATTLE' as TrafficAgentType, label: 'Sacred Cow', icon: '🐄' },
              { type: 'AUTO_RICKSHAW' as TrafficAgentType, label: 'Auto-Rickshaw', icon: '🛺' },
              { type: 'TWO_WHEELER' as TrafficAgentType, label: 'Motorcycle', icon: '🛵' },
              { type: 'TRUCK' as TrafficAgentType, label: 'Tata Lorry', icon: '🚛' },
              { type: 'POTHOLE' as TrafficAgentType, label: 'Pothole Crater', icon: '🕳️' },
            ].map((item) => (
              <button
                key={item.type}
                onClick={() => onSelectSpawnType(selectedSpawnType === item.type ? null : item.type)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                  selectedSpawnType === item.type
                    ? 'bg-pink-500/20 border-pink-500/50 text-pink-300 shadow-md shadow-pink-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
            {selectedSpawnType && (
              <button
                onClick={() => onSelectSpawnType(null)}
                className="px-3 py-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs"
              >
                Cancel Spawn
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
