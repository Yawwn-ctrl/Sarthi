/**
 * Comparative Evaluation Benchmark Modal
 * Runs automated batch simulations comparing APF, Frenet, Gap Acceptance, and Adaptive Supervisor
 * across all 9 Indian road scenarios.
 */

import React, { useState } from 'react';
import { BenchmarkResult, PlannerType, Scenario } from '../types/planner';
import { SCENARIOS } from '../scenarios';
import { SupervisorEngine } from '../algorithms/supervisor';
import { SimulationEngine } from '../simulation/engine';
import { AlertTriangle, Award, CheckCircle2, Play, RefreshCw, X, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  apfConfig: any;
  frenetConfig: any;
  gapConfig: any;
  supervisorConfig: any;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({
  isOpen,
  onClose,
  apfConfig,
  frenetConfig,
  gapConfig,
  supervisorConfig
}) => {
  const [isRunningBenchmark, setIsRunningBenchmark] = useState<boolean>(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number; currentName: string }>({
    current: 0,
    total: 0,
    currentName: ''
  });

  if (!isOpen) return null;

  const runComparativeBenchmark = async () => {
    setIsRunningBenchmark(true);
    const benchmarkResults: BenchmarkResult[] = [];
    const testScenarios = SCENARIOS;
    const plannersToTest: PlannerType[] = ['SUPERVISOR', 'APF', 'FRENET', 'GAP_ACCEPTANCE'];

    const totalTrials = testScenarios.length * plannersToTest.length;
    let trialCount = 0;

    for (const scenario of testScenarios) {
      for (const planner of plannersToTest) {
        trialCount++;
        setProgress({
          current: trialCount,
          total: totalTrials,
          currentName: `${scenario.title} (${planner})`
        });

        // Setup temporary simulation
        const supervisor = new SupervisorEngine(apfConfig, frenetConfig, gapConfig, supervisorConfig);
        supervisor.activePlannerMode = planner;
        const sim = new SimulationEngine(scenario, supervisor);
        sim.simulationSpeed = 4.0; // Fast forward for benchmark

        // Run fast headless simulation loop
        const maxSteps = 1200; // max ~60 seconds simulated
        let steps = 0;
        let latencies: number[] = [];

        while (!sim.isFinished && steps < maxSteps) {
          const t0 = performance.now();
          sim.update(0.05);
          latencies.push(performance.now() - t0);
          steps++;
        }

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length);

        benchmarkResults.push({
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          planner,
          success: sim.isSuccess,
          collisionCount: sim.metrics.collisionCount,
          travelTime: sim.metrics.timeElapsed,
          pathLength: sim.metrics.pathLength,
          smoothness: sim.metrics.smoothness,
          minClearance: sim.metrics.minClearance === Infinity ? 0 : sim.metrics.minClearance,
          avgLatencyMs: avgLatency
        });

        // Small async pause to yield to UI
        if (trialCount % 2 === 0) {
          await new Promise(r => setTimeout(r, 10));
        }
      }
    }

    setResults(benchmarkResults);
    setIsRunningBenchmark(false);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  };

  // Group stats by Planner
  const plannerSummary = ['SUPERVISOR', 'APF', 'FRENET', 'GAP_ACCEPTANCE'].map(planner => {
    const list = results.filter(r => r.planner === planner);
    if (list.length === 0) return null;
    const successCount = list.filter(r => r.success).length;
    const totalCollisions = list.reduce((a, b) => a + b.collisionCount, 0);
    const avgSmoothness = list.reduce((a, b) => a + b.smoothness, 0) / list.length;
    const avgTravelTime = list.reduce((a, b) => a + b.travelTime, 0) / list.length;
    const avgClearance = list.reduce((a, b) => a + b.minClearance, 0) / list.length;
    const avgLatency = list.reduce((a, b) => a + b.avgLatencyMs, 0) / list.length;

    return {
      planner,
      successRate: ((successCount / list.length) * 100).toFixed(0),
      totalCollisions,
      avgSmoothness: avgSmoothness.toFixed(2),
      avgTravelTime: avgTravelTime.toFixed(1),
      avgClearance: avgClearance.toFixed(2),
      avgLatency: avgLatency.toFixed(2),
      totalRuns: list.length
    };
  }).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Multi-Planner Benchmark & Evaluation Suite
              </h3>
              <p className="text-xs text-slate-400">
                Rigorous evaluation across 9 unstructured Indian road scenarios comparing standalone vs supervised planners.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-5 flex-1 text-xs sm:text-sm">
          {/* Action Trigger Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <div>
              <div className="font-bold text-slate-200">
                Execute Full Comparative Benchmark ({SCENARIOS.length} Scenarios × 4 Planners = {SCENARIOS.length * 4} Trials)
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Evaluates Collision Rates, Curvature Smoothness (∫ κ² ds), Clearance & Planning Latency.
              </div>
            </div>

            <button
              onClick={runComparativeBenchmark}
              disabled={isRunningBenchmark}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all shrink-0"
            >
              {isRunningBenchmark ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Running ({progress.current}/{progress.total})...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Benchmark</span>
                </>
              )}
            </button>
          </div>

          {/* Running Progress Bar */}
          {isRunningBenchmark && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-cyan-500/30">
              <div className="flex justify-between text-xs font-semibold text-cyan-300 mb-1.5">
                <span>Testing: {progress.currentName}</span>
                <span>{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-500 h-full transition-all duration-150"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Summary Table by Planner */}
          {plannerSummary.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Aggregated Architectural Performance Summary
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs bg-slate-950">
                  <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Planner Architecture</th>
                      <th className="p-3">Success Rate</th>
                      <th className="p-3">Total Collisions</th>
                      <th className="p-3">Smoothness (∫ κ² ds)</th>
                      <th className="p-3">Min Clearance</th>
                      <th className="p-3">Avg Travel Time</th>
                      <th className="p-3">Avg Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {plannerSummary.map((row: any) => (
                      <tr
                        key={row.planner}
                        className={row.planner === 'SUPERVISOR' ? 'bg-cyan-950/20 font-semibold text-cyan-200' : 'text-slate-300'}
                      >
                        <td className="p-3 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            row.planner === 'SUPERVISOR' ? 'bg-cyan-400' :
                            row.planner === 'APF' ? 'bg-amber-400' :
                            row.planner === 'FRENET' ? 'bg-emerald-400' : 'bg-purple-400'
                          }`} />
                          <span>{row.planner === 'SUPERVISOR' ? '🌟 Adaptive Supervisor' : row.planner}</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            parseInt(row.successRate) >= 90 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {row.successRate}%
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-200">{row.totalCollisions}</td>
                        <td className="p-3 text-cyan-300 font-mono">{row.avgSmoothness}</td>
                        <td className="p-3 text-blue-300">{row.avgClearance} m</td>
                        <td className="p-3 text-purple-300">{row.avgTravelTime} s</td>
                        <td className="p-3 text-emerald-300">{row.avgLatency} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Scenario Breakdown */}
          {results.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Per-Scenario Breakdown Logs ({results.length} Runs)
              </h4>
              <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-2 divide-y divide-slate-800/50 text-xs">
                {results.map((res, idx) => (
                  <div key={idx} className="py-2 px-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {res.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <div>
                        <div className="font-medium text-slate-200">{res.scenarioTitle}</div>
                        <div className="text-[10px] text-slate-500">Planner: <span className="font-semibold text-slate-400">{res.planner}</span></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="font-mono text-cyan-300">{res.smoothness.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-500">Smoothness</div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200">{res.travelTime.toFixed(1)}s</div>
                        <div className="text-[10px] text-slate-500">Time</div>
                      </div>
                      <div>
                        <div className={`font-bold ${res.collisionCount === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {res.collisionCount}
                        </div>
                        <div className="text-[10px] text-slate-500">Collisions</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
