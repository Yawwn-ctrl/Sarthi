/**
 * 3D Road Environment Generator
 * Procedurally generates asphalt roadway, curbs, painted markings,
 * intersection conflict polygons, potholes, and roadside scenery.
 */

import * as THREE from 'three';
import { Scenario } from '../../types/planner';
import { createDecorationMesh } from './VehicleModels';

export class RoadEnvironment3D {
  public group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
  }

  public build(scenario: Scenario): void {
    // Clear previous elements
    while (this.group.children.length > 0) {
      const obj = this.group.children.pop();
    }

    const roadWidth = scenario.roadWidth || 14;
    const waypoints = scenario.centerlineWaypoints;

    // 1. Endless Ground / Dirt Terrain Plane
    const groundGeom = new THREE.PlaneGeometry(350, 200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1c2430, // Deep slate earth tone
      roughness: 0.95
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.position.set(60, 0, -0.02);
    this.group.add(groundMesh);

    // 2. Asphalt Road Ribbon
    if (waypoints && waypoints.length >= 2) {
      this.buildCurvedRoad(waypoints, roadWidth);
    } else {
      this.buildStraightRoad(roadWidth);
    }

    // 3. Intersection Conflict Zone (if present)
    if (scenario.intersectionZone) {
      this.buildIntersectionZone(scenario.intersectionZone);
    }

    // 4. Potholes (Indian road hazards)
    if (scenario.potholes) {
      const potholeMat = new THREE.MeshBasicMaterial({ color: 0x050811 });
      const rimMat = new THREE.MeshBasicMaterial({ color: 0xca8a04 });

      for (const p of scenario.potholes) {
        const pMesh = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), potholeMat);
        pMesh.position.set(p.x, p.y, 0.02);
        this.group.add(pMesh);

        const rimMesh = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.35, 16), rimMat);
        rimMesh.position.set(p.x, p.y, 0.025);
        this.group.add(rimMesh);
      }
    }

    // 5. Roadside Decorations (Trees, Chai Stalls, Shrines, Signs)
    if (scenario.decorations) {
      for (const d of scenario.decorations) {
        const decMesh = createDecorationMesh(d.type, d.label);
        decMesh.position.set(d.x, d.y, 0);
        this.group.add(decMesh);
      }
    }
  }

  private buildCurvedRoad(waypoints: { x: number; y: number }[], roadWidth: number): void {
    const halfW = roadWidth / 2;
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });

    const roadGeom = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Dense interpolation along waypoints
    const densePts: { x: number; y: number; nx: number; ny: number }[] = [];

    for (let i = 0; i < waypoints.length; i++) {
      const p = waypoints[i];
      let tx = 1, ty = 0;
      if (i < waypoints.length - 1) {
        tx = waypoints[i + 1].x - p.x;
        ty = waypoints[i + 1].y - p.y;
      } else if (i > 0) {
        tx = p.x - waypoints[i - 1].x;
        ty = p.y - waypoints[i - 1].y;
      }
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      densePts.push({ x: p.x, y: p.y, nx, ny });
    }

    for (let i = 0; i < densePts.length; i++) {
      const pt = densePts[i];
      // Left edge
      vertices.push(pt.x + pt.nx * halfW, pt.y + pt.ny * halfW, 0.0);
      uvs.push(0, i / densePts.length);
      // Right edge
      vertices.push(pt.x - pt.nx * halfW, pt.y - pt.ny * halfW, 0.0);
      uvs.push(1, i / densePts.length);

      if (i < densePts.length - 1) {
        const v0 = i * 2;
        const v1 = i * 2 + 1;
        const v2 = (i + 1) * 2;
        const v3 = (i + 1) * 2 + 1;
        indices.push(v0, v1, v2);
        indices.push(v1, v3, v2);
      }
    }

    roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeom.setIndex(indices);
    roadGeom.computeVertexNormals();

    const roadMesh = new THREE.Mesh(roadGeom, asphaltMat);
    this.group.add(roadMesh);

    // Centerline dashed stripes
    for (let i = 0; i < densePts.length - 1; i += 2) {
      const p1 = densePts[i];
      const p2 = densePts[Math.min(densePts.length - 1, i + 1)];
      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p1.x, p1.y, 0.02),
        new THREE.Vector3(p2.x, p2.y, 0.02)
      ]);
      const dashLine = new THREE.Line(lineGeom, lineMat);
      this.group.add(dashLine);
    }

    // Curbs along left and right boundary
    const curbHeight = 0.18;
    const curbGeom = new THREE.BoxGeometry(1.8, 0.35, curbHeight);
    for (let i = 0; i < densePts.length; i += 3) {
      const pt = densePts[i];
      const cL = new THREE.Mesh(curbGeom, curbMat);
      cL.position.set(pt.x + pt.nx * (halfW + 0.2), pt.y + pt.ny * (halfW + 0.2), curbHeight / 2);
      cL.rotation.z = Math.atan2(pt.ny, pt.nx) - Math.PI / 2;
      this.group.add(cL);

      const cR = new THREE.Mesh(curbGeom, curbMat);
      cR.position.set(pt.x - pt.nx * (halfW + 0.2), pt.y - pt.ny * (halfW + 0.2), curbHeight / 2);
      cR.rotation.z = Math.atan2(pt.ny, pt.nx) - Math.PI / 2;
      this.group.add(cR);
    }
  }

  private buildStraightRoad(roadWidth: number): void {
    const halfW = roadWidth / 2;
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
    const roadGeom = new THREE.PlaneGeometry(250, roadWidth);
    const roadMesh = new THREE.Mesh(roadGeom, asphaltMat);
    roadMesh.position.set(100, 0, 0);
    this.group.add(roadMesh);

    // Centerline dashes
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let x = -20; x < 220; x += 6) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.25), dashMat);
      dash.position.set(x, 0, 0.02);
      this.group.add(dash);
    }
  }

  private buildIntersectionZone(zone: { conflictPolygon: { x: number; y: number }[] }): void {
    if (!zone.conflictPolygon || zone.conflictPolygon.length < 3) return;

    // Create polygon shape
    const shape = new THREE.Shape();
    shape.moveTo(zone.conflictPolygon[0].x, zone.conflictPolygon[0].y);
    for (let i = 1; i < zone.conflictPolygon.length; i++) {
      shape.lineTo(zone.conflictPolygon[i].x, zone.conflictPolygon[i].y);
    }
    shape.closePath();

    const geom = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.z = 0.03;
    this.group.add(mesh);

    // Zebra Pedestrian Crossing stripes on entry/exit
    const zebraMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const centerX = zone.conflictPolygon[0].x - 4;
    for (let y = -8; y <= 8; y += 1.8) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.8), zebraMat);
      stripe.position.set(centerX, y, 0.035);
      this.group.add(stripe);
    }
  }
}
