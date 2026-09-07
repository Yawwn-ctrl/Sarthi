/**
 * Frenet Frame Optimal Trajectory Planner
 * For Unstructured Village Roads and Rural Indian Corridors.
 * Generates quintic/quartic polynomial trajectories in curvilinear (s, d) space
 * with Strict Straight-Line Bias Cost Function to prevent lateral weaving.
 */

import { Agent, EgoVehicleState, FrenetConfig, FrenetPoint, FrenetTrajectory, Point2D, Pothole } from '../types/planner';
import { QuarticPolynomial, QuinticPolynomial, Spline2D } from './spline';

export class FrenetPlanner {
  private config: FrenetConfig;

  constructor(config: FrenetConfig) {
    this.config = config;
  }

  public updateConfig(config: Partial<FrenetConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Plan optimal trajectory in Frenet coordinate space
   */
  public plan(
    ego: EgoVehicleState,
    spline: Spline2D,
    obstacles: Agent[],
    timeHorizon: number = 2.5,
    dt: number = 0.1,
    potholes: Pothole[] = []
  ): {
    bestTrajectory: FrenetTrajectory | null;
    candidateTrajectories: FrenetTrajectory[];
    infoMessage: string;
    targetSpeed: number;
    targetSteer: number;
    targetAccel: number;
  } {
    if (!spline || spline.points.length < 2) {
      return {
        bestTrajectory: null,
        candidateTrajectories: [],
        infoMessage: 'Frenet: No valid centerline spline available',
        targetSpeed: 0,
        targetSteer: 0,
        targetAccel: 0
      };
    }

    // 1. Convert current ego Cartesian state to Frenet frame
    const { s: c_s, d: c_d } = spline.cartesianToFrenet(ego.x, ego.y);
    const closestPt = spline.getPointAtS(c_s);

    // Compute s_dot and d_dot from ego velocity and orientation
    const headingDiff = this.normalizeAngle(ego.heading - closestPt.theta);
    const c_speed = Math.max(0.1, ego.speed);
    const c_s_dot = c_speed * Math.cos(headingDiff);
    const c_d_dot = c_speed * Math.sin(headingDiff);
    const c_d_ddot = ego.accel * Math.sin(headingDiff);
    const c_s_ddot = ego.accel * Math.cos(headingDiff);

    const candidates: FrenetTrajectory[] = [];

    // 2. Sample Lateral Target Offsets d_e and Planning Horizons T
    const dStep = this.config.d_sample_step || 0.6; // e.g. [-3.0, -2.4, ..., 0, ..., 3.0]
    const dRange = this.config.d_sample_range || 2.8;
    const horizons = this.config.t_sample_horizons || [2.0, 2.5, 3.2];
    const targetSpeed = this.config.target_speed || 8.0;

    // Velocity samples around target speed
    const vSteps = [-1.5, 0.0, 1.5];

    for (let di = -dRange; di <= dRange + 0.01; di += dStep) {
      for (const T of horizons) {
        // Lateral quintic polynomial: d0 -> di, with target d_dot=0, d_ddot=0 at t=T
        const latPoly = new QuinticPolynomial(c_d, c_d_dot, c_d_ddot, di, 0.0, 0.0, T);

        for (const dv of vSteps) {
          const vTargetSample = Math.max(1.0, Math.min(this.config.max_speed, targetSpeed + dv));
          // Longitudinal quartic polynomial for velocity keeping
          const lonPoly = new QuarticPolynomial(c_s, c_s_dot, c_s_ddot, vTargetSample, 0.0, T);

          const traj = this.generateTrajectory(latPoly, lonPoly, spline, T, dt, obstacles, ego, potholes);
          if (traj) {
            candidates.push(traj);
          }
        }
      }
    }

    // 3. Find Minimum Cost Valid Trajectory
    let bestTraj: FrenetTrajectory | null = null;
    let minCost = Infinity;

    for (const cand of candidates) {
      if (cand.isValid && cand.totalCost < minCost) {
        minCost = cand.totalCost;
        bestTraj = cand;
      }
    }

    // Fallback: If all candidates are invalid due to extreme constraints, pick the safest candidate
    if (!bestTraj && candidates.length > 0) {
      candidates.sort((a, b) => a.collCost - b.collCost || a.totalCost - b.totalCost);
      bestTraj = candidates[0];
    }

    // 4. Compute Control Commands (target steer and acceleration)
    let cmdSteer = 0;
    let cmdAccel = 0;
    let cmdSpeed = targetSpeed;
    let infoMsg = 'Frenet: Tracking Centerline (Optimal Straight Path)';

    if (bestTraj && bestTraj.points.length > 2) {
      // Lookahead point on planned trajectory
      const lookaheadIdx = Math.min(bestTraj.points.length - 1, 4);
      const targetPt = bestTraj.points[lookaheadIdx];

      const dx = targetPt.x - ego.x;
      const dy = targetPt.y - ego.y;
      const targetAngle = Math.atan2(dy, dx);
      const angleErr = this.normalizeAngle(targetAngle - ego.heading);

      // Pure pursuit / proportional steering controller
      const maxSteer = 0.55;
      cmdSteer = Math.max(-maxSteer, Math.min(maxSteer, angleErr * 1.1 + targetPt.kappa * 0.4));
      cmdSpeed = Math.max(0, targetPt.s_dot);
      cmdAccel = Math.max(-4.0, Math.min(2.5, (cmdSpeed - ego.speed) * 1.2));

      if (Math.abs(bestTraj.points[bestTraj.points.length - 1].d) > 0.4) {
        infoMsg = `Frenet: Bypassing Obstacle (Offset: ${bestTraj.points[bestTraj.points.length - 1].d.toFixed(1)}m, Min Lateral Deviation)`;
      } else {
        infoMsg = 'Frenet: Strict Straight-Line Corridor Tracking (d ≈ 0)';
      }
    }

    return {
      bestTrajectory: bestTraj,
      candidateTrajectories: candidates,
      infoMessage: infoMsg,
      targetSpeed: cmdSpeed,
      targetSteer: cmdSteer,
      targetAccel: cmdAccel
    };
  }

  private generateTrajectory(
    latPoly: QuinticPolynomial,
    lonPoly: QuarticPolynomial,
    spline: Spline2D,
    T: number,
    dt: number,
    obstacles: Agent[],
    ego: EgoVehicleState,
    potholes: Pothole[] = []
  ): FrenetTrajectory | null {
    const points: FrenetPoint[] = [];
    const numSteps = Math.ceil(T / dt);

    let jLat = 0; // Lateral jerk sum
    let jLon = 0; // Longitudinal jerk sum
    let maxCurvature = 0;
    let isValid = true;
    let collRisk = 0;

    for (let step = 0; step <= numSteps; step++) {
      const t = step * dt;
      const d = latPoly.calcPoint(t);
      const d_dot = latPoly.calcFirstDerivative(t);
      const d_ddot = latPoly.calcSecondDerivative(t);
      const d_dddot = latPoly.calcThirdDerivative(t);

      const s = lonPoly.calcPoint(t);
      const s_dot = lonPoly.calcFirstDerivative(t);
      const s_ddot = lonPoly.calcSecondDerivative(t);
      const s_dddot = lonPoly.calcThirdDerivative(t);

      jLat += Math.pow(d_dddot, 2);
      jLon += Math.pow(s_dddot, 2);

      // Check boundary limits
      if (s_dot > this.config.max_speed || s_dot < -0.1) {
        isValid = false;
      }
      if (Math.abs(s_ddot) > this.config.max_accel || Math.abs(d_ddot) > this.config.max_accel) {
        isValid = false;
      }

      // Convert Frenet point to Cartesian space
      const cartesian = spline.frenetToCartesian(s, d);
      const theta = cartesian.theta + Math.atan2(d_dot, Math.max(0.1, s_dot));
      const kappa = cartesian.kappa + d_ddot / Math.pow(1 + d_dot * d_dot, 1.5);

      maxCurvature = Math.max(maxCurvature, Math.abs(kappa));
      if (Math.abs(kappa) > this.config.max_curvature) {
        isValid = false;
      }

      // Collision risk checking against obstacles
      for (const obs of obstacles) {
        // Dynamic prediction for obstacle at time t
        const obsX = obs.x + obs.vx * t;
        const obsY = obs.y + obs.vy * t;
        const dist = Math.hypot(cartesian.x - obsX, cartesian.y - obsY);
        const safeRadius = (ego.radius || 1.2) + (obs.radius || 1.1);

        if (dist < safeRadius) {
          isValid = false;
          collRisk += 10000;
        } else if (dist < safeRadius + 1.2) {
          collRisk += (safeRadius + 1.2 - dist) * 200;
        }
      }

      // Collision risk checking against fixed potholes
      for (const pot of potholes) {
        const dist = Math.hypot(cartesian.x - pot.x, cartesian.y - pot.y);
        const safeRadius = (ego.radius || 1.2) + (pot.radius || 1.0);
        if (dist < safeRadius) {
          isValid = false;
          collRisk += 12000;
        } else if (dist < safeRadius + 1.0) {
          collRisk += (safeRadius + 1.0 - dist) * 250;
        }
      }

      points.push({
        s,
        d,
        s_dot,
        d_dot,
        s_ddot,
        d_ddot,
        t,
        x: cartesian.x,
        y: cartesian.y,
        theta,
        kappa,
        cost: 0,
        isValid
      });
    }

    // Final lateral offset & velocity
    const finalPt = points[points.length - 1];
    const dFinal = finalPt ? finalPt.d : 0;
    const dDotFinal = finalPt ? finalPt.d_dot : 0;
    const dDdotFinal = finalPt ? finalPt.d_ddot : 0;
    const sDotFinal = finalPt ? finalPt.s_dot : 0;

    // Strict Straight-Line Bias Cost Function:
    // J = w_d * d_final^2 + w_d_dot * d_dot^2 + w_d_ddot * d_ddot^2 + w_j * Jerk + w_coll * CollRisk + w_s * (v_target - s_dot)^2
    const c_d = this.config.w_d * Math.pow(dFinal, 2) +
                this.config.w_d_dot * Math.pow(dDotFinal, 2) +
                this.config.w_d_ddot * Math.pow(dDdotFinal, 2);

    const c_v = this.config.w_speed * Math.pow(this.config.target_speed - sDotFinal, 2);
    const c_jerk = this.config.w_jerk * (jLat + jLon);
    const c_coll = this.config.w_coll * collRisk;

    const totalCost = c_d + c_v + c_jerk + c_coll;

    return {
      points,
      totalCost,
      cd: c_d,
      cv: c_v,
      collCost: c_coll,
      jerkCost: c_jerk,
      isValid: isValid && collRisk < 5000
    };
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
}
