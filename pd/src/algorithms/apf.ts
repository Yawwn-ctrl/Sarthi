/**
 * Artificial Potential Field (APF) Planner
 * Specially formulated for Dense Indian Market Contexts with Heterogeneous Traffic,
 * Local Minima Trap Escape (Deterministic Tangential Sliding),
 * Non-Holonomic Heading Constraints, and Momentum Stabilization.
 */

import { Agent, APFConfig, EgoVehicleState, Point2D, Pothole, Vector2D } from '../types/planner';

export class APFPlanner {
  private config: APFConfig;
  private prevVelocityVector: Vector2D = { x: 0, y: 0 };
  private trapCounter: number = 0;
  private isEscapingTrap: boolean = false;
  private escapeDirection: number = 1; // +1 or -1 for tangential slide direction

  constructor(config: APFConfig) {
    this.config = config;
  }

  public updateConfig(config: Partial<APFConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public reset(): void {
    this.prevVelocityVector = { x: 0, y: 0 };
    this.trapCounter = 0;
    this.isEscapingTrap = false;
    this.escapeDirection = 1;
  }

  /**
   * Helper to interpolate road center Y at a given X along waypoints
   */
  public getRoadCenterY(x: number, waypoints?: Point2D[]): number {
    if (!waypoints || waypoints.length === 0) return 0;
    if (waypoints.length === 1) return waypoints[0].y;

    if (x <= waypoints[0].x) return waypoints[0].y;
    if (x >= waypoints[waypoints.length - 1].x) return waypoints[waypoints.length - 1].y;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      if (x >= p1.x && x <= p2.x) {
        const span = p2.x - p1.x || 0.001;
        const ratio = (x - p1.x) / span;
        return p1.y + ratio * (p2.y - p1.y);
      }
    }
    return 0;
  }

  /**
   * Compute APF trajectory and steering control with Pothole Repulsion and Unrailed Edge Guard
   */
  public plan(
    ego: EgoVehicleState,
    goal: Point2D,
    obstacles: Agent[],
    previewHorizonSteps: number = 25,
    dt: number = 0.1,
    potholes: Pothole[] = [],
    roadWidth: number = 14,
    centerlineWaypoints: Point2D[] = []
  ): {
    targetX: number;
    targetY: number;
    targetHeading: number;
    targetSpeed: number;
    targetSteer: number;
    targetAccel: number;
    plannedPath: Point2D[];
    forceVectors: { x: number; y: number; fx: number; fy: number }[];
    isTrapDetected: boolean;
    infoMessage: string;
    imaginaryCenterline: Point2D[];
    potholeRepulsionActive: boolean;
    roadEdgeWarning: boolean;
  } {
    const startTime = performance.now();

    // 1. Calculate attractive force
    const distToGoal = Math.hypot(goal.x - ego.x, goal.y - ego.y);
    const dirGoalX = (goal.x - ego.x) / Math.max(0.001, distToGoal);
    const dirGoalY = (goal.y - ego.y) / Math.max(0.001, distToGoal);

    // Conical-quadratic blend for attractive force to prevent explosion at long distances
    const dGoalSwitch = 20.0;
    let fattMag = 0;
    if (distToGoal <= dGoalSwitch) {
      fattMag = this.config.k_att * distToGoal;
    } else {
      fattMag = this.config.k_att * dGoalSwitch; // Linear plateau
    }
    const fAtt: Vector2D = {
      x: fattMag * dirGoalX,
      y: fattMag * dirGoalY
    };

    // 2a. Calculate repulsive force from heterogeneous dynamic obstacles
    let fRep: Vector2D = { x: 0, y: 0 };
    let nearestObsDist = Infinity;
    let nearestObsDir: Vector2D = { x: 0, y: 0 };

    for (const obs of obstacles) {
      // Dynamic predictive center offset based on obstacle velocity
      const predT = 0.5; // Lookahead seconds for dynamic obstacle
      const obsPredX = obs.x + obs.vx * predT;
      const obsPredY = obs.y + obs.vy * predT;

      const dx = ego.x - obsPredX;
      const dy = ego.y - obsPredY;
      const centerDist = Math.hypot(dx, dy);

      // Heterogeneous radius compensation
      const effectiveRadius = (ego.radius || 1.2) + (obs.radius || 1.0);
      const surfaceDist = Math.max(0.01, centerDist - effectiveRadius);

      if (surfaceDist < nearestObsDist) {
        nearestObsDist = surfaceDist;
        nearestObsDir = { x: dx / Math.max(0.001, centerDist), y: dy / Math.max(0.001, centerDist) };
      }

      if (surfaceDist <= this.config.d_0) {
        // Repulsive formula: F_rep = k_rep * (1/d - 1/d0) * (1/d^2) * unit_vector
        const factor = this.config.k_rep * (1.0 / surfaceDist - 1.0 / this.config.d_0) * (1.0 / (surfaceDist * surfaceDist));
        
        // Agent-type specific sensitivity (e.g. cattle and pedestrians are given wider repulsion buffers)
        let agentWeight = 1.0;
        if (obs.type === 'CATTLE') agentWeight = 1.5;
        if (obs.type === 'PEDESTRIAN') agentWeight = 1.4;
        if (obs.type === 'AUTO_RICKSHAW') agentWeight = 1.2;

        const ux = dx / Math.max(0.001, centerDist);
        const uy = dy / Math.max(0.001, centerDist);

        fRep.x += factor * agentWeight * ux;
        fRep.y += factor * agentWeight * uy;
      }
    }

    // 2b. Calculate repulsive force from FIXED POTHOLES (Crater Repulsive Potential)
    let potholeRepulsionActive = false;
    for (const pot of potholes) {
      const dx = ego.x - pot.x;
      const dy = ego.y - pot.y;
      const centerDist = Math.hypot(dx, dy);
      const potRadius = pot.radius || 1.1;
      const effectiveRadius = (ego.radius || 1.2) + potRadius;
      const surfaceDist = Math.max(0.01, centerDist - effectiveRadius);

      if (surfaceDist < nearestObsDist) {
        nearestObsDist = surfaceDist;
        nearestObsDir = { x: dx / Math.max(0.001, centerDist), y: dy / Math.max(0.001, centerDist) };
      }

      // Potholes have severe tire damage/traction disruption risk; influence range extends ahead
      const influenceDist = Math.max(this.config.d_0 * 0.9, potRadius + 3.2);
      if (surfaceDist <= influenceDist) {
        potholeRepulsionActive = true;
        const severityMultiplier = pot.severity === 'SEVERE' ? 2.2 : pot.severity === 'MILD' ? 1.3 : 1.7;
        const factor = (this.config.k_rep * severityMultiplier) *
          (1.0 / surfaceDist - 1.0 / influenceDist) *
          (1.0 / (surfaceDist * surfaceDist));

        const ux = dx / Math.max(0.001, centerDist);
        const uy = dy / Math.max(0.001, centerDist);

        fRep.x += factor * ux;
        fRep.y += factor * uy;
      }
    }

    // 2c. Road Edge with No Railings - Anti-Slip Repulsive Barrier (Prevent sliding into bushes)
    const roadCenterAtEgo = this.getRoadCenterY(ego.x, centerlineWaypoints);
    const halfRoad = (roadWidth || 14) / 2;
    const leftEdgeY = roadCenterAtEgo + halfRoad;
    const rightEdgeY = roadCenterAtEgo - halfRoad;

    const distToLeftEdge = leftEdgeY - (ego.y + (ego.width || 1.8) / 2);
    const distToRightEdge = (ego.y - (ego.width || 1.8) / 2) - rightEdgeY;
    const edgeInfluenceMargin = 3.0; // Margin in meters where danger of falling into bushes triggers

    let roadEdgeWarning = false;
    let fEdge: Vector2D = { x: 0, y: 0 };

    if (distToLeftEdge < edgeInfluenceMargin) {
      roadEdgeWarning = true;
      const dEdge = Math.max(0.05, distToLeftEdge);
      const edgeFactor = (this.config.k_rep * 2.0) *
        (1.0 / dEdge - 1.0 / edgeInfluenceMargin) *
        (1.0 / (dEdge * dEdge));
      fEdge.y -= edgeFactor; // Push rightward (away from left bush edge)
    }

    if (distToRightEdge < edgeInfluenceMargin) {
      roadEdgeWarning = true;
      const dEdge = Math.max(0.05, distToRightEdge);
      const edgeFactor = (this.config.k_rep * 2.0) *
        (1.0 / dEdge - 1.0 / edgeInfluenceMargin) *
        (1.0 / (dEdge * dEdge));
      fEdge.y += edgeFactor; // Push leftward (away from right bush edge)
    }

    // 2d. Imaginary Center Line Initiating from the Car
    // Initiates directly at (ego.x, ego.y) and projects forward smoothly toward the road centerline,
    // providing a virtual dynamic target corridor that avoids the unguarded road edges.
    const imaginaryCenterline: Point2D[] = [{ x: ego.x, y: ego.y }];
    const lookaheadDistance = 32.0;
    const lookaheadStep = 1.6;
    const stepsCount = Math.floor(lookaheadDistance / lookaheadStep);

    for (let i = 1; i <= stepsCount; i++) {
      const sDist = i * lookaheadStep;
      // Project along vehicle's current longitudinal heading
      const aheadX = ego.x + sDist * Math.cos(ego.heading);
      const roadCenterY = this.getRoadCenterY(aheadX, centerlineWaypoints);
      // Smooth exponential convergence from car's current lateral offset to road center
      const blend = 1.0 - Math.exp(-sDist / 8.5);
      const aheadY = ego.y * (1.0 - blend) + roadCenterY * blend;
      imaginaryCenterline.push({ x: aheadX, y: aheadY });
    }

    // Virtual centering attraction toward the imaginary centerline (stabilizes unrailed driving)
    const lateralDeviationFromCenter = ego.y - roadCenterAtEgo;
    const fVirtualCentering: Vector2D = {
      x: 0,
      y: -0.45 * lateralDeviationFromCenter
    };

    // 3. Momentum Vector Inertia (Reduces oscillations between close obstacles)
    const currentSpeed = Math.max(0.1, ego.speed);
    const forwardVec: Vector2D = {
      x: Math.cos(ego.heading) * currentSpeed,
      y: Math.sin(ego.heading) * currentSpeed
    };

    // Blend previous velocity vector with current heading
    if (this.prevVelocityVector.x === 0 && this.prevVelocityVector.y === 0) {
      this.prevVelocityVector = forwardVec;
    }

    const fMomentum: Vector2D = {
      x: this.config.alpha_momentum * this.prevVelocityVector.x,
      y: this.config.alpha_momentum * this.prevVelocityVector.y
    };

    // 4. Raw Total Force
    let fTotal: Vector2D = {
      x: fAtt.x + fRep.x + fEdge.x + fVirtualCentering.x + fMomentum.x,
      y: fAtt.y + fRep.y + fEdge.y + fVirtualCentering.y + fMomentum.y
    };

    const totalMag = Math.hypot(fTotal.x, fTotal.y);

    // 5. Anti-Loop & Local Minima Zero-Gradient Trap Detection
    const isTrapDetected = (totalMag < 0.6 && distToGoal > 3.0 && nearestObsDist < this.config.d_0 * 0.9) ||
      (nearestObsDist < 1.8 && Math.abs(fAtt.x + fRep.x) < 1.0 && Math.abs(fAtt.y + fRep.y) < 1.0);

    let infoMsg = 'APF: Standard Potential Field';
    if (potholeRepulsionActive && roadEdgeWarning) {
      infoMsg = 'APF: Pothole Avoidance & Unrailed Edge Guard Active (Bushes Slip Defense)';
    } else if (potholeRepulsionActive) {
      infoMsg = 'APF: Pothole Repulsion Active -> Steering Around Road Depression';
    } else if (roadEdgeWarning) {
      infoMsg = 'APF: Unrailed Road Edge Warning -> Restoring to Imaginary Centerline';
    }

    if (isTrapDetected) {
      this.trapCounter++;
      this.isEscapingTrap = true;
      infoMsg = 'APF: Local Minima Trap Detected -> Deterministic Tangential Escape Activated';

      // Pick deterministic flank direction:
      const tangent1: Vector2D = { x: -nearestObsDir.y, y: nearestObsDir.x };
      const tangent2: Vector2D = { x: nearestObsDir.y, y: -nearestObsDir.x };

      // Choose tangent that has positive dot product with goal direction
      const dot1 = tangent1.x * dirGoalX + tangent1.y * dirGoalY;
      const dot2 = tangent2.x * dirGoalX + tangent2.y * dirGoalY;
      const bestTangent = dot1 >= dot2 ? tangent1 : tangent2;

      // Inject deterministic tangential sliding force
      const escapeMag = this.config.escapeGain * this.config.k_att * 2.5;
      fTotal.x += bestTangent.x * escapeMag;
      fTotal.y += bestTangent.y * escapeMag;
    } else {
      if (this.trapCounter > 0) this.trapCounter--;
      if (this.trapCounter === 0) this.isEscapingTrap = false;
    }

    // 6. Non-Holonomic Heading Constraint
    let desiredAngle = Math.atan2(fTotal.y, fTotal.x);
    let headingDiff = this.normalizeAngle(desiredAngle - ego.heading);

    let targetSpeed = this.config.v_max;

    if (Math.abs(headingDiff) > Math.PI / 2) {
      // Backward force requested - clamp to sideways steer and decelerate
      infoMsg = 'APF: Non-Holonomic Constraint -> Decelerating';
      const sign = headingDiff > 0 ? 1 : -1;
      desiredAngle = ego.heading + sign * (Math.PI / 2.2);
      headingDiff = this.normalizeAngle(desiredAngle - ego.heading);
      targetSpeed = Math.max(0.0, targetSpeed * 0.2);
    } else {
      const turnPenalty = Math.max(0.3, Math.cos(headingDiff));
      const proxPenalty = Math.min(1.0, nearestObsDist / (this.config.d_0 * 0.7));
      targetSpeed = this.config.v_max * turnPenalty * proxPenalty;
    }

    // If approaching pothole directly ahead, decelerate for suspension safety
    if (potholeRepulsionActive) {
      targetSpeed = Math.min(targetSpeed, this.config.v_max * 0.7);
    }

    if (distToGoal < 4.0) {
      targetSpeed = Math.min(targetSpeed, (distToGoal / 4.0) * this.config.v_max);
    }

    // 7. Generate Simulated Path Horizon for Preview
    const plannedPath: Point2D[] = [{ x: ego.x, y: ego.y }];
    let simX = ego.x;
    let simY = ego.y;
    let simHeading = ego.heading;
    let simSpeed = Math.max(0.5, targetSpeed);

    for (let step = 1; step <= previewHorizonSteps; step++) {
      const stepGoalDist = Math.hypot(goal.x - simX, goal.y - simY);
      if (stepGoalDist < 0.5) break;

      const sDirX = (goal.x - simX) / Math.max(0.001, stepGoalDist);
      const sDirY = (goal.y - simY) / Math.max(0.001, stepGoalDist);
      let sFx = this.config.k_att * sDirX;
      let sFy = this.config.k_att * sDirY;

      // Obstacle repulsion in simulation
      for (const obs of obstacles) {
        const odx = simX - (obs.x + obs.vx * (step * dt));
        const ody = simY - (obs.y + obs.vy * (step * dt));
        const oDist = Math.max(0.01, Math.hypot(odx, ody) - (ego.radius + obs.radius));
        if (oDist <= this.config.d_0) {
          const factor = this.config.k_rep * (1.0 / oDist - 1.0 / this.config.d_0) * (1.0 / (oDist * oDist));
          sFx += factor * (odx / Math.max(0.001, Math.hypot(odx, ody)));
          sFy += factor * (ody / Math.max(0.001, Math.hypot(odx, ody)));
        }
      }

      // Pothole repulsion in simulation
      for (const pot of potholes) {
        const pdx = simX - pot.x;
        const pdy = simY - pot.y;
        const pDist = Math.max(0.01, Math.hypot(pdx, pdy) - (ego.radius + pot.radius));
        const pInf = Math.max(this.config.d_0 * 0.9, pot.radius + 3.0);
        if (pDist <= pInf) {
          const factor = (this.config.k_rep * 1.6) * (1.0 / pDist - 1.0 / pInf) * (1.0 / (pDist * pDist));
          sFx += factor * (pdx / Math.max(0.001, Math.hypot(pdx, pdy)));
          sFy += factor * (pdy / Math.max(0.001, Math.hypot(pdx, pdy)));
        }
      }

      // Road edge barrier repulsion in simulation
      const rCenter = this.getRoadCenterY(simX, centerlineWaypoints);
      const dL = (rCenter + halfRoad) - simY;
      const dR = simY - (rCenter - halfRoad);
      if (dL < 2.5) {
        sFy -= (this.config.k_rep * 1.5) * (1.0 / Math.max(0.05, dL) - 1.0 / 2.5);
      }
      if (dR < 2.5) {
        sFy += (this.config.k_rep * 1.5) * (1.0 / Math.max(0.05, dR) - 1.0 / 2.5);
      }

      const sAngle = Math.atan2(sFy, sFx);
      const sDiff = this.normalizeAngle(sAngle - simHeading);
      const clampedDiff = Math.max(-0.35, Math.min(0.35, sDiff));
      simHeading += clampedDiff * 0.7;

      simX += Math.cos(simHeading) * simSpeed * dt;
      simY += Math.sin(simHeading) * simSpeed * dt;
      plannedPath.push({ x: simX, y: simY });
    }

    // Update internal momentum vector
    const targetVx = Math.cos(ego.heading) * targetSpeed;
    const targetVy = Math.sin(ego.heading) * targetSpeed;
    this.prevVelocityVector = {
      x: 0.8 * this.prevVelocityVector.x + 0.2 * targetVx,
      y: 0.8 * this.prevVelocityVector.y + 0.2 * targetVy
    };

    // Calculate steering control output
    const maxSteer = 0.55;
    const steerGain = 0.85;
    const targetSteer = Math.max(-maxSteer, Math.min(maxSteer, headingDiff * steerGain));

    const speedDiff = targetSpeed - ego.speed;
    const targetAccel = Math.max(-3.0, Math.min(2.0, speedDiff * 1.5));

    // Force vectors sample for visual canvas overlay (ego neighborhood)
    const forceVectors = this.sampleForceField(ego, goal, obstacles, potholes, roadWidth, centerlineWaypoints);

    return {
      targetX: ego.x + Math.cos(desiredAngle) * 2.0,
      targetY: ego.y + Math.sin(desiredAngle) * 2.0,
      targetHeading: desiredAngle,
      targetSpeed: Math.max(0, targetSpeed),
      targetSteer,
      targetAccel,
      plannedPath,
      forceVectors,
      isTrapDetected,
      infoMessage: infoMsg,
      imaginaryCenterline,
      potholeRepulsionActive,
      roadEdgeWarning
    };
  }

  private sampleForceField(
    ego: EgoVehicleState,
    goal: Point2D,
    obstacles: Agent[],
    potholes: Pothole[] = [],
    roadWidth: number = 14,
    centerlineWaypoints: Point2D[] = []
  ): { x: number; y: number; fx: number; fy: number }[] {
    const vectors: { x: number; y: number; fx: number; fy: number }[] = [];
    const radius = 18;
    const step = 4.0;
    const halfRoad = (roadWidth || 14) / 2;

    for (let gx = ego.x - radius; gx <= ego.x + radius; gx += step) {
      for (let gy = ego.y - radius; gy <= ego.y + radius; gy += step) {
        const dGoal = Math.hypot(goal.x - gx, goal.y - gy);
        const dirGx = (goal.x - gx) / Math.max(0.001, dGoal);
        const dirGy = (goal.y - gy) / Math.max(0.001, dGoal);

        let fx = this.config.k_att * dirGx;
        let fy = this.config.k_att * dirGy;

        for (const obs of obstacles) {
          const dx = gx - obs.x;
          const dy = gy - obs.y;
          const dist = Math.max(0.01, Math.hypot(dx, dy) - (ego.radius + obs.radius));
          if (dist <= this.config.d_0) {
            const factor = this.config.k_rep * (1.0 / dist - 1.0 / this.config.d_0) * (1.0 / (dist * dist));
            fx += factor * (dx / Math.max(0.001, Math.hypot(dx, dy)));
            fy += factor * (dy / Math.max(0.001, Math.hypot(dx, dy)));
          }
        }

        // Pothole repulsion
        for (const pot of potholes) {
          const dx = gx - pot.x;
          const dy = gy - pot.y;
          const dist = Math.max(0.01, Math.hypot(dx, dy) - (ego.radius + pot.radius));
          const pInf = Math.max(this.config.d_0 * 0.9, pot.radius + 3.0);
          if (dist <= pInf) {
            const factor = (this.config.k_rep * 1.6) * (1.0 / dist - 1.0 / pInf) * (1.0 / (dist * dist));
            fx += factor * (dx / Math.max(0.001, Math.hypot(dx, dy)));
            fy += factor * (dy / Math.max(0.001, Math.hypot(dx, dy)));
          }
        }

        // Road edge barrier repulsion
        const rCenter = this.getRoadCenterY(gx, centerlineWaypoints);
        const dL = (rCenter + halfRoad) - gy;
        const dR = gy - (rCenter - halfRoad);
        if (dL < 2.5) {
          fy -= (this.config.k_rep * 1.2) * (1.0 / Math.max(0.05, dL) - 1.0 / 2.5);
        }
        if (dR < 2.5) {
          fy += (this.config.k_rep * 1.2) * (1.0 / Math.max(0.05, dR) - 1.0 / 2.5);
        }

        const mag = Math.hypot(fx, fy);
        if (mag > 0.001) {
          const normLength = Math.min(2.5, mag * 0.3);
          vectors.push({
            x: gx,
            y: gy,
            fx: (fx / mag) * normLength,
            fy: (fy / mag) * normLength
          });
        }
      }
    }
    return vectors;
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
}
