/**
 * Main Application Entry Point
 * Adaptive Path Planning for Unstructured Indian Roads
 * Tier 1, 2, 3, and 4 Multi-Planner Autonomous Robotics Suite
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Agent,
  APFConfig,
  FrenetConfig,
  GapAcceptanceConfig,
  PlannerType,
  Scenario,
  SupervisorConfig,
  TrafficAgentType
} from './types/planner';
import { SCENARIOS } from './scenarios';
import { SupervisorEngine } from './algorithms/supervisor';
import { SimulationEngine } from './simulation/engine';
import { SimulationCanvas } from './components/SimulationCanvas';
import { ControlPanel } from './components/ControlPanel';
import { MetricsDashboard } from './components/MetricsDashboard';
import { BenchmarkModal } from './components/BenchmarkModal';
import { WebotsBridgeModal } from './components/WebotsBridgeModal';
import { AlgorithmTheoryModal } from './components/AlgorithmTheoryModal';
import { downloadScenarioJson } from './matlab/scenarioExport';
import { parseReplayCsv } from './matlab/replayImport';
import {
  Activity,
  Award,
  BookOpen,
  Car,
  Compass,
  Cpu,
  Layers,
  Sparkles,
  Wifi
} from 'lucide-react';

export default function App() {
  // Default Configurations
  const [apfConfig, setApfConfig] = useState<APFConfig>({
    k_att: 0.8,
    k_rep: 8.0,
    d_0: 4.5,
    alpha_momentum: 0.6,
    v_max: 5.5,
    escapeGain: 1.5,
    nonHolonomicMaxTurn: 0.6
  });

  const [frenetConfig, setFrenetConfig] = useState<FrenetConfig>({
    w_d: 8.0,
    w_d_dot: 3.5,
    w_d_ddot: 2.0,
    w_jerk: 1.0,
    w_coll: 800,
    w_speed: 1.5,
    target_speed: 8.0,
    max_speed: 14.0,
    max_accel: 3.5,
    max_curvature: 0.45,
    d_sample_step: 0.6,
    d_sample_range: 2.8,
    t_sample_horizons: [2.0, 2.8, 3.5]
  });

  const [gapConfig, setGapConfig] = useState<GapAcceptanceConfig>({
    tau_crit: 3.8,
    approach_speed: 4.0,
    cross_accel: 1.8,
    cross_speed_max: 7.0,
    yield_distance: 6.0
  });

  const [supervisorConfig, setSupervisorConfig] = useState<SupervisorConfig>({
    density_thresh: 1.8,
    speed_low_thresh: 2.5,
    steer_rate_limit: 1.8,
    jerk_limit: 4.0
  });

  // Active Scenario & Simulation Engine Instance
  const [currentScenario, setCurrentScenario] = useState<Scenario>(SCENARIOS[0]);
  const [activePlannerMode, setActivePlannerMode] = useState<PlannerType>('SUPERVISOR');
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1.0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedSpawnType, setSelectedSpawnType] = useState<TrafficAgentType | null>(null);

  // MATLAB / Simulink model-in-the-loop replay state
  const [replayInfo, setReplayInfo] = useState<{
    loaded: boolean;
    frames: number;
    duration: number;
    source: string;
    error: string | null;
  }>({ loaded: false, frames: 0, duration: 0, source: '', error: null });

  // Modals Visibility
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);
  const [isWebotsOpen, setIsWebotsOpen] = useState<boolean>(false);
  const [isTheoryOpen, setIsTheoryOpen] = useState<boolean>(false);

  // Layer Toggles
  const [layerVisibility, setLayerVisibility] = useState({
    apfVectors: true,
    frenetFan: true,
    gapCones: true,
    centerline: true,
    boundingRadii: true,
    sensorLidar: true,
    trajectoryHistory: true,
    potholes: true,
    imaginaryCenterline: true
  });

  // Instantiate Supervisor & Simulation Engine
  const supervisorRef = useRef<SupervisorEngine>(
    new SupervisorEngine(apfConfig, frenetConfig, gapConfig, supervisorConfig)
  );

  const engineRef = useRef<SimulationEngine>(
    new SimulationEngine(currentScenario, supervisorRef.current)
  );

  // Force React render on each physics tick
  const [, setTick] = useState<number>(0);

  // Sync parameters with engine
  useEffect(() => {
    supervisorRef.current.apfPlanner.updateConfig(apfConfig);
    supervisorRef.current.frenetPlanner.updateConfig(frenetConfig);
    supervisorRef.current.gapPlanner.updateConfig(gapConfig);
    supervisorRef.current.supervisorConfig = supervisorConfig;
    supervisorRef.current.activePlannerMode = activePlannerMode;
    engineRef.current.setReplayActive(activePlannerMode === 'MATLAB_REPLAY');
  }, [apfConfig, frenetConfig, gapConfig, supervisorConfig, activePlannerMode]);

  // Sync simulation speed
  useEffect(() => {
    engineRef.current.simulationSpeed = simulationSpeed;
  }, [simulationSpeed]);

  // Handle Scenario Change
  const handleSelectScenario = (newScenario: Scenario) => {
    setCurrentScenario(newScenario);
    engineRef.current.loadScenario(newScenario);
    setIsRunning(false);
    setTick(t => t + 1);
  };

  // Main Simulation Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const dt = Math.min(0.08, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;

      if (isRunning && !engineRef.current.isFinished) {
        engineRef.current.update(0.05); // Fixed physics step dt
        setTick(t => t + 1);
      } else if (engineRef.current.isFinished && isRunning) {
        setIsRunning(false);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRunning]);

  // Playback Control Handlers
  const handleTogglePlay = () => {
    if (engineRef.current.isFinished) {
      engineRef.current.reset();
    }
    setIsRunning(!isRunning);
  };

  const handleStep = () => {
    if (!engineRef.current.isFinished) {
      engineRef.current.update(0.05);
      setTick(t => t + 1);
    }
  };

  const handleReset = () => {
    engineRef.current.reset();
    setIsRunning(false);
    setTick(t => t + 1);
  };

  // MATLAB / Simulink handoff handlers
  const handleExportScenarioJson = () => {
    downloadScenarioJson(
      currentScenario,
      engineRef.current.potholes,
      engineRef.current.obstacles
    );
  };

  const handleImportReplayCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const result = parseReplayCsv(text);

      if (result.error) {
        setReplayInfo({ loaded: false, frames: 0, duration: 0, source: file.name, error: result.error });
        return;
      }

      engineRef.current.loadReplayLog(result.frames, file.name);
      engineRef.current.setReplayActive(true);
      setIsRunning(false);
      setReplayInfo({
        loaded: true,
        frames: result.frames.length,
        duration: result.durationSec,
        source: file.name,
        error: null
      });
      setTick(t => t + 1);
    };
    reader.onerror = () => {
      setReplayInfo({ loaded: false, frames: 0, duration: 0, source: file.name, error: 'Could not read the file.' });
    };
    reader.readAsText(file);
  };

  const handleClearReplay = () => {
    engineRef.current.clearReplayLog();
    setIsRunning(false);
    setReplayInfo({ loaded: false, frames: 0, duration: 0, source: '', error: null });
    setTick(t => t + 1);
  };

  const handleToggleLayer = (key: string) => {
    setLayerVisibility(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev]
    }));
  };

  // Interactive Dynamic Obstacle Spawner
  const handleCanvasClickSpawn = (type: TrafficAgentType, wx: number, wy: number) => {
    engineRef.current.addCustomObstacle(type, wx, wy);
    setSelectedSpawnType(null);
    setTick(t => t + 1);
  };

  // Stress Test Handlers
  const handleTriggerStressTest = (testType: 'STALL_TRAP' | 'COW_SURPRISE' | 'FAST_CROSS_PULSE') => {
    const ego = engineRef.current.ego;

    if (testType === 'STALL_TRAP') {
      // Spawn stalled truck directly ahead on ego's path (tests zero-gradient tangential escape)
      const lookDist = 14.0;
      const obsX = ego.x + Math.cos(ego.heading) * lookDist;
      const obsY = ego.y + Math.sin(ego.heading) * lookDist;
      engineRef.current.obstacles.push({
        id: `stress-truck-${Date.now()}`,
        type: 'TRUCK',
        x: obsX,
        y: obsY,
        vx: 0,
        vy: 0,
        heading: ego.heading,
        width: 2.6,
        length: 6.5,
        radius: 2.0,
        color: '#ca8a04',
        label: 'Injected Stalled Truck',
        speed: 0,
        targetSpeed: 0,
        isStalled: true,
        behavior: 'STALLED'
      });
    } else if (testType === 'COW_SURPRISE') {
      // Spawn cow meandering across lane (tests Frenet straight-line bias)
      const lookDist = 12.0;
      const obsX = ego.x + Math.cos(ego.heading) * lookDist;
      const obsY = ego.y + Math.sin(ego.heading) * lookDist + 1.2;
      engineRef.current.obstacles.push({
        id: `stress-cow-${Date.now()}`,
        type: 'CATTLE',
        x: obsX,
        y: obsY,
        vx: 0.1,
        vy: -0.3,
        heading: Math.PI / 2,
        width: 1.1,
        length: 2.4,
        radius: 1.2,
        color: '#f8fafc',
        label: 'Sudden Cattle Crossing',
        speed: 0.3,
        targetSpeed: 0.3,
        behavior: 'WANDERING'
      });
    } else if (testType === 'FAST_CROSS_PULSE') {
      // Spawn fast crossing car
      const obsX = ego.x + 18.0;
      const obsY = -28.0;
      engineRef.current.obstacles.push({
        id: `stress-fast-car-${Date.now()}`,
        type: 'CAR',
        x: obsX,
        y: obsY,
        vx: 0,
        vy: 8.5,
        heading: Math.PI / 2,
        width: 1.8,
        length: 4.4,
        radius: 1.4,
        color: '#38bdf8',
        label: 'Fast Cross Vehicle (8.5 m/s)',
        speed: 8.5,
        targetSpeed: 8.5,
        behavior: 'CROSSING'
      });
    }
    setTick(t => t + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 1. Header Navigation & Brand Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-30 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg shadow-cyan-500/20 text-slate-950">
              <Car className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Adaptive Path Planning for Unstructured Indian Roads
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  v2.4 Production
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-Planner Architecture: APF (Market) • Frenet Frame (Village) • Gap Acceptance (Uncontrolled Intersection)
              </p>
            </div>
          </div>

          {/* Quick Header Navigation Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTheoryOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700/60 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Theory</span>
            </button>

            <button
              onClick={() => setIsWebotsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700/60 transition-colors"
            >
              <Wifi className="w-3.5 h-3.5 text-purple-400" />
              <span>Webots Bridge</span>
            </button>

            <button
              onClick={() => setIsBenchmarkOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-cyan-500/20 hover:brightness-110 transition-all"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Benchmarks</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-5">
        {/* Simulation Canvas Viewport */}
        <section>
          <SimulationCanvas
            engine={engineRef.current}
            scenario={currentScenario}
            metrics={engineRef.current.metrics}
            layerVisibility={layerVisibility}
            onToggleLayer={handleToggleLayer}
            onCanvasClickSpawn={handleCanvasClickSpawn}
            selectedSpawnType={selectedSpawnType}
          />
        </section>

        {/* Interactive Control Panel & Hyperparameters */}
        <section>
          <ControlPanel
            currentScenario={currentScenario}
            onSelectScenario={handleSelectScenario}
            isRunning={isRunning}
            onTogglePlay={handleTogglePlay}
            onStep={handleStep}
            onReset={handleReset}
            simulationSpeed={simulationSpeed}
            onChangeSpeed={setSimulationSpeed}
            activePlannerMode={activePlannerMode}
            onChangePlannerMode={setActivePlannerMode}
            apfConfig={apfConfig}
            onUpdateAPFConfig={(cfg) => setApfConfig(prev => ({ ...prev, ...cfg }))}
            frenetConfig={frenetConfig}
            onUpdateFrenetConfig={(cfg) => setFrenetConfig(prev => ({ ...prev, ...cfg }))}
            gapConfig={gapConfig}
            onUpdateGapConfig={(cfg) => setGapConfig(prev => ({ ...prev, ...cfg }))}
            selectedSpawnType={selectedSpawnType}
            onSelectSpawnType={setSelectedSpawnType}
            onTriggerStressTest={handleTriggerStressTest}
            onExportScenarioJson={handleExportScenarioJson}
            onImportReplayCsv={handleImportReplayCsv}
            onClearReplay={handleClearReplay}
            replayInfo={replayInfo}
          />
        </section>

        {/* Real-Time Evaluation Dashboard & Telemetry Visualizer */}
        <section>
          <MetricsDashboard
            metrics={engineRef.current.metrics}
            plannerOutput={engineRef.current.currentPlannerOutput}
            perception={engineRef.current.perception}
            history={engineRef.current.history}
            onOpenBenchmark={() => setIsBenchmarkOpen(true)}
            onOpenWebotsBridge={() => setIsWebotsOpen(true)}
            onOpenTheory={() => setIsTheoryOpen(true)}
          />
        </section>
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        Adaptive Path Planning for Unstructured Indian Roads • Non-Holonomic Kinematic Bicycle Model • Autonomous Systems Framework
      </footer>

      {/* Modals */}
      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        apfConfig={apfConfig}
        frenetConfig={frenetConfig}
        gapConfig={gapConfig}
        supervisorConfig={supervisorConfig}
      />

      <WebotsBridgeModal
        isOpen={isWebotsOpen}
        onClose={() => setIsWebotsOpen(false)}
        ego={engineRef.current.ego}
        plannerOutput={engineRef.current.currentPlannerOutput}
        metrics={engineRef.current.metrics}
        trajectoryHistory={engineRef.current.trajectoryHistory}
      />

      <AlgorithmTheoryModal
        isOpen={isTheoryOpen}
        onClose={() => setIsTheoryOpen(false)}
      />
    </div>
  );
}
