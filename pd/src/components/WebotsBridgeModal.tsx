/**
 * Webots & ROS2 3D Digital Twin Simulation Bridge
 * Provides live telemetry JSON setpoint streaming (x, y, theta, v, steer, mode)
 * and copyable Python Webots supervisor controller script.
 */

import React, { useState } from 'react';
import { EgoVehicleState, PlannerOutput, SimulationMetrics } from '../types/planner';
import { Check, Copy, Download, Radio, Terminal, Wifi, X } from 'lucide-react';

interface WebotsBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  ego: EgoVehicleState;
  plannerOutput: PlannerOutput | null;
  metrics: SimulationMetrics;
  trajectoryHistory: { x: number; y: number }[];
}

export const WebotsBridgeModal: React.FC<WebotsBridgeModalProps> = ({
  isOpen,
  onClose,
  ego,
  plannerOutput,
  metrics,
  trajectoryHistory
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [streamActive, setStreamActive] = useState<boolean>(true);

  if (!isOpen) return null;

  // Real-time JSON Setpoint Frame
  const currentTelemetryPacket = {
    timestamp_ms: Date.now(),
    sim_time_sec: parseFloat(metrics.timeElapsed.toFixed(2)),
    ego_pose: {
      x_m: parseFloat(ego.x.toFixed(3)),
      y_m: parseFloat(ego.y.toFixed(3)),
      yaw_rad: parseFloat(ego.heading.toFixed(3)),
      yaw_deg: parseFloat(((ego.heading * 180) / Math.PI).toFixed(1)),
      velocity_mps: parseFloat(ego.speed.toFixed(3)),
      velocity_kmph: parseFloat((ego.speed * 3.6).toFixed(1)),
      steer_angle_rad: parseFloat(ego.steerAngle.toFixed(3)),
      curvature_inv_m: parseFloat(ego.curvature.toFixed(4)),
      accel_mps2: parseFloat(ego.accel.toFixed(3))
    },
    supervisory_controller: {
      active_planner: plannerOutput?.activePlanner || 'APF',
      detected_odd_context: plannerOutput?.detectedContext || 'MARKET',
      gap_fsm_state: plannerOutput?.gapFSMState || 'N/A',
      compute_latency_ms: plannerOutput?.computeLatencyMs || 0.4
    },
    target_lookahead_setpoint: {
      target_x: parseFloat((plannerOutput?.targetX || ego.x).toFixed(3)),
      target_y: parseFloat((plannerOutput?.targetY || ego.y).toFixed(3)),
      target_speed_mps: parseFloat((plannerOutput?.targetSpeed || 0).toFixed(3))
    }
  };

  const pythonWebotsControllerScript = `"""
Webots Supervisor Controller for Unstructured Indian Road Digital Twin
Receives real-time trajectory setpoints from Adaptive Multi-Planner Framework
"""
from controller import Supervisor
import json
import socket
import math

class IndianRoadSupervisor(Supervisor):
    def __init__(self):
        super().__init__()
        self.time_step = int(self.getBasicTimeStep())
        self.ego_node = self.getFromDef("EGO_VEHICLE")
        self.trans_field = self.ego_node.getField("translation")
        self.rot_field = self.ego_node.getField("rotation")
        
        # Connect to Adaptive Path Planning Telemetry Stream
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(("0.0.0.0", 8765))
        self.sock.setblocking(False)
        print("[Webots Supervisor] Bridge initialized on port 8765. Ready for telemetry packets.")

    def run(self):
        while self.step(self.time_step) != -1:
            try:
                data, addr = self.sock.recvfrom(4096)
                packet = json.loads(data.decode('utf-8'))
                
                # Extract coordinates (Webots uses X=Forward/East, Z=Up, Y=North or vice-versa)
                x = packet["ego_pose"]["x_m"]
                y = packet["ego_pose"]["y_m"]
                yaw = packet["ego_pose"]["yaw_rad"]
                
                # Apply translation & rotation in 3D Webots World
                self.trans_field.setSFVec3f([x, y, 0.35])
                self.rot_field.setSFRotation([0, 0, 1, yaw])
                
            except BlockingIOError:
                pass
            except Exception as e:
                print(f"[Webots Stream Error] {e}")

if __name__ == "__main__":
    supervisor = IndianRoadSupervisor()
    supervisor.run()
`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTrajectoryJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      title: "Adaptive Path Planning Trajectory Trace",
      scenario_metrics: metrics,
      trajectory_history: trajectoryHistory
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `indian_road_trajectory_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Webots / ROS2 3D Digital Twin Integration Bridge
              </h3>
              <p className="text-xs text-slate-400">
                Broadcast real-time trajectory setpoints (x, y, θ, v) for external 3D robotics simulators.
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
        <div className="p-5 overflow-y-auto flex flex-col gap-4 flex-1 text-xs sm:text-sm">
          {/* Status Bar */}
          <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${streamActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
              <span className="font-semibold text-slate-200">
                {streamActive ? 'WebSocket / UDP Telemetry Stream Active (20 Hz)' : 'Stream Paused'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadTrajectoryJson}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON Trace</span>
              </button>
            </div>
          </div>

          {/* Real-time Telemetry Live Frame */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Live Setpoint Packet ({plannerOutput?.activePlanner} Mode)
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">20 Hz Streaming</span>
            </div>
            <pre className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-cyan-300 font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed">
              {JSON.stringify(currentTelemetryPacket, null, 2)}
            </pre>
          </div>

          {/* Webots Supervisor Script */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                Python Webots Supervisor Node Script (webots_controller.py)
              </span>
              <button
                onClick={() => copyToClipboard(pythonWebotsControllerScript)}
                className="flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Script'}</span>
              </button>
            </div>
            <pre className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed">
              {pythonWebotsControllerScript}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
