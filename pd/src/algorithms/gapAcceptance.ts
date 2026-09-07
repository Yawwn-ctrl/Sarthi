/**
 * Gap Acceptance & Merging Planner for Signal-less Uncontrolled Indian Intersections
 * Features FSM State Machine: APPROACH -> YIELD_AND_SCAN -> COMMIT_CROSS -> CLEAR_JUNCTION
 * Real-time Time-to-Collision (TTC) computation and locked straight-line crossing trajectory.
 */

import { Agent, EgoVehicleState, GapAcceptanceConfig, GapState, Point2D } from '../types/planner';

export class GapAcceptancePlanner {
  private config: GapAcceptanceConfig;
  public currentState: GapState = 'APPROACH';
  private commitTimestamp: number = 0;
  private lockedTrajectory: Point2D[] = [];
  private lockedCrossingHeading: number = 0;
  private crossStartPoint: Point2D = { x: 0, y: 0 };
  private junctionBox: { minX: number; maxX: number; minY: number; maxY: number } = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  constructor(config: GapAcceptanceConfig) {
    this.config = config;
  }

  public updateConfig(config: Partial<GapAcceptanceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public reset(): void {
    this.currentState = 'APPROACH';
    this.commitTimestamp = 0;
    this.lockedTrajectory = [];
    this.lockedCrossingHeading = 0;
    this.crossStartPoint = { x: 0, y: 0 };
  }

  public setJunctionBox(box: { minX: number; maxX: number; minY: number; maxY: number }): void {
    this.junctionBox = box;
  }

  /**
   * Plan trajectory and steering commands for intersection crossing
   */
  public plan(
    ego: EgoVehicleState,
    goal: Point2D,
    obstacles: Agent[],
    yieldLine: { x: number; y: number },
    conflictZone: Point2D[]
  ): {
    targetX: number;
    targetY: number;
    targetHeading: number;
    targetSpeed: number;
    targetSteer: number;
    targetAccel: number;
    plannedPath: Point2D[];
    fsmState: GapState;
    minTTC: number;
    safeGapAvailable: boolean;
    infoMessage: string;
    intersectingObstacles: { id: string; ttc: number; dist: number; speed: number }[];
  } {
    // 1. Calculate Time-to-Collision (TTC) for all crossing obstacles
    // Conflict center or conflict zone
    const conflictX = (this.junctionBox.minX + this.junctionBox.maxX) / 2 || yieldLine.x + 10;
    const conflictY = (this.junctionBox.minY + this.junctionBox.maxY) / 2 || yieldLine.y;

    const intersectingObstacles: { id: string; ttc: number; dist: number; speed: number }[] = [];
    let minTTC = Infinity;

    for (const obs of obstacles) {
      // Calculate distance to ego's crossing corridor
      const distToConflict = Math.hypot(conflictX - obs.x, conflictY - obs.y);
      const obsSpeed = Math.max(0.1, Math.hypot(obs.vx, obs.vy));

      // Check if obstacle is moving towards conflict zone
      const dirToConflictX = (conflictX - obs.x) / distToConflict;
      const dirToConflictY = (conflictY - obs.y) / distToConflict;
      const velocityDot = (obs.vx * dirToConflictX + obs.vy * dirToConflictY) / obsSpeed;

      // If obstacle is approaching the intersection corridor
      if (velocityDot > 0.3 || (Math.abs(obs.x - conflictX) < 15 && Math.abs(obs.y - conflictY) < 15)) {
        const ttc = distToConflict / obsSpeed;
        obs.ttc = ttc;
        intersectingObstacles.push({
          id: obs.id,
          ttc,
          dist: distToConflict,
          speed: obsSpeed
        });

        if (ttc < minTTC && distToConflict < 35.0) {
          minTTC = ttc;
        }
      }
    }

    const safeGapAvailable = minTTC > this.config.tau_crit;

    // 2. Distance from Ego to Yield Line
    const distToYield = Math.hypot(yieldLine.x - ego.x, yieldLine.y - ego.y);
    const inJunctionBox = ego.x >= this.junctionBox.minX && ego.x <= this.junctionBox.maxX &&
                          ego.y >= this.junctionBox.minY && ego.y <= this.junctionBox.maxY;

    let infoMsg = '';
    let targetSpeed = this.config.approach_speed;
    let targetAccel = 0;
    let targetSteer = 0;
    let targetHeading = ego.heading;

    // 3. FSM State Transitions
    switch (this.currentState) {
      case 'APPROACH': {
        infoMsg = `Gap Acceptance: APPROACHING Intersection (Dist to yield: ${distToYield.toFixed(1)}m)`;
        // Slow down smoothly as we approach yield line
        if (distToYield < this.config.yield_distance + 3.0) {
          this.currentState = 'YIELD_AND_SCAN';
        } else {
          targetSpeed = this.config.approach_speed;
          targetAccel = (targetSpeed - ego.speed) * 0.8;
        }
        break;
      }

      case 'YIELD_AND_SCAN': {
        // Evaluate critical gap: if min(TTC) > tau_crit, commit cross!
        if (safeGapAvailable && distToYield < this.config.yield_distance + 6.0) {
          this.currentState = 'COMMIT_CROSS';
          this.commitTimestamp = performance.now();
          this.crossStartPoint = { x: ego.x, y: ego.y };
          this.lockedCrossingHeading = Math.atan2(goal.y - ego.y, goal.x - ego.x);
          this.generateLockedTrajectory(ego, goal);
          infoMsg = `Gap Acceptance: SAFE GAP DETECTED (TTC = ${minTTC === Infinity ? '∞' : minTTC.toFixed(1)}s > ${this.config.tau_crit}s) -> COMMITTING CROSS!`;
        } else {
          // Yield before the line: bring speed to near stop (0.2 m/s or 0)
          infoMsg = `Gap Acceptance: YIELD & SCAN (Min TTC: ${minTTC.toFixed(1)}s <= ${this.config.tau_crit}s threshold - Waiting for gap)`;
          const creepDist = Math.max(0.0, distToYield - this.config.yield_distance);
          targetSpeed = Math.min(1.5, creepDist * 0.4);
          targetAccel = (targetSpeed - ego.speed) * 1.5;
        }
        break;
      }

      case 'COMMIT_CROSS': {
        // Once COMMIT_CROSS is active: lock into straight-line trajectory across box with uniform acceleration!
        // Prohibit hesitations, mid-box stops, or lateral swerving.
        infoMsg = `Gap Acceptance: COMMIT CROSS ACTIVE! Straight-Line Acceleration through Intersection Box`;
        targetSpeed = Math.min(this.config.cross_speed_max, ego.speed + this.config.cross_accel * 0.1);
        targetAccel = this.config.cross_accel;
        targetHeading = this.lockedCrossingHeading;

        // Check if ego has cleared the junction conflict box
        const pastJunction = ego.x > (this.junctionBox.maxX || yieldLine.x + 20);
        if (pastJunction || !inJunctionBox && distToYield > 18.0) {
          this.currentState = 'CLEAR_JUNCTION';
        }
        break;
      }

      case 'CLEAR_JUNCTION': {
        infoMsg = 'Gap Acceptance: CLEAR JUNCTION -> Resuming normal cruise towards goal';
        targetSpeed = this.config.approach_speed * 1.4;
        targetAccel = (targetSpeed - ego.speed) * 1.0;
        targetHeading = Math.atan2(goal.y - ego.y, goal.x - ego.x);
        break;
      }
    }

    // 4. Generate Straight Line Locked Path
    const plannedPath: Point2D[] = [];
    const pathSteps = 30;
    const stepDist = 1.0;
    let currX = ego.x;
    let currY = ego.y;

    const angleToFollow = (this.currentState === 'COMMIT_CROSS') 
      ? this.lockedCrossingHeading 
      : Math.atan2(goal.y - ego.y, goal.x - ego.x);

    for (let i = 0; i < pathSteps; i++) {
      plannedPath.push({ x: currX, y: currY });
      currX += Math.cos(angleToFollow) * stepDist;
      currY += Math.sin(angleToFollow) * stepDist;
    }

    // Steering control
    const headingError = this.normalizeAngle(angleToFollow - ego.heading);
    targetSteer = Math.max(-0.5, Math.min(0.5, headingError * 1.0));

    return {
      targetX: ego.x + Math.cos(angleToFollow) * 2.0,
      targetY: ego.y + Math.sin(angleToFollow) * 2.0,
      targetHeading: angleToFollow,
      targetSpeed,
      targetSteer,
      targetAccel,
      plannedPath,
      fsmState: this.currentState,
      minTTC,
      safeGapAvailable,
      infoMessage: infoMsg,
      intersectingObstacles
    };
  }

  private generateLockedTrajectory(ego: EgoVehicleState, goal: Point2D): void {
    this.lockedTrajectory = [];
    const totalDist = 40.0;
    const steps = 40;
    const dx = Math.cos(this.lockedCrossingHeading);
    const dy = Math.sin(this.lockedCrossingHeading);

    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * totalDist;
      this.lockedTrajectory.push({
        x: ego.x + dx * d,
        y: ego.y + dy * d
      });
    }
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
}
