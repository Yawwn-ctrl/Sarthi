/**
 * Type definitions for Adaptive Path Planning for Unstructured Indian Roads
 */

export type PlannerType = 'APF' | 'FRENET' | 'GAP_ACCEPTANCE' | 'SUPERVISOR' | 'MATLAB_REPLAY';

/**
 * One logged step of a closed-loop MATLAB/Simulink run.
 * Matches the 10-column CSV contract written by the Simulink model:
 * t, x, y, heading, speed, accel, steer, curvature, active_planner, latency_ms
 */
export interface ReplayFrame {
  t: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  accel: number;
  steer: number;
  curvature: number;
  activePlanner: string;
  latencyMs: number;
}

export type RoadContext = 'MARKET' | 'VILLAGE' | 'INTERSECTION';

export type TrafficAgentType = 
  | 'EGO'
  | 'AUTO_RICKSHAW'
  | 'TWO_WHEELER'
  | 'PEDESTRIAN'
  | 'CATTLE'
  | 'TRUCK'
  | 'CAR'
  | 'POTHOLE';

export type GapState = 'APPROACH' | 'YIELD_AND_SCAN' | 'COMMIT_CROSS' | 'CLEAR_JUNCTION';

export interface Point2D {
  x: number;
  y: number;
}

export interface Pothole {
  id: string;
  x: number;
  y: number;
  radius: number;
  depth?: number; // crater depth in meters
  severity?: 'MILD' | 'MODERATE' | 'SEVERE';
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface Agent {
  id: string;
  type: TrafficAgentType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number; // in radians
  width: number;
  length: number;
  radius: number;
  color: string;
  label: string;
  speed: number;
  targetSpeed: number;
  isStalled?: boolean;
  behavior?: 'CROSSING' | 'WANDERING' | 'LANE_FOLLOWING' | 'STALLED' | 'AGGRESSIVE_CUT_IN' | 'YIELDING';
  pathWaypoints?: Point2D[];
  currentWaypointIdx?: number;
  ttc?: number; // Time to collision with ego in seconds
}

export interface EgoVehicleState {
  x: number;
  y: number;
  heading: number; // radians
  speed: number;   // m/s
  accel: number;   // m/s^2
  steerAngle: number; // radians
  curvature: number; // 1/m
  width: number;
  length: number;
  wheelbase: number;
  radius: number;
}

export interface SplinePoint {
  s: number;
  x: number;
  y: number;
  theta: number;
  kappa: number;
  dKappa?: number;
}

export interface FrenetPoint {
  s: number;
  d: number;
  s_dot: number;
  d_dot: number;
  s_ddot: number;
  d_ddot: number;
  t: number;
  x: number;
  y: number;
  theta: number;
  kappa: number;
  cost: number;
  isValid: boolean;
  rejectReason?: string;
}

export interface FrenetTrajectory {
  points: FrenetPoint[];
  totalCost: number;
  cd: number; // lateral cost
  cv: number; // velocity cost
  collCost: number;
  jerkCost: number;
  isValid: boolean;
}

export interface APFConfig {
  k_att: number;          // Attractive potential gain
  k_rep: number;          // Repulsive potential gain
  d_0: number;            // Obstacle influence threshold distance
  alpha_momentum: number; // Momentum inertia weight [0..1]
  v_max: number;          // Max speed in market
  escapeGain: number;     // Tangential escape force gain for local minima
  nonHolonomicMaxTurn: number; // Max turn rate / heading diff
}

export interface FrenetConfig {
  w_d: number;            // Lateral offset weight
  w_d_dot: number;        // Lateral velocity weight
  w_d_ddot: number;       // Lateral acceleration weight
  w_jerk: number;         // Jerk weight
  w_coll: number;         // Collision risk weight
  w_speed: number;        // Target speed tracking weight
  target_speed: number;   // Target longitudinal speed (m/s)
  max_speed: number;      // Maximum allowed speed
  max_accel: number;      // Maximum acceleration
  max_curvature: number;  // Maximum path curvature
  d_sample_step: number;  // Lateral sampling step (m)
  d_sample_range: number; // Lateral sampling width (+-m)
  t_sample_horizons: number[]; // Planning horizons in seconds (e.g. [2, 3, 4])
}

export interface GapAcceptanceConfig {
  tau_crit: number;       // Critical gap threshold (e.g., 3.8s)
  approach_speed: number; // Speed when approaching intersection (m/s)
  cross_accel: number;    // Uniform acceleration during commit cross (m/s^2)
  cross_speed_max: number;// Max speed while clearing junction
  yield_distance: number; // Distance before junction line to yield
}

export interface SupervisorConfig {
  density_thresh: number; // Obstacle density per 100m^2
  speed_low_thresh: number; // Mean obstacle speed threshold (m/s)
  steer_rate_limit: number; // Max steering rate (rad/s) for transition smoothing
  jerk_limit: number;       // Max longitudinal jerk (m/s^3)
}

export interface PlannerOutput {
  targetX: number;
  targetY: number;
  targetHeading: number;
  targetSpeed: number;
  targetSteer: number;
  targetAccel: number;
  plannedPath: Point2D[];
  activePlanner: PlannerType;
  frenetCandidates?: FrenetTrajectory[];
  apfForceVectors?: { x: number; y: number; fx: number; fy: number }[];
  imaginaryCenterline?: Point2D[];
  potholeRepulsionActive?: boolean;
  roadEdgeWarning?: boolean;
  gapFSMState?: GapState;
  detectedContext: RoadContext;
  computeLatencyMs: number;
  infoMessage: string;
}

export interface SimulationMetrics {
  collisionCount: number;
  success: boolean;
  timeElapsed: number; // s
  pathLength: number;  // m
  smoothness: number;  // \int \kappa^2 ds
  minClearance: number;// m
  computeLatencyMs: number;
  currentSpeed: number;
  currentCurvature: number;
  currentLateralOffset: number;
  currentTTC: number;
  totalFrames: number;
  potholesAvoided: number;
  potholeImpacts: number;
  edgeClearance: number; // distance to unrailed road edge
}

export interface Scenario {
  id: string;
  title: string;
  category: RoadContext | 'MIXED_CORRIDOR';
  badge: string;
  description: string;
  roadWidth: number;
  centerlineWaypoints: Point2D[];
  egoStart: EgoVehicleState;
  egoGoal: Point2D;
  obstacles: Agent[];
  corridorBounds?: { left: Point2D[]; right: Point2D[] };
  intersectionZone?: {
    entryLine: Point2D[];
    conflictPolygon: Point2D[];
    exitLine: Point2D[];
  };
  potholes?: (Point2D | Pothole)[];
  decorations?: { type: 'TREE' | 'STALL' | 'TEMPLE' | 'BARRIER' | 'SIGN'; x: number; y: number; label?: string }[];
}

export interface BenchmarkResult {
  scenarioId: string;
  scenarioTitle: string;
  planner: PlannerType;
  success: boolean;
  collisionCount: number;
  travelTime: number;
  pathLength: number;
  smoothness: number;
  minClearance: number;
  avgLatencyMs: number;
}

export type CameraMode3D = 'CHASE' | 'COCKPIT' | 'ORBIT' | 'TOP_DOWN';
export type EnvironmentLighting = 'DAY' | 'SUNSET' | 'NIGHT_CYBER';

export interface LidarPoint {
  x: number;
  y: number;
  z: number;
  intensity: number;
  distance: number;
  ring: number;
  hitType: 'GROUND' | 'OBSTACLE' | 'DECORATION' | 'UNRESOLVED';
}

export interface RadarTarget {
  id: string;
  x: number;
  y: number;
  z: number;
  range: number;
  azimuth: number; // radians relative to ego heading
  radialVelocity: number; // m/s (negative = closing, positive = moving away)
  rcs: number; // Radar Cross Section (dBsm)
  ttc: number; // Time-to-collision (seconds)
  label: string;
  type: TrafficAgentType;
  threatLevel: 'SAFE' | 'CAUTION' | 'CRITICAL';
}

export interface BoundingBox3D {
  id: string;
  type: TrafficAgentType;
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  height: number;
  heading: number;
  confidence: number;
  label: string;
  ttc?: number;
}

export interface PerceptionState {
  lidarPoints: LidarPoint[];
  radarTargets: RadarTarget[];
  boundingBoxes3D: BoundingBox3D[];
  sensorStats: {
    lidarPointsCount: number;
    radarTargetsCount: number;
    lidarHz: number;
    radarHz: number;
    closestTargetDistance: number;
    closestTargetTTC: number;
    emergencyBrakeRequired: boolean;
  };
}

export interface SensorConfig {
  lidarEnabled: boolean;
  lidarRange: number;
  lidarBeams: number;
  lidarShowBeams: boolean;
  lidarColorMode: 'ELEVATION' | 'DISTANCE' | 'INTENSITY';
  radarEnabled: boolean;
  radarRange: number;
  radarFovDegrees: number;
  radarShowFrustum: boolean;
  radarShowDoppler: boolean;
  showBoundingBoxes3D: boolean;
  cameraMode: CameraMode3D;
  lighting: EnvironmentLighting;
}
