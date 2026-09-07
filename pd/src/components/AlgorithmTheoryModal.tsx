/**
 * Algorithm Theory & Mathematical Foundations Reference Modal
 * Details exact equations, FSM state machines, and Indian road adaptation techniques.
 */

import React from 'react';
import { BookOpen, Compass, Cpu, Layers, Sparkles, X } from 'lucide-react';

interface AlgorithmTheoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlgorithmTheoryModal: React.FC<AlgorithmTheoryModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Mathematical Foundations & Supervisory Architecture
              </h3>
              <p className="text-xs text-slate-400">
                Formal formulations for APF, Frenet Frame Trajectory Generation, Gap Acceptance FSM, and Context Classifier.
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

        {/* Body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-6 flex-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* Section 1: APF & Anti-Loop Stabilization */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-400 font-bold mb-2 text-sm sm:text-base">
              <Sparkles className="w-4 h-4" />
              <span>1. Artificial Potential Field (APF) — Dense Market Context</span>
            </div>

            <div className="space-y-2">
              <p>
                <strong>Attractive Potential:</strong> Pulls vehicle toward destination:
              </p>
              <div className="bg-slate-900 p-2.5 rounded-xl font-mono text-amber-300 text-xs">
                U_att(q) = 0.5 · k_att · d(q, q_goal)²
                <br />
                F_att(q) = -∇U_att(q) = k_att · (q_goal - q)
              </div>

              <p>
                <strong>Repulsive Potential:</strong> Guards against heterogeneous dynamic obstacles:
              </p>
              <div className="bg-slate-900 p-2.5 rounded-xl font-mono text-amber-300 text-xs">
                U_rep(q) = 0.5 · k_rep · (1/d - 1/d_0)²   for d ≤ d_0
                <br />
                F_rep(q) = k_rep · (1/d - 1/d_0) · (1/d²) · ∇d
              </div>

              <div className="border-t border-slate-800 pt-2 mt-2">
                <span className="font-bold text-amber-200 block mb-1">Anti-Loop & Straight-Line Stabilization:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs">
                  <li>
                    <strong className="text-slate-200">Zero-Gradient Local Minima Escape:</strong> When ‖∇U‖ ≈ 0 while d(q, q_goal) &gt; ε, the algorithm injects a deterministic tangential sliding force perpendicular to the repulsive gradient vector <code>F_tangent = sign · k_esc · [-F_rep,y, F_rep,x]</code>.
                  </li>
                  <li>
                    <strong className="text-slate-200">Non-Holonomic Heading Constraint:</strong> Backward heading flips (Δθ &gt; 90°) are strictly prohibited. The vehicle decelerates or stops rather than executing 360° loops.
                  </li>
                  <li>
                    <strong className="text-slate-200">Momentum Inertia:</strong> Directional inertia <code>F_momentum = α · v_prev</code> damps lateral zig-zag oscillations between close stalls.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 2: Frenet Frame Trajectory Generator */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2 text-sm sm:text-base">
              <Compass className="w-4 h-4" />
              <span>2. Frenet Frame Optimal Trajectory — Unstructured Village Roads</span>
            </div>

            <div className="space-y-2">
              <p>
                <strong>Centerline & Coordinate Transformation:</strong> Smooth cubic spline mapping from Cartesian (x, y, θ) to Frenet curvilinear coordinates (s, d):
              </p>
              <div className="bg-slate-900 p-2.5 rounded-xl font-mono text-emerald-300 text-xs">
                s: Longitudinal arc length along road centerline
                <br />
                d: Lateral offset perpendicular to road centerline normal
              </div>

              <p>
                <strong>Quintic / Quartic Polynomial Sampling:</strong>
              </p>
              <div className="bg-slate-900 p-2.5 rounded-xl font-mono text-emerald-300 text-xs">
                d(t) = a_0 + a_1·t + a_2·t² + a_3·t³ + a_4·t⁴ + a_5·t⁵
                <br />
                s(t) = b_0 + b_1·t + b_2·t² + b_3·t³ + b_4·t⁴
              </div>

              <p>
                <strong>Strict Straight-Line Bias Cost Function:</strong>
              </p>
              <div className="bg-slate-900 p-2.5 rounded-xl font-mono text-emerald-300 text-xs">
                J = w_d · d_final² + w_d_dot · d_dot² + w_d_ddot · d_ddot² + w_j · Jerk + w_coll · CollisionRisk + w_s · (v_target - s_dot)²
              </div>
              <p className="text-slate-400 text-xs">
                High weights on <code>w_d</code> and <code>w_d_dot</code> strictly penalize lateral wandering, ensuring the vehicle bypasses cattle with minimal deviation and immediately returns to d = 0.
              </p>
            </div>
          </div>

          {/* Section 3: Gap Acceptance FSM */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-purple-500/30">
            <div className="flex items-center gap-2 text-purple-400 font-bold mb-2 text-sm sm:text-base">
              <Layers className="w-4 h-4" />
              <span>3. Gap Acceptance & Merging — Signal-less Intersections</span>
            </div>

            <div className="space-y-2">
              <p>
                <strong>Time-to-Collision (TTC) Formulation:</strong>
              </p>
              <div className="bg-slate-900 p-2.5 rounded-xl font-mono text-purple-300 text-xs">
                TTC_i = D_cross,i / V_target,i
              </div>

              <p>
                <strong>Finite-State Machine (FSM):</strong>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-semibold">
                <div className="bg-slate-900 p-2 rounded-xl border border-slate-700 text-slate-300">
                  1. APPROACH
                </div>
                <div className="bg-slate-900 p-2 rounded-xl border border-amber-500/50 text-amber-300">
                  2. YIELD_AND_SCAN
                </div>
                <div className="bg-slate-900 p-2 rounded-xl border border-emerald-500/50 text-emerald-300">
                  3. COMMIT_CROSS
                </div>
                <div className="bg-slate-900 p-2 rounded-xl border border-cyan-500/50 text-cyan-300">
                  4. CLEAR_JUNCTION
                </div>
              </div>

              <p className="text-slate-400 text-xs mt-1">
                If <code>min(TTC_i) &gt; τ_crit</code> (e.g. 3.8s), FSM triggers <code>COMMIT_CROSS</code>, locking into a straight-line trajectory across the intersection box with uniform acceleration, strictly prohibiting hesitations or mid-box stops.
              </p>
            </div>
          </div>

          {/* Section 4: Context Classifier & Supervisor */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-cyan-500/30">
            <div className="flex items-center gap-2 text-cyan-400 font-bold mb-2 text-sm sm:text-base">
              <Cpu className="w-4 h-4" />
              <span>4. Context Classifier & Supervisory Switching Logic</span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-400">
              <div>• <strong>MARKET:</strong> Obstacle density &gt; ρ_thresh (≥ 4 obstacles in 25m) &amp; mean speed &lt; v_low → <em>APF Active</em>.</div>
              <div>• <strong>INTERSECTION:</strong> Ego inside intersection conflict polygon / entry line → <em>Gap Acceptance Active</em>.</div>
              <div>• <strong>VILLAGE:</strong> Continuous corridor boundaries with sparse obstacles → <em>Frenet Frame Active</em>.</div>
              <div>• <strong>Continuity &amp; Rate Limiters:</strong> Seamless state handoff (x_0, y_0, θ_0, v_0, a_0) with steering rate limiter |Δδ/dt| ≤ δ_max and jerk limiter |Δa/dt| ≤ j_max.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
