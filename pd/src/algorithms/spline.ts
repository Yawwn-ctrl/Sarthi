/**
 * Spline and Frenet Coordinate Geometry Engine
 * Implements Hermite / Cubic Spline interpolation and Cartesian <-> Frenet Frame transformations
 */

import { Point2D, SplinePoint } from '../types/planner';

export class Spline2D {
  public points: SplinePoint[] = [];
  public totalLength: number = 0;

  constructor(waypoints: Point2D[], stepSize: number = 0.5) {
    if (waypoints.length >= 2) {
      this.buildSpline(waypoints, stepSize);
    }
  }

  private buildSpline(waypoints: Point2D[], stepSize: number): void {
    if (waypoints.length < 2) return;

    // Calculate cumulative Euclidean distances between waypoints
    const dists: number[] = [0];
    for (let i = 1; i < waypoints.length; i++) {
      const dx = waypoints[i].x - waypoints[i - 1].x;
      const dy = waypoints[i].y - waypoints[i - 1].y;
      dists.push(dists[i - 1] + Math.hypot(dx, dy));
    }
    this.totalLength = dists[dists.length - 1];

    if (this.totalLength <= 0) return;

    // High-resolution resampling using Catmull-Rom / Hermite continuous tangents
    const numSamples = Math.max(10, Math.ceil(this.totalLength / stepSize));
    const sampled: SplinePoint[] = [];

    for (let i = 0; i <= numSamples; i++) {
      const s = (i / numSamples) * this.totalLength;
      const pt = this.interpolate(s, waypoints, dists);
      sampled.push(pt);
    }

    // Compute tangent orientations theta and curvatures kappa
    for (let i = 0; i < sampled.length; i++) {
      const prev = sampled[Math.max(0, i - 1)];
      const next = sampled[Math.min(sampled.length - 1, i + 1)];
      const ds = Math.max(0.0001, next.s - prev.s);
      
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      sampled[i].theta = Math.atan2(dy, dx);

      // Compute curvature kappa = (x' y'' - y' x'') / (x'^2 + y'^2)^(3/2)
      // Discrete numerical differentiation:
      const dTheta = this.normalizeAngle(next.theta !== undefined ? next.theta - prev.theta : 0);
      sampled[i].kappa = dTheta / ds;
    }

    this.points = sampled;
  }

  private interpolate(s: number, waypoints: Point2D[], dists: number[]): SplinePoint {
    // Find segment containing s
    let idx = 0;
    while (idx < dists.length - 2 && dists[idx + 1] < s) {
      idx++;
    }

    const s0 = dists[idx];
    const s1 = dists[idx + 1];
    const segLen = Math.max(0.0001, s1 - s0);
    const t = Math.max(0, Math.min(1, (s - s0) / segLen));

    // Catmull-Rom tangent points
    const p0 = waypoints[Math.max(0, idx - 1)];
    const p1 = waypoints[idx];
    const p2 = waypoints[idx + 1];
    const p3 = waypoints[Math.min(waypoints.length - 1, idx + 2)];

    // Catmull-Rom cubic spline interpolation
    const t2 = t * t;
    const t3 = t2 * t;

    const x = 0.5 * (
      (2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    );

    const y = 0.5 * (
      (2 * p1.y) +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    );

    return { s, x, y, theta: 0, kappa: 0 };
  }

  public getPointAtS(s: number): SplinePoint {
    if (this.points.length === 0) {
      return { s, x: 0, y: 0, theta: 0, kappa: 0 };
    }
    const clampedS = Math.max(0, Math.min(this.totalLength, s));
    const exactIdx = (clampedS / this.totalLength) * (this.points.length - 1);
    const i = Math.floor(exactIdx);
    const frac = exactIdx - i;

    if (i >= this.points.length - 1) {
      return this.points[this.points.length - 1];
    }

    const pA = this.points[i];
    const pB = this.points[i + 1];

    return {
      s: clampedS,
      x: pA.x + frac * (pB.x - pA.x),
      y: pA.y + frac * (pB.y - pA.y),
      theta: pA.theta + frac * this.normalizeAngle(pB.theta - pA.theta),
      kappa: pA.kappa + frac * (pB.kappa - pA.kappa)
    };
  }

  /**
   * Project Cartesian coordinate (x, y) to Frenet (s, d)
   */
  public cartesianToFrenet(x: number, y: number): { s: number; d: number; closestPt: SplinePoint } {
    if (this.points.length === 0) {
      return { s: 0, d: 0, closestPt: { s: 0, x, y, theta: 0, kappa: 0 } };
    }

    let minD2 = Infinity;
    let bestIdx = 0;

    for (let i = 0; i < this.points.length; i++) {
      const dx = this.points[i].x - x;
      const dy = this.points[i].y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD2) {
        minD2 = d2;
        bestIdx = i;
      }
    }

    // Refine with linear interpolation between adjacent points
    const p = this.points[bestIdx];
    const dx = x - p.x;
    const dy = y - p.y;

    // Normal vector n = (-sin(theta), cos(theta)) pointing to left
    const nx = -Math.sin(p.theta);
    const ny = Math.cos(p.theta);

    // Lateral distance d: dot product with normal vector
    const d = dx * nx + dy * ny;

    return { s: p.s, d, closestPt: p };
  }

  /**
   * Convert Frenet (s, d) to Cartesian (x, y, theta)
   */
  public frenetToCartesian(s: number, d: number): { x: number; y: number; theta: number; kappa: number } {
    const p = this.getPointAtS(s);
    const nx = -Math.sin(p.theta);
    const ny = Math.cos(p.theta);

    return {
      x: p.x + d * nx,
      y: p.y + d * ny,
      theta: p.theta,
      kappa: p.kappa
    };
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
}

/**
 * Quintic Polynomial Solver
 * Solves 5th-order polynomial satisfying initial and boundary constraints:
 * x(0) = x0, x'(0) = v0, x''(0) = a0
 * x(T) = x1, x'(T) = v1, x''(T) = a1
 */
export class QuinticPolynomial {
  public a0: number;
  public a1: number;
  public a2: number;
  public a3: number = 0;
  public a4: number = 0;
  public a5: number = 0;

  constructor(xs: number, vxs: number, axs: number, xe: number, vxe: number, axe: number, T: number) {
    this.a0 = xs;
    this.a1 = vxs;
    this.a2 = axs / 2.0;

    const T2 = T * T;
    const T3 = T2 * T;
    const T4 = T3 * T;
    const T5 = T4 * T;

    // Boundary conditions at t = T
    const b0 = xe - this.a0 - this.a1 * T - this.a2 * T2;
    const b1 = vxe - this.a1 - 2 * this.a2 * T;
    const b2 = axe - 2 * this.a2;

    // Linear system solution:
    // [ T3   T4    T5  ] [ a3 ]   [ b0 ]
    // [ 3T2  4T3   5T4 ] [ a4 ] = [ b1 ]
    // [ 6T   12T2 20T3 ] [ a5 ]   [ b2 ]
    this.a3 = (10 * b0 / T3) - (4 * b1 / T2) + (0.5 * b2 / T);
    this.a4 = (-15 * b0 / T4) + (7 * b1 / T3) - (b2 / T2);
    this.a5 = (6 * b0 / T5) - (3 * b1 / T4) + (0.5 * b2 / T3);
  }

  public calcPoint(t: number): number {
    return this.a0 + this.a1 * t + this.a2 * t * t + this.a3 * Math.pow(t, 3) + this.a4 * Math.pow(t, 4) + this.a5 * Math.pow(t, 5);
  }

  public calcFirstDerivative(t: number): number {
    return this.a1 + 2 * this.a2 * t + 3 * this.a3 * Math.pow(t, 2) + 4 * this.a4 * Math.pow(t, 3) + 5 * this.a5 * Math.pow(t, 4);
  }

  public calcSecondDerivative(t: number): number {
    return 2 * this.a2 + 6 * this.a3 * t + 12 * this.a4 * Math.pow(t, 2) + 20 * this.a5 * Math.pow(t, 3);
  }

  public calcThirdDerivative(t: number): number {
    return 6 * this.a3 + 24 * this.a4 * t + 60 * this.a5 * Math.pow(t, 2);
  }
}

/**
 * Quartic Polynomial Solver (for longitudinal velocity planning)
 * Solves 4th-order polynomial satisfying:
 * s(0) = s0, s'(0) = v0, s''(0) = a0
 * s'(T) = v1, s''(T) = a1
 */
export class QuarticPolynomial {
  public a0: number;
  public a1: number;
  public a2: number;
  public a3: number = 0;
  public a4: number = 0;

  constructor(xs: number, vxs: number, axs: number, vxe: number, axe: number, T: number) {
    this.a0 = xs;
    this.a1 = vxs;
    this.a2 = axs / 2.0;

    const T2 = T * T;
    const T3 = T2 * T;

    const b0 = vxe - this.a1 - 2 * this.a2 * T;
    const b1 = axe - 2 * this.a2;

    this.a3 = (3 * b0 / T2) - (b1 / T);
    this.a4 = (-2 * b0 / T3) + (b1 / T2);
  }

  public calcPoint(t: number): number {
    return this.a0 + this.a1 * t + this.a2 * t * t + this.a3 * Math.pow(t, 3) + this.a4 * Math.pow(t, 4);
  }

  public calcFirstDerivative(t: number): number {
    return this.a1 + 2 * this.a2 * t + 3 * this.a3 * Math.pow(t, 2) + 4 * this.a4 * Math.pow(t, 3);
  }

  public calcSecondDerivative(t: number): number {
    return 2 * this.a2 + 6 * this.a3 * t + 12 * this.a4 * Math.pow(t, 2);
  }

  public calcThirdDerivative(t: number): number {
    return 6 * this.a3 + 24 * this.a4 * t;
  }
}
