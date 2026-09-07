/**
 * Switching Supervisor & Context Classification Engine
 * Classifies ODD (Market, Village, Intersection) and manages seamless initial condition handoff
 * and steering/jerk rate limiters between planners.
 */

import { Agent, APFConfig, EgoVehicleState, FrenetConfig, GapAcceptanceConfig, PlannerOutput, PlannerType, Point2D, Pothole, RoadContext, SupervisorConfig } from '../types/planner';
import { APFPlanner } from './apf';
import { FrenetPlanner } from './frenet';
import { GapAcceptancePlanner } from './gapAcceptance';
import { Spline2D } from './spline';

export class SupervisorEngine {
  public apfPlanner: APFPlanner;
  public frenetPlanner: FrenetPlanner;
  public gapPlanner: GapAcceptancePlanner;
  public supervisorConfig: SupervisorConfig;

  public activePlannerMode: PlannerType = 'SUPERVISOR';
  public currentActiveSubPlanner: 'APF' | 'FRENET' | 'GAP_ACCEPTANCE' = 'APF';
  public classifiedContext: RoadContext = 'MARKET';

  // Smoothing states for continuous handoff
  private prevSteer: number = 0;
  private prevAccel: number = 0;
  private lastSwitchTimestamp: number = 0;

  constructor(
    apfCfg: APFConfig,
    frenetCfg: FrenetConfig,
    gapCfg: GapAcceptanceConfig,
    supervisorCfg: SupervisorConfig
  ) {
    this.apfPlanner = new APFPlanner(apfCfg);
    this.frenetPlanner = new FrenetPlanner(frenetCfg);
    this.gapPlanner = new GapAcceptancePlanner(gapCfg);
    this.supervisorConfig = supervisorCfg;
  }

  public reset(): void {
    this.apfPlanner.reset();
    this.gapPlanner.reset();
    this.prevSteer = 0;
    this.prevAccel = 0;
    this.lastSwitchTimestamp = 0;
  }

  /**
   * Rule-Based Context Classifier
   */
  public classifyContext(
    ego: EgoVehicleState,
    obstacles: Agent[],
    spline: Spline2D | null,
    intersectionZone?: { conflictPolygon: Point2D[]; entryLine: Point2D[] }
  ): RoadContext {
    // 1. Check if vehicle is within or approaching intersection conflict zone
    if (intersectionZone && intersectionZone.conflictPolygon && intersectionZone.conflictPolygon.length >= 3) {
      if (this.isPointInsidePolygon({ x: ego.x, y: ego.y }, intersectionZone.conflictPolygon)) {
        return 'INTERSECTION';
      }
      // Also check entry line proximity
      if (intersectionZone.entryLine && intersectionZone.entryLine.length >= 2) {
        const entryPt = intersectionZone.entryLine[0];
        const dEntry = Math.hypot(entryPt.x - ego.x, entryPt.y - ego.y);
        if (dEntry < 22.0 && ego.x <= entryPt.x + 2.0) {
          return 'INTERSECTION';
        }
      }
    }

    // 2. Measure local obstacle density within 25m radius around ego
    const localRadius = 25.0;
    let localObstacleCount = 0;
    let speedSum = 0;

    for (const obs of obstacles) {
      const dist = Math.hypot(obs.x - ego.x, obs.y - ego.y);
      if (dist <= localRadius) {
        localObstacleCount++;
        speedSum += Math.hypot(obs.vx, obs.vy);
      }
    }

    const density = (localObstacleCount / (Math.PI * localRadius * localRadius)) * 100; // per 100m^2
    const meanSpeed = localObstacleCount > 0 ? speedSum / localObstacleCount : 0;

    // Rule: Dense Market = High obstacle density & low mean speed
    if (density >= this.supervisorConfig.density_thresh || (localObstacleCount >= 4 && meanSpeed <= this.supervisorConfig.speed_low_thresh)) {
      return 'MARKET';
    }

    // Rule: Village = Continuous corridor boundaries with sparse/sporadic obstacles
    if (spline && spline.points.length > 5) {
      return 'VILLAGE';
    }

    return 'MARKET';
  }

  /**
   * Supervisor Master Planning Loop
   */
  public step(
    ego: EgoVehicleState,
    goal: Point2D,
    obstacles: Agent[],
    spline: Spline2D | null,
    intersectionZone?: { entryLine: Point2D[]; conflictPolygon: Point2D[]; exitLine: Point2D[] },
    dt: number = 0.05,
    potholes: Pothole[] = [],
    roadWidth: number = 14,
    centerlineWaypoints: Point2D[] = []
  ): PlannerOutput {
    const startTime = performance.now();

    // 1. Determine Operational Design Domain (ODD)
    this.classifiedContext = this.classifyContext(ego, obstacles, spline, intersectionZone);

    // 2. Determine which planner should execute
    let selectedPlanner: 'APF' | 'FRENET' | 'GAP_ACCEPTANCE' = 'APF';

    if (this.activePlannerMode === 'SUPERVISOR') {
      if (this.classifiedContext === 'INTERSECTION') {
        selectedPlanner = 'GAP_ACCEPTANCE';
      } else if (this.classifiedContext === 'VILLAGE') {
        selectedPlanner = 'FRENET';
      } else {
        selectedPlanner = 'APF';
      }
    } else {
      // Manual planner override forced by user
      if (this.activePlannerMode === 'FRENET') selectedPlanner = 'FRENET';
      else if (this.activePlannerMode === 'GAP_ACCEPTANCE') selectedPlanner = 'GAP_ACCEPTANCE';
      else selectedPlanner = 'APF';
    }

    // 3. Detect Planner Switch & Perform Seamless Initial Condition Handoff
    if (selectedPlanner !== this.currentActiveSubPlanner) {
      this.currentActiveSubPlanner = selectedPlanner;
      this.lastSwitchTimestamp = performance.now();
      // Reset sub-planner state if needed while preserving (x0, y0, theta0, v0, a0)
      if (selectedPlanner === 'GAP_ACCEPTANCE') {
        this.gapPlanner.reset();
      } else if (selectedPlanner === 'APF') {
        this.apfPlanner.reset();
      }
    }

    let rawOutput: {
      targetX: number;
      targetY: number;
      targetHeading: number;
      targetSpeed: number;
      targetSteer: number;
      targetAccel: number;
      plannedPath: Point2D[];
      infoMessage: string;
      frenetCandidates?: any[];
      apfForceVectors?: any[];
      gapFSMState?: any;
      imaginaryCenterline?: Point2D[];
      potholeRepulsionActive?: boolean;
      roadEdgeWarning?: boolean;
    };

    // Construct baseline imaginary centerline initiating from the car for safe corridor visual
    const fallbackImaginaryCenterline: Point2D[] = [{ x: ego.x, y: ego.y }];
    for (let s = 2.0; s <= 32.0; s += 2.0) {
      const aheadX = ego.x + s * Math.cos(ego.heading);
      const roadCenterY = this.apfPlanner.getRoadCenterY(aheadX, centerlineWaypoints);
      const blend = 1.0 - Math.exp(-s / 9.0);
      const aheadY = ego.y * (1.0 - blend) + roadCenterY * blend;
      fallbackImaginaryCenterline.push({ x: aheadX, y: aheadY });
    }

    // 4. Dispatch to Active Planner
    if (selectedPlanner === 'FRENET' && spline && spline.points.length > 2) {
      const frenetRes = this.frenetPlanner.plan(ego, spline, obstacles, 2.5, dt, potholes);
      const plannedPts = frenetRes.bestTrajectory 
        ? frenetRes.bestTrajectory.points.map(p => ({ x: p.x, y: p.y }))
        : [{ x: ego.x, y: ego.y }];

      rawOutput = {
        targetX: plannedPts[plannedPts.length - 1]?.x || goal.x,
        targetY: plannedPts[plannedPts.length - 1]?.y || goal.y,
        targetHeading: ego.heading + frenetRes.targetSteer,
        targetSpeed: frenetRes.targetSpeed,
        targetSteer: frenetRes.targetSteer,
        targetAccel: frenetRes.targetAccel,
        plannedPath: plannedPts,
        frenetCandidates: frenetRes.candidateTrajectories,
        infoMessage: frenetRes.infoMessage,
        imaginaryCenterline: fallbackImaginaryCenterline,
        potholeRepulsionActive: false,
        roadEdgeWarning: false
      };
    } else if (selectedPlanner === 'GAP_ACCEPTANCE') {
      const yieldLine = intersectionZone?.entryLine?.[0] || { x: ego.x + 15, y: ego.y };
      const conflictPoly = intersectionZone?.conflictPolygon || [];
      const gapRes = this.gapPlanner.plan(ego, goal, obstacles, yieldLine, conflictPoly);

      rawOutput = {
        targetX: gapRes.targetX,
        targetY: gapRes.targetY,
        targetHeading: gapRes.targetHeading,
        targetSpeed: gapRes.targetSpeed,
        targetSteer: gapRes.targetSteer,
        targetAccel: gapRes.targetAccel,
        plannedPath: gapRes.plannedPath,
        gapFSMState: gapRes.fsmState,
        infoMessage: gapRes.infoMessage,
        imaginaryCenterline: fallbackImaginaryCenterline,
        potholeRepulsionActive: false,
        roadEdgeWarning: false
      };
    } else {
      // APF Planner default with Pothole Repulsion and Unrailed Edge Slip Guard
      const apfRes = this.apfPlanner.plan(
        ego,
        goal,
        obstacles,
        25,
        dt,
        potholes,
        roadWidth,
        centerlineWaypoints
      );
      rawOutput = {
        targetX: apfRes.targetX,
        targetY: apfRes.targetY,
        targetHeading: apfRes.targetHeading,
        targetSpeed: apfRes.targetSpeed,
        targetSteer: apfRes.targetSteer,
        targetAccel: apfRes.targetAccel,
        plannedPath: apfRes.plannedPath,
        apfForceVectors: apfRes.forceVectors,
        infoMessage: apfRes.infoMessage,
        imaginaryCenterline: apfRes.imaginaryCenterline,
        potholeRepulsionActive: apfRes.potholeRepulsionActive,
        roadEdgeWarning: apfRes.roadEdgeWarning
      };
    }

    // 5. Apply Transition Smoothing Rate Limiters
    // Steer rate limit: |delta_steer / dt| <= steer_rate_limit
    const maxSteerDelta = this.supervisorConfig.steer_rate_limit * dt;
    const steerDiff = rawOutput.targetSteer - this.prevSteer;
    const smoothedSteer = this.prevSteer + Math.max(-maxSteerDelta, Math.min(maxSteerDelta, steerDiff));
    this.prevSteer = smoothedSteer;

    // Jerk rate limit: |delta_accel / dt| <= jerk_limit
    const maxAccelDelta = this.supervisorConfig.jerk_limit * dt;
    const accelDiff = rawOutput.targetAccel - this.prevAccel;
    const smoothedAccel = this.prevAccel + Math.max(-maxAccelDelta, Math.min(maxAccelDelta, accelDiff));
    this.prevAccel = smoothedAccel;

    const computeLatencyMs = performance.now() - startTime;

    return {
      targetX: rawOutput.targetX,
      targetY: rawOutput.targetY,
      targetHeading: rawOutput.targetHeading,
      targetSpeed: rawOutput.targetSpeed,
      targetSteer: smoothedSteer,
      targetAccel: smoothedAccel,
      plannedPath: rawOutput.plannedPath,
      activePlanner: selectedPlanner,
      frenetCandidates: rawOutput.frenetCandidates,
      apfForceVectors: rawOutput.apfForceVectors,
      imaginaryCenterline: rawOutput.imaginaryCenterline,
      potholeRepulsionActive: rawOutput.potholeRepulsionActive,
      roadEdgeWarning: rawOutput.roadEdgeWarning,
      gapFSMState: rawOutput.gapFSMState,
      detectedContext: this.classifiedContext,
      computeLatencyMs: Math.max(0.1, computeLatencyMs),
      infoMessage: rawOutput.infoMessage
    };
  }

  private isPointInsidePolygon(pt: Point2D, poly: Point2D[]): boolean {
    if (poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
