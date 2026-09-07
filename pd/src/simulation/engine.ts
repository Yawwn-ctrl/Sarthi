/**
 * Simulation Engine & Kinematic Physics Pipeline
 * Simulates ego vehicle (kinematic bicycle model), heterogeneous Indian traffic agents,
 * collision checking, real-time telemetry metrics, and trajectory recording.
 */

import { SupervisorEngine } from '../algorithms/supervisor';
import { Spline2D } from '../algorithms/spline';
import { SensorPerceptionPipeline } from './sensors';
import {
  Agent,
  EgoVehicleState,
  PerceptionState,
  PlannerOutput,
  PlannerType,
  Point2D,
  Pothole,
  Scenario,
  ReplayFrame,
  SensorConfig,
  SimulationMetrics
} from '../types/planner';
import { sampleReplay } from '../matlab/replayImport';

export interface HistoryFrame {
  timestamp: number;
  ego: EgoVehicleState;
  obstacles: Agent[];
  metrics: SimulationMetrics;
  plannerOutput: PlannerOutput;
}

export class SimulationEngine {
  public scenario: Scenario;
  public spline: Spline2D | null = null;
  public supervisor: SupervisorEngine;

  public ego: EgoVehicleState;
  public obstacles: Agent[] = [];
  public potholes: Pothole[] = [];
  public goal: Point2D;

  public metrics: SimulationMetrics;
  public currentPlannerOutput: PlannerOutput | null = null;

  public sensorPipeline: SensorPerceptionPipeline;
  public perception: PerceptionState;
  public sensorConfig: SensorConfig;

  public isRunning: boolean = false;
  public isFinished: boolean = false;
  public isSuccess: boolean = false;
  public simulationSpeed: number = 1.0; // 0.5x, 1x, 2x, 4x

  public history: HistoryFrame[] = [];
  public trajectoryHistory: Point2D[] = [];

  /**
   * MATLAB/Simulink model-in-the-loop replay.
   * When replayActive is true the ego pose is driven by a trajectory logged from a
   * closed-loop Simulink run instead of by the in-browser planners. Every downstream
   * stage (collision checking, pothole impacts, sensors, metrics) is unchanged, so the
   * numbers reported are measured against the Simulink trajectory.
   */
  public replayLog: ReplayFrame[] = [];
  public replayActive: boolean = false;
  public replaySourceName: string = '';

  constructor(scenario: Scenario, supervisor: SupervisorEngine) {
    this.scenario = scenario;
    this.supervisor = supervisor;
    this.ego = { ...scenario.egoStart };
    this.goal = { ...scenario.egoGoal };
    this.obstacles = JSON.parse(JSON.stringify(scenario.obstacles));
    this.potholes = this.initPotholes(scenario);
    this.metrics = this.initMetrics();
    this.sensorPipeline = new SensorPerceptionPipeline();
    this.sensorConfig = {
      lidarEnabled: true,
      lidarRange: 50,
      lidarBeams: 32,
      lidarShowBeams: true,
      lidarColorMode: 'ELEVATION',
      radarEnabled: true,
      radarRange: 80,
      radarFovDegrees: 70,
      radarShowFrustum: true,
      radarShowDoppler: true,
      showBoundingBoxes3D: true,
      cameraMode: 'CHASE',
      lighting: 'SUNSET'
    };
    this.perception = this.sensorPipeline.update(
      this.ego,
      this.obstacles,
      this.scenario,
      this.sensorConfig,
      0.05
    );
    this.initSpline();
  }

  private initPotholes(scenario: Scenario): Pothole[] {
    if (scenario.potholes && scenario.potholes.length > 0) {
      return scenario.potholes.map((p, idx) => {
        const pot = p as Partial<Pothole>;
        return {
          id: pot.id || `pothole-${idx}`,
          x: p.x,
          y: p.y,
          radius: pot.radius || 1.1,
          depth: pot.depth || 0.15,
          severity: pot.severity || 'MODERATE'
        };
      });
    }

    // Realistic procedural potholes for unstructured Indian road corridors if scenario doesn't specify
    const generated: Pothole[] = [];
    const roadLength = Math.max(80, (scenario.egoGoal.x - scenario.egoStart.x) || 120);
    const numPotholes = Math.min(6, Math.max(3, Math.floor(roadLength / 25)));

    for (let i = 1; i <= numPotholes; i++) {
      const px = scenario.egoStart.x + i * 22.0 + (i % 2 === 0 ? 3.0 : -2.0);
      if (px < scenario.egoGoal.x - 10) {
        // Offset laterally from road centerline
        const lateralOffset = (i % 2 === 0 ? 1.6 : -1.8) + ((i % 3 === 0) ? 0.8 : -0.6);
        const centerRef = this.supervisor.apfPlanner.getRoadCenterY(px, scenario.centerlineWaypoints);
        generated.push({
          id: `pothole-proc-${i}`,
          x: px,
          y: centerRef + lateralOffset,
          radius: 0.9 + (i % 3) * 0.25,
          depth: 0.12 + (i % 2) * 0.08,
          severity: (i % 3 === 0 ? 'SEVERE' : i % 2 === 0 ? 'MODERATE' : 'MILD')
        });
      }
    }
    return generated;
  }

  private initSpline(): void {
    if (this.scenario.centerlineWaypoints && this.scenario.centerlineWaypoints.length >= 2) {
      this.spline = new Spline2D(this.scenario.centerlineWaypoints, 0.4);
    } else {
      this.spline = null;
    }
  }

  private initMetrics(): SimulationMetrics {
    return {
      collisionCount: 0,
      success: false,
      timeElapsed: 0,
      pathLength: 0,
      smoothness: 0,
      minClearance: Infinity,
      computeLatencyMs: 0,
      currentSpeed: 0,
      currentCurvature: 0,
      currentLateralOffset: 0,
      currentTTC: Infinity,
      totalFrames: 0,
      potholesAvoided: 0,
      potholeImpacts: 0,
      edgeClearance: (this.scenario.roadWidth || 14) / 2
    };
  }

  public loadScenario(scenario: Scenario): void {
    this.scenario = scenario;
    this.ego = { ...scenario.egoStart };
    this.goal = { ...scenario.egoGoal };
    this.obstacles = JSON.parse(JSON.stringify(scenario.obstacles));
    this.potholes = this.initPotholes(scenario);
    this.metrics = this.initMetrics();
    this.history = [];
    this.trajectoryHistory = [{ x: this.ego.x, y: this.ego.y }];
    this.isRunning = false;
    this.isFinished = false;
    this.isSuccess = false;
    this.initSpline();
    this.supervisor.reset();

    // Warm-up initial planning step
    this.currentPlannerOutput = this.supervisor.step(
      this.ego,
      this.goal,
      this.obstacles,
      this.spline,
      this.scenario.intersectionZone,
      0.05,
      this.potholes,
      this.scenario.roadWidth || 14,
      this.scenario.centerlineWaypoints || []
    );

    this.perception = this.sensorPipeline.update(
      this.ego,
      this.obstacles,
      this.scenario,
      this.sensorConfig,
      0.05
    );
  }

  public reset(): void {
    this.loadScenario(this.scenario);
  }

  /**
   * Main Physics & Planning Update Tick
   */
  public update(dt: number = 0.05): void {
    if (this.isFinished) return;

    const scaledDt = dt * this.simulationSpeed;

    const prevX = this.ego.x;
    const prevY = this.ego.y;
    const prevTheta = this.ego.heading;

    let plannerOutput: PlannerOutput;

    if (this.isReplayMode()) {
      // ============================================================
      // MODEL-IN-THE-LOOP: ego pose comes from the Simulink trajectory log.
      // The in-browser planners are bypassed entirely in this mode.
      // ============================================================
      const frame = sampleReplay(this.replayLog, this.metrics.timeElapsed + scaledDt);

      this.ego.x = frame.x;
      this.ego.y = frame.y;
      this.ego.heading = this.normalizeAngle(frame.heading);
      this.ego.speed = frame.speed;
      this.ego.accel = frame.accel;
      this.ego.steerAngle = frame.steer;
      this.ego.curvature = frame.curvature;

      plannerOutput = this.buildReplayPlannerOutput(frame);
      this.currentPlannerOutput = plannerOutput;
    } else {
      // 1. Run Supervisor Multi-Planner Engine with Potholes and Unrailed Edge Guard
      plannerOutput = this.supervisor.step(
        this.ego,
        this.goal,
        this.obstacles,
        this.spline,
        this.scenario.intersectionZone,
        scaledDt,
        this.potholes,
        this.scenario.roadWidth || 14,
        this.scenario.centerlineWaypoints || []
      );
      this.currentPlannerOutput = plannerOutput;

      // 2. Update Kinematic Bicycle Model for Ego Vehicle
      // \dot{x} = v * cos(theta)
      // \dot{y} = v * sin(theta)
      // \dot{theta} = (v / L) * tan(delta)
      // \dot{v} = a
      this.ego.steerAngle = plannerOutput.targetSteer;
      this.ego.accel = plannerOutput.targetAccel;

      // Update speed
      this.ego.speed = Math.max(0, this.ego.speed + this.ego.accel * scaledDt);

      // Update heading via yaw rate
      const yawRate = (this.ego.speed / (this.ego.wheelbase || 2.7)) * Math.tan(this.ego.steerAngle);
      this.ego.heading += yawRate * scaledDt;
      this.ego.heading = this.normalizeAngle(this.ego.heading);

      // Update position
      const dx = this.ego.speed * Math.cos(this.ego.heading) * scaledDt;
      const dy = this.ego.speed * Math.sin(this.ego.heading) * scaledDt;
      this.ego.x += dx;
      this.ego.y += dy;

      // Instantaneous path curvature kappa = yawRate / v = tan(delta) / L
      this.ego.curvature = Math.tan(this.ego.steerAngle) / (this.ego.wheelbase || 2.7);
    }

    // 3. Update Dynamic Obstacles Kinematics
    this.updateObstacles(scaledDt);

    // 4. Check Collisions & Min Clearance with Dynamic Traffic
    const stepDist = Math.hypot(this.ego.x - prevX, this.ego.y - prevY);
    let stepMinClearance = Infinity;

    for (const obs of this.obstacles) {
      const centerDist = Math.hypot(this.ego.x - obs.x, this.ego.y - obs.y);
      const clearance = Math.max(0, centerDist - (this.ego.radius + obs.radius));
      if (clearance < stepMinClearance) {
        stepMinClearance = clearance;
      }

      // Check collision
      if (clearance <= 0.05) {
        this.metrics.collisionCount++;
      }
    }

    // 5. Check Pothole Avoidance & Wheel Crater Drop/Impacts
    for (const pot of this.potholes) {
      const potDist = Math.hypot(this.ego.x - pot.x, this.ego.y - pot.y);
      const potClearance = Math.max(0, potDist - (this.ego.radius + pot.radius));
      if (potClearance < stepMinClearance) {
        stepMinClearance = potClearance;
      }

      // Wheel dropped directly into deep pothole
      if (potDist < (pot.radius + 0.35)) {
        this.metrics.potholeImpacts++;
        // Mechanical chassis impact slows down vehicle
        this.ego.speed = Math.max(0.5, this.ego.speed - 1.2 * scaledDt);
      } else if (
        potDist < (pot.radius + 3.0) &&
        prevX < pot.x &&
        this.ego.x >= pot.x
      ) {
        // Vehicle safely passed alongside the pothole without tire impact
        this.metrics.potholesAvoided++;
      }
    }

    // 6. Check Unrailed Road Edge Protection (Prevent slipping down into the bushes)
    const roadCenterY = this.supervisor.apfPlanner.getRoadCenterY(
      this.ego.x,
      this.scenario.centerlineWaypoints
    );
    const halfRoad = (this.scenario.roadWidth || 14) / 2;
    const distToLeftEdge = (roadCenterY + halfRoad) - (this.ego.y + this.ego.width / 2);
    const distToRightEdge = (this.ego.y - this.ego.width / 2) - (roadCenterY - halfRoad);
    const edgeMargin = Math.min(distToLeftEdge, distToRightEdge);
    this.metrics.edgeClearance = edgeMargin;

    // If car slips completely off the unrailed road into the bushes
    if (edgeMargin < 0) {
      this.metrics.collisionCount++;
      // Deep mud/bush friction drag
      this.ego.speed = Math.max(0, this.ego.speed - 3.0 * scaledDt);
    }

    // 7. Update LiDAR and RADAR Sensor Perception
    this.perception = this.sensorPipeline.update(
      this.ego,
      this.obstacles,
      this.scenario,
      this.sensorConfig,
      scaledDt
    );

    this.metrics.minClearance = Math.min(this.metrics.minClearance, stepMinClearance);
    this.metrics.currentTTC = this.perception.sensorStats.closestTargetTTC;
    this.metrics.pathLength += stepDist;
    this.metrics.timeElapsed += scaledDt;
    this.metrics.totalFrames++;
    this.metrics.currentSpeed = this.ego.speed;
    this.metrics.currentCurvature = this.ego.curvature;
    this.metrics.computeLatencyMs = plannerOutput.computeLatencyMs;

    // Smoothness metric: \int \kappa^2 ds
    this.metrics.smoothness += Math.pow(this.ego.curvature, 2) * stepDist;

    // Lateral offset relative to centerline (if spline available)
    if (this.spline && this.spline.points.length > 2) {
      const frenet = this.spline.cartesianToFrenet(this.ego.x, this.ego.y);
      this.metrics.currentLateralOffset = frenet.d;
    } else {
      this.metrics.currentLateralOffset = Math.abs(this.ego.y - this.goal.y);
    }

    // Record trajectory point
    if (this.trajectoryHistory.length === 0 || 
        Math.hypot(this.ego.x - this.trajectoryHistory[this.trajectoryHistory.length - 1].x,
                   this.ego.y - this.trajectoryHistory[this.trajectoryHistory.length - 1].y) > 0.3) {
      this.trajectoryHistory.push({ x: this.ego.x, y: this.ego.y });
    }

    // Record history snapshot (for timeline scrubbing/replay)
    if (this.history.length < 3000) {
      this.history.push({
        timestamp: this.metrics.timeElapsed,
        ego: { ...this.ego },
        obstacles: JSON.parse(JSON.stringify(this.obstacles)),
        metrics: { ...this.metrics },
        plannerOutput: { ...plannerOutput }
      });
    }

    // 5. Check Goal Arrival / Termination
    const distToGoal = Math.hypot(this.goal.x - this.ego.x, this.goal.y - this.ego.y);
    if (distToGoal < 2.5 || (this.ego.x >= this.goal.x && Math.abs(this.ego.y - this.goal.y) < 4.0)) {
      this.isFinished = true;
      this.isRunning = false;
      this.isSuccess = this.metrics.collisionCount === 0;
      this.metrics.success = this.isSuccess;
    }

    // Replay log exhausted: the Simulink run has played out fully
    if (this.isReplayMode() && !this.isFinished) {
      const logEnd = this.replayLog[this.replayLog.length - 1].t;
      if (this.metrics.timeElapsed >= logEnd) {
        this.isFinished = true;
        this.isRunning = false;
        this.isSuccess = this.metrics.collisionCount === 0;
        this.metrics.success = this.isSuccess;
      }
    }

    // Timeout safety
    if (this.metrics.timeElapsed > 120) {
      this.isFinished = true;
      this.isRunning = false;
      this.isSuccess = false;
      this.metrics.success = false;
    }
  }

  private updateObstacles(dt: number): void {
    const halfRoad = (this.scenario.roadWidth || 14) / 2;

    for (const obs of this.obstacles) {
      if (obs.isStalled || obs.behavior === 'STALLED') continue;

      if (obs.behavior === 'CROSSING') {
        obs.x += obs.vx * dt;
        obs.y += obs.vy * dt;
        // Bounce or wrap crossing vehicles across intersection
        if (Math.abs(obs.y) > 40) {
          obs.vy = -obs.vy;
          obs.heading = obs.vy > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      } else if (obs.behavior === 'WANDERING') {
        // Indian cattle or vendor cart wandering randomly or sinusoidal
        obs.heading += (Math.sin(this.metrics.timeElapsed * 1.5 + obs.x) * 0.4) * dt;
        obs.vx = Math.cos(obs.heading) * obs.speed;
        obs.vy = Math.sin(obs.heading) * obs.speed;
        obs.x += obs.vx * dt;
        obs.y += obs.vy * dt;

        // Keep inside road bounds
        if (obs.y > halfRoad - 1.5) {
          obs.y = halfRoad - 1.5;
          obs.heading = -Math.abs(obs.heading);
        } else if (obs.y < -halfRoad + 1.5) {
          obs.y = -halfRoad + 1.5;
          obs.heading = Math.abs(obs.heading);
        }
      } else if (obs.behavior === 'AGGRESSIVE_CUT_IN') {
        obs.x += obs.vx * dt;
        obs.y += obs.vy * dt;
        if (obs.y > 1.5) obs.vy = -0.3;
        if (obs.y < -1.5) obs.vy = 0.3;
      } else {
        // LANE_FOLLOWING
        obs.x += obs.vx * dt;
        obs.y += obs.vy * dt;
      }
    }
  }

  public setPlannerMode(mode: PlannerType): void {
    this.supervisor.activePlannerMode = mode;
  }

  public addCustomObstacle(type: Agent['type'], x: number, y: number): void {
    const id = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let width = 1.0;
    let length = 1.0;
    let radius = 1.0;
    let color = '#f97316';
    let label = 'Custom Obstacle';
    let speed = 0;
    let behavior: Agent['behavior'] = 'STALLED';

    if (type === 'POTHOLE') {
      this.addCustomPothole(x, y);
      return;
    }

    if (type === 'CATTLE') {
      width = 1.1; length = 2.4; radius = 1.2; color = '#f8fafc'; label = 'Spawned Cow'; behavior = 'WANDERING'; speed = 0.2;
    } else if (type === 'AUTO_RICKSHAW') {
      width = 1.4; length = 2.7; radius = 1.0; color = '#eab308'; label = 'Spawned Auto'; behavior = 'LANE_FOLLOWING'; speed = 2.0;
    } else if (type === 'PEDESTRIAN') {
      width = 0.6; length = 0.6; radius = 0.5; color = '#ec4899'; label = 'Spawned Pedestrian'; behavior = 'CROSSING'; speed = 0.8;
    } else if (type === 'TRUCK') {
      width = 2.5; length = 6.5; radius = 2.0; color = '#ca8a04'; label = 'Spawned Tata Truck'; behavior = 'STALLED'; speed = 0;
    } else if (type === 'TWO_WHEELER') {
      width = 0.8; length = 1.9; radius = 0.7; color = '#f97316'; label = 'Spawned Scooter'; behavior = 'LANE_FOLLOWING'; speed = 3.0;
    }

    this.obstacles.push({
      id,
      type,
      x,
      y,
      vx: speed * 0.8,
      vy: 0,
      heading: 0,
      width,
      length,
      radius,
      color,
      label,
      speed,
      targetSpeed: speed,
      behavior
    });
  }

  public addCustomPothole(x: number, y: number, radius: number = 1.1, depth: number = 0.16, severity: Pothole['severity'] = 'SEVERE'): void {
    const id = `pothole-custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.potholes.push({
      id,
      x,
      y,
      radius,
      depth,
      severity
    });
  }

  public removePothole(id: string): void {
    this.potholes = this.potholes.filter(p => p.id !== id);
  }

  public removeObstacle(id: string): void {
    this.obstacles = this.obstacles.filter(o => o.id !== id);
  }

  public isReplayMode(): boolean {
    return this.replayActive && this.replayLog.length > 1;
  }

  /**
   * Synthesises a PlannerOutput from a logged Simulink frame so that every existing
   * UI component, metric and overlay keeps working without special-casing replay.
   */
  private buildReplayPlannerOutput(frame: ReplayFrame): PlannerOutput {
    const horizon = 8.0;
    const plannedPath: Point2D[] = [];
    for (let i = 0; i <= 8; i++) {
      const tAhead = this.metrics.timeElapsed + (i / 8) * horizon * 0.35;
      const f = sampleReplay(this.replayLog, tAhead);
      plannedPath.push({ x: f.x, y: f.y });
    }

    return {
      targetX: plannedPath[plannedPath.length - 1].x,
      targetY: plannedPath[plannedPath.length - 1].y,
      targetHeading: frame.heading,
      targetSpeed: frame.speed,
      targetSteer: frame.steer,
      targetAccel: frame.accel,
      plannedPath,
      activePlanner: 'MATLAB_REPLAY',
      detectedContext: this.supervisor.classifiedContext,
      computeLatencyMs: frame.latencyMs,
      infoMessage: `MATLAB/Simulink model-in-the-loop | logged planner: ${frame.activePlanner} | t=${frame.t.toFixed(2)}s`
    };
  }

  /** Attaches a parsed Simulink trajectory log and rewinds to its first frame. */
  public loadReplayLog(frames: ReplayFrame[], sourceName: string = 'simulink.csv'): void {
    this.replayLog = frames;
    this.replaySourceName = sourceName;
    this.replayActive = frames.length > 1;
    this.reset();
    if (this.replayActive) {
      const f0 = frames[0];
      this.ego.x = f0.x;
      this.ego.y = f0.y;
      this.ego.heading = this.normalizeAngle(f0.heading);
      this.ego.speed = f0.speed;
      this.trajectoryHistory = [{ x: this.ego.x, y: this.ego.y }];
    }
  }

  public clearReplayLog(): void {
    this.replayLog = [];
    this.replayActive = false;
    this.replaySourceName = '';
    this.reset();
  }

  public setReplayActive(active: boolean): void {
    this.replayActive = active && this.replayLog.length > 1;
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
}
