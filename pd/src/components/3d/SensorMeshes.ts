/**
 * 3D Sensor Perception & Planning Visualizers
 * High-performance Three.js visualizers for:
 * - 3D LiDAR Point Cloud (BufferGeometry with dynamic color gradient)
 * - 3D LiDAR Rotating Scanning Fan
 * - 77GHz FMCW Automotive Radar Frustum Cone
 * - Radar Doppler Velocity 3D Vectors
 * - 3D Bounding Boxes (Cuboids with threat color coding)
 * - 3D Planned Path Ribbon & Frenet Candidate Trajectory Fan
 * - 3D APF Force Vector Arrows
 * - 3D Holographic Goal Beacon
 */

import * as THREE from 'three';
import {
  BoundingBox3D,
  EgoVehicleState,
  FrenetTrajectory,
  LidarPoint,
  PlannerType,
  Point2D,
  Pothole,
  RadarTarget,
  SensorConfig
} from '../../types/planner';

export class SensorVisualizer3D {
  // 1. LiDAR Point Cloud
  public lidarPointsMesh: THREE.Points;
  private lidarGeometry: THREE.BufferGeometry;
  private lidarMaterial: THREE.PointsMaterial;
  private maxPoints = 5000;

  // 2. LiDAR Scanning Beam Fan
  public lidarSweepMesh: THREE.Mesh;

  // 3. RADAR Frustum Mesh
  public radarFrustumMesh: THREE.Mesh;
  private radarFrustumGeom: THREE.ConeGeometry;

  // 4. RADAR Doppler Arrows Group
  public radarDopplerGroup: THREE.Group;

  // 5. 3D Bounding Boxes Group
  public boundingBoxesGroup: THREE.Group;

  // 6. Planned Path Ribbon Mesh
  public plannedPathLine: THREE.Line;
  private plannedPathGeom: THREE.BufferGeometry;

  // 7. Frenet Candidate Fan Group
  public frenetFanGroup: THREE.Group;

  // 8. APF Vectors Group
  public apfVectorsGroup: THREE.Group;

  // 9. Goal Beacon Group
  public goalBeaconGroup: THREE.Group;

  // 10. Potholes Layer Group (Fixed Obstacles & APF Repulsive Sources)
  public potholesGroup: THREE.Group;

  // 11. Imaginary Centerline Layer Group (Road Slip Guard initiating from ego)
  public imaginaryCenterlineGroup: THREE.Group;

  constructor() {
    // --- 1. LiDAR Point Cloud ---
    this.lidarGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxPoints * 3);
    const colors = new Float32Array(this.maxPoints * 3);
    this.lidarGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.lidarGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.lidarMaterial = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true
    });
    this.lidarPointsMesh = new THREE.Points(this.lidarGeometry, this.lidarMaterial);

    // --- 2. LiDAR Laser Sweep Fan ---
    const sweepGeom = new THREE.ConeGeometry(35, 35, 32, 1, true, 0, Math.PI * 0.15);
    sweepGeom.rotateX(Math.PI / 2);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    });
    this.lidarSweepMesh = new THREE.Mesh(sweepGeom, sweepMat);

    // --- 3. RADAR Frustum ---
    this.radarFrustumGeom = new THREE.ConeGeometry(35, 75, 24, 1, true);
    this.radarFrustumGeom.rotateX(Math.PI / 2);
    const radarFrustumMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.08,
      wireframe: true
    });
    this.radarFrustumMesh = new THREE.Mesh(this.radarFrustumGeom, radarFrustumMat);

    // --- Groups ---
    this.radarDopplerGroup = new THREE.Group();
    this.boundingBoxesGroup = new THREE.Group();
    this.frenetFanGroup = new THREE.Group();
    this.apfVectorsGroup = new THREE.Group();

    // --- 6. Planned Path Line ---
    this.plannedPathGeom = new THREE.BufferGeometry();
    const pathMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      linewidth: 3,
      transparent: true,
      opacity: 0.95
    });
    this.plannedPathLine = new THREE.Line(this.plannedPathGeom, pathMat);

    // --- 9. Goal Beacon ---
    this.goalBeaconGroup = this.createGoalBeacon();

    // --- 10. Potholes Layer Group ---
    this.potholesGroup = new THREE.Group();

    // --- 11. Imaginary Centerline & Edge Slip Guard Group ---
    this.imaginaryCenterlineGroup = new THREE.Group();
  }

  /**
   * Updates 3D LiDAR Point Cloud Buffer with real-time laser returns
   */
  public updateLidarPoints(points: LidarPoint[], config: SensorConfig): void {
    if (!config.lidarEnabled || points.length === 0) {
      this.lidarPointsMesh.visible = false;
      return;
    }
    this.lidarPointsMesh.visible = true;

    const count = Math.min(points.length, this.maxPoints);
    const posAttr = this.lidarGeometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.lidarGeometry.attributes.color as THREE.BufferAttribute;

    const posArray = posAttr.array as Float32Array;
    const colArray = colAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const pt = points[i];
      const idx = i * 3;
      posArray[idx] = pt.x;
      posArray[idx + 1] = pt.y;
      posArray[idx + 2] = Math.max(0.02, pt.z);

      // Color mapping
      let r = 0, g = 0.8, b = 1.0;
      if (config.lidarColorMode === 'ELEVATION') {
        // Height based ramp: dark blue -> cyan -> yellow -> red
        const normZ = Math.min(1.0, Math.max(0, pt.z / 2.5));
        if (normZ < 0.25) {
          r = 0.1; g = 0.4 + normZ * 2; b = 0.9;
        } else if (normZ < 0.6) {
          r = 0.1 + (normZ - 0.25) * 2; g = 0.9; b = 0.2;
        } else {
          r = 1.0; g = 0.9 - (normZ - 0.6) * 2; b = 0.1;
        }
      } else if (config.lidarColorMode === 'DISTANCE') {
        // Range based ramp
        const normDist = Math.min(1.0, pt.distance / (config.lidarRange || 45));
        r = normDist;
        g = 1.0 - normDist * 0.7;
        b = 1.0 - normDist;
      } else {
        // Intensity mode
        const inten = pt.intensity;
        r = inten * 0.9;
        g = inten * 1.0;
        b = inten * 0.8 + 0.2;
      }

      colArray[idx] = r;
      colArray[idx + 1] = g;
      colArray[idx + 2] = b;
    }

    // Zero out unused points
    for (let i = count; i < this.maxPoints; i++) {
      const idx = i * 3;
      posArray[idx] = 0;
      posArray[idx + 1] = 0;
      posArray[idx + 2] = -999;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.lidarGeometry.setDrawRange(0, count);
  }

  /**
   * Updates LiDAR sweeping beam animation
   */
  public updateLidarSweep(ego: EgoVehicleState, config: SensorConfig, time: number): void {
    if (!config.lidarEnabled || !config.lidarShowBeams) {
      this.lidarSweepMesh.visible = false;
      return;
    }
    this.lidarSweepMesh.visible = true;
    this.lidarSweepMesh.position.set(ego.x, ego.y, 1.5);
    // Rotate beam around Z axis
    this.lidarSweepMesh.rotation.z = time * 8.0;
  }

  /**
   * Updates 77GHz FMCW Automotive Radar Frustum
   */
  public updateRadarFrustum(ego: EgoVehicleState, config: SensorConfig): void {
    if (!config.radarEnabled || !config.radarShowFrustum) {
      this.radarFrustumMesh.visible = false;
      return;
    }
    this.radarFrustumMesh.visible = true;

    const range = config.radarRange || 80;
    const fovRad = ((config.radarFovDegrees || 70) * Math.PI) / 180;

    // Position at ego front bumper
    const frontX = ego.x + Math.cos(ego.heading) * 2.2;
    const frontY = ego.y + Math.sin(ego.heading) * 2.2;
    this.radarFrustumMesh.position.set(frontX, frontY, 0.45);

    // Orient along ego heading
    this.radarFrustumMesh.rotation.z = ego.heading - Math.PI / 2;
  }

  /**
   * Updates 3D Doppler Relative Velocity Vectors & Radar Target Blips
   */
  public updateRadarDoppler(targets: RadarTarget[], config: SensorConfig): void {
    // Clear previous arrows
    while (this.radarDopplerGroup.children.length > 0) {
      const obj = this.radarDopplerGroup.children.pop();
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    }

    if (!config.radarEnabled || !config.radarShowDoppler) {
      this.radarDopplerGroup.visible = false;
      return;
    }
    this.radarDopplerGroup.visible = true;

    for (const target of targets) {
      // 1. Hovering Radar Blip Diamond
      const blipColor = target.threatLevel === 'CRITICAL' ? 0xef4444 : target.threatLevel === 'CAUTION' ? 0xf59e0b : 0x06b6d4;
      const blipGeom = new THREE.OctahedronGeometry(0.3, 0);
      const blipMat = new THREE.MeshBasicMaterial({ color: blipColor, wireframe: true });
      const blipMesh = new THREE.Mesh(blipGeom, blipMat);
      blipMesh.position.set(target.x, target.y, 2.2);
      this.radarDopplerGroup.add(blipMesh);

      // 2. Radial Doppler Velocity Arrow
      // Velocity vector points in relative direction
      const vMag = Math.abs(target.radialVelocity);
      if (vMag > 0.3) {
        const dirX = -Math.cos(target.azimuth) * (target.radialVelocity < 0 ? 1 : -1);
        const dirY = -Math.sin(target.azimuth) * (target.radialVelocity < 0 ? 1 : -1);
        const arrowLength = Math.min(6.0, Math.max(0.8, vMag * 0.4));
        const arrowDir = new THREE.Vector3(dirX, dirY, 0).normalize();

        const arrowHelper = new THREE.ArrowHelper(
          arrowDir,
          new THREE.Vector3(target.x, target.y, 1.2),
          arrowLength,
          target.radialVelocity < 0 ? 0xef4444 : 0x10b981, // Red for closing, Green for opening
          0.4,
          0.25
        );
        this.radarDopplerGroup.add(arrowHelper);
      }
    }
  }

  /**
   * Updates 3D Bounding Boxes (Cuboids)
   */
  public updateBoundingBoxes(boxes: BoundingBox3D[], config: SensorConfig): void {
    while (this.boundingBoxesGroup.children.length > 0) {
      const obj = this.boundingBoxesGroup.children.pop();
      if (obj instanceof THREE.LineSegments) {
        obj.geometry.dispose();
      }
    }

    if (!config.showBoundingBoxes3D) {
      this.boundingBoxesGroup.visible = false;
      return;
    }
    this.boundingBoxesGroup.visible = true;

    for (const b of boxes) {
      const geom = new THREE.BoxGeometry(b.length, b.width, b.height);
      const edges = new THREE.EdgesGeometry(geom);

      let boxColor = 0x22d3ee; // Default cyan
      if (b.ttc !== undefined && b.ttc < 2.5) {
        boxColor = 0xef4444; // Critical
      } else if (b.ttc !== undefined && b.ttc < 4.5) {
        boxColor = 0xf59e0b; // Caution
      }

      const mat = new THREE.LineBasicMaterial({ color: boxColor, linewidth: 2 });
      const line = new THREE.LineSegments(edges, mat);
      line.position.set(b.x, b.y, b.z);
      line.rotation.z = b.heading;
      this.boundingBoxesGroup.add(line);
    }
  }

  /**
   * Updates 3D Autonomous Planned Path
   */
  public updatePlannedPath(path: Point2D[], activePlanner: PlannerType): void {
    if (!path || path.length < 2) {
      this.plannedPathLine.visible = false;
      return;
    }
    this.plannedPathLine.visible = true;

    const points3D: THREE.Vector3[] = path.map(p => new THREE.Vector3(p.x, p.y, 0.08));
    this.plannedPathGeom.setFromPoints(points3D);

    // Color by active planner
    const mat = this.plannedPathLine.material as THREE.LineBasicMaterial;
    if (activePlanner === 'APF') {
      mat.color.setHex(0xf59e0b); // Amber
    } else if (activePlanner === 'FRENET') {
      mat.color.setHex(0x10b981); // Emerald
    } else {
      mat.color.setHex(0xa855f7); // Purple
    }
  }

  /**
   * Updates 3D Frenet Trajectory Candidate Fan
   */
  public updateFrenetFan(candidates: FrenetTrajectory[] | undefined, visible: boolean): void {
    while (this.frenetFanGroup.children.length > 0) {
      const obj = this.frenetFanGroup.children.pop();
      if (obj instanceof THREE.Line) {
        obj.geometry.dispose();
      }
    }

    if (!visible || !candidates || candidates.length === 0) {
      this.frenetFanGroup.visible = false;
      return;
    }
    this.frenetFanGroup.visible = true;

    for (let i = 0; i < Math.min(18, candidates.length); i++) {
      const traj = candidates[i];
      if (!traj.points || traj.points.length < 2) continue;

      const pts = traj.points.map(p => new THREE.Vector3(p.x, p.y, 0.05));
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const colorHex = traj.isValid ? 0x34d399 : 0xef4444;
      const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: traj.isValid ? 0.35 : 0.15
      });
      const line = new THREE.Line(geom, mat);
      this.frenetFanGroup.add(line);
    }
  }

  /**
   * Updates 3D APF Force Vectors
   */
  public updateAPFVectors(vectors: { x: number; y: number; fx: number; fy: number }[] | undefined, visible: boolean): void {
    while (this.apfVectorsGroup.children.length > 0) {
      const obj = this.apfVectorsGroup.children.pop();
    }

    if (!visible || !vectors || vectors.length === 0) {
      this.apfVectorsGroup.visible = false;
      return;
    }
    this.apfVectorsGroup.visible = true;

    for (const v of vectors.slice(0, 16)) {
      const fMag = Math.hypot(v.fx, v.fy);
      if (fMag > 0.1) {
        const dir = new THREE.Vector3(v.fx, v.fy, 0).normalize();
        const arrow = new THREE.ArrowHelper(
          dir,
          new THREE.Vector3(v.x, v.y, 0.2),
          Math.min(3.5, fMag * 0.4),
          0xf97316,
          0.3,
          0.15
        );
        this.apfVectorsGroup.add(arrow);
      }
    }
  }

  /**
   * Creates 3D Pulsing Holographic Destination Goal Beacon
   */
  private createGoalBeacon(): THREE.Group {
    const group = new THREE.Group();

    // Pulsing vertical cylinder column
    const colGeom = new THREE.CylinderGeometry(1.2, 1.2, 8.0, 16, 1, true);
    colGeom.rotateX(Math.PI / 2);
    const colMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const colMesh = new THREE.Mesh(colGeom, colMat);
    colMesh.position.z = 4.0;
    group.add(colMesh);

    // Rotating ground rings
    const ringGeom = new THREE.RingGeometry(1.6, 2.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.position.z = 0.05;
    group.add(ringMesh);

    return group;
  }

  /**
   * Sets Goal Beacon 3D coordinates
   */
  public setGoalPosition(goal: Point2D): void {
    this.goalBeaconGroup.position.set(goal.x, goal.y, 0);
  }

  /**
   * Updates 3D Potholes Visual Layer:
   * Fixed obstacles with depth crater, cracked border rim, APF repulsive field iso-rings, and floating hazard diamond
   */
  public updatePotholes(potholes: Pothole[] | undefined, visible: boolean, time: number): void {
    while (this.potholesGroup.children.length > 0) {
      const child = this.potholesGroup.children.pop();
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }

    if (!visible || !potholes || potholes.length === 0) {
      this.potholesGroup.visible = false;
      return;
    }
    this.potholesGroup.visible = true;

    for (const p of potholes) {
      const radius = p.radius || 1.1;
      const sevColor = p.severity === 'SEVERE' ? 0xef4444 : p.severity === 'MODERATE' ? 0xf59e0b : 0xeab308;

      // 1. Asphalt Crater Pit (Dark broken depression)
      const craterGeom = new THREE.CircleGeometry(radius, 24);
      const craterMat = new THREE.MeshBasicMaterial({
        color: 0x05070e,
        side: THREE.DoubleSide
      });
      const craterMesh = new THREE.Mesh(craterGeom, craterMat);
      craterMesh.position.set(p.x, p.y, 0.02);
      this.potholesGroup.add(craterMesh);

      // 2. Chipped Asphalt Rim
      const rimGeom = new THREE.RingGeometry(radius * 0.92, radius * 1.12, 24);
      const rimMat = new THREE.MeshBasicMaterial({
        color: sevColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const rimMesh = new THREE.Mesh(rimGeom, rimMat);
      rimMesh.position.set(p.x, p.y, 0.025);
      this.potholesGroup.add(rimMesh);

      // 3. APF Repulsive Force Field Iso-Potential Rings
      const pulse1 = 1.0 + Math.sin(time * 3.5 + p.x * 0.2) * 0.08;
      const repRadius1 = radius * 1.8 * pulse1;
      const ringGeom1 = new THREE.RingGeometry(repRadius1 - 0.06, repRadius1 + 0.06, 32);
      const ringMat1 = new THREE.MeshBasicMaterial({
        color: sevColor,
        transparent: true,
        opacity: 0.35 + Math.sin(time * 3.5) * 0.15,
        side: THREE.DoubleSide
      });
      const fieldRing1 = new THREE.Mesh(ringGeom1, ringMat1);
      fieldRing1.position.set(p.x, p.y, 0.03);
      this.potholesGroup.add(fieldRing1);

      const pulse2 = 1.0 + Math.cos(time * 2.8 + p.y * 0.3) * 0.06;
      const repRadius2 = radius * 2.6 * pulse2;
      const ringGeom2 = new THREE.RingGeometry(repRadius2 - 0.05, repRadius2 + 0.05, 32);
      const ringMat2 = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
      });
      const fieldRing2 = new THREE.Mesh(ringGeom2, ringMat2);
      fieldRing2.position.set(p.x, p.y, 0.028);
      this.potholesGroup.add(fieldRing2);

      // 4. Floating Holographic Hazard Beacon Diamond
      const bobZ = 1.4 + Math.sin(time * 4.0 + p.x) * 0.18;
      const diamondGeom = new THREE.OctahedronGeometry(0.35);
      const diamondMat = new THREE.MeshBasicMaterial({
        color: sevColor,
        wireframe: true
      });
      const diamondMesh = new THREE.Mesh(diamondGeom, diamondMat);
      diamondMesh.position.set(p.x, p.y, bobZ);
      diamondMesh.rotation.y = time * 2.5;
      diamondMesh.rotation.x = 0.4;
      this.potholesGroup.add(diamondMesh);

      // 5. Vertical Hazard Tether Line
      const tetherGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p.x, p.y, 0.05),
        new THREE.Vector3(p.x, p.y, bobZ)
      ]);
      const tetherMat = new THREE.LineBasicMaterial({
        color: sevColor,
        transparent: true,
        opacity: 0.45
      });
      const tetherLine = new THREE.Line(tetherGeom, tetherMat);
      this.potholesGroup.add(tetherLine);
    }
  }

  /**
   * Updates 3D Imaginary Center Line initiating from the car & Road Edge Slip Guard
   * Visually guides the vehicle and protects from slipping off the unrailed road into the bushes
   */
  public updateImaginaryCenterline(
    centerlinePts: Point2D[] | undefined,
    visible: boolean,
    roadEdgeWarning: boolean,
    time: number,
    roadWidth: number = 14
  ): void {
    while (this.imaginaryCenterlineGroup.children.length > 0) {
      const child = this.imaginaryCenterlineGroup.children.pop();
      if (child instanceof THREE.Line || child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }

    if (!visible || !centerlinePts || centerlinePts.length < 2) {
      this.imaginaryCenterlineGroup.visible = false;
      return;
    }
    this.imaginaryCenterlineGroup.visible = true;

    // 1. Centerline Glowing Path Ribbon initiating from the car
    const points3D = centerlinePts.map(p => new THREE.Vector3(p.x, p.y, 0.12));
    const pathGeom = new THREE.BufferGeometry().setFromPoints(points3D);
    const pathMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4, // Glowing Cyan
      linewidth: 3,
      transparent: true,
      opacity: 0.95
    });
    const pathLine = new THREE.Line(pathGeom, pathMat);
    this.imaginaryCenterlineGroup.add(pathLine);

    // 2. Node Beacons along imaginary centerline
    for (let i = 0; i < centerlinePts.length; i += 2) {
      const pt = centerlinePts[i];
      const nodeGeom = new THREE.RingGeometry(0.18, 0.28, 16);
      const nodeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      const nodeMesh = new THREE.Mesh(nodeGeom, nodeMat);
      nodeMesh.position.set(pt.x, pt.y, 0.125);
      this.imaginaryCenterlineGroup.add(nodeMesh);
    }

    // 3. Unrailed Road Edge Hazard Boundaries (Protect car from slipping into roadside bushes)
    const halfW = roadWidth / 2;
    const edgeColor = roadEdgeWarning ? 0xef4444 : 0xf59e0b; // Crimson if dangerously near, amber warning otherwise
    const edgeOpacity = roadEdgeWarning ? 0.75 + Math.sin(time * 8.0) * 0.25 : 0.35;

    const leftBoundaryPts: THREE.Vector3[] = [];
    const rightBoundaryPts: THREE.Vector3[] = [];

    for (const pt of centerlinePts) {
      leftBoundaryPts.push(new THREE.Vector3(pt.x, pt.y + halfW - 0.2, 0.08));
      rightBoundaryPts.push(new THREE.Vector3(pt.x, pt.y - halfW + 0.2, 0.08));
    }

    const leftEdgeGeom = new THREE.BufferGeometry().setFromPoints(leftBoundaryPts);
    const rightEdgeGeom = new THREE.BufferGeometry().setFromPoints(rightBoundaryPts);
    const edgeMat = new THREE.LineBasicMaterial({
      color: edgeColor,
      linewidth: 2,
      transparent: true,
      opacity: edgeOpacity
    });

    const leftEdgeLine = new THREE.Line(leftEdgeGeom, edgeMat);
    const rightEdgeLine = new THREE.Line(rightEdgeGeom, edgeMat);
    this.imaginaryCenterlineGroup.add(leftEdgeLine);
    this.imaginaryCenterlineGroup.add(rightEdgeLine);
  }
}
