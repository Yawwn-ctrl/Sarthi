/**
 * 3D Geometric Mesh Builders for Heterogeneous Indian Road Traffic
 * High-performance procedural Three.js models for:
 * - Ego Autonomous SUV (with turning wheels, roof LiDAR puck, radar dome)
 * - Indian Auto-Rickshaw (3 wheels, yellow canopy, green body)
 * - Indian Sacred Cow / Cattle (curved horns, ears, tail, legs)
 * - Two-Wheeler Motorcycle / Scooter with 3D rider
 * - Heavy Tata / Ashok Leyland Truck (colorful cabin, cargo bed)
 * - Pedestrian
 * - Roadside Decorations (Banyan trees, Chai stalls, roadside shrines, signposts)
 */

import * as THREE from 'three';
import { TrafficAgentType } from '../../types/planner';

// Reusable shared materials and geometries for optimal WebGL performance
const materials = {
  // Road & Asphalt
  asphalt: new THREE.MeshStandardMaterial({ color: 0x181e2b, roughness: 0.85, metalness: 0.1 }),
  roadShoulder: new THREE.MeshStandardMaterial({ color: 0x332a1e, roughness: 0.95 }),
  curb: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 }),
  roadMarkingWhite: new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
  roadMarkingYellow: new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
  zebraStripe: new THREE.MeshBasicMaterial({ color: 0xe2e8f0 }),
  pothole: new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.95 }),
  potholeRim: new THREE.MeshBasicMaterial({ color: 0xca8a04 }),

  // Ego Autonomous Vehicle
  egoBody: new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.65, roughness: 0.25 }),
  egoRoof: new THREE.MeshStandardMaterial({ color: 0x0369a1, metalness: 0.7, roughness: 0.2 }),
  egoGlass: new THREE.MeshPhysicalMaterial({ color: 0x082f49, transmission: 0.7, opacity: 0.85, transparent: true, roughness: 0.1 }),
  egoLidarPuck: new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 }),
  egoLidarLens: new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
  egoRadarDome: new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.5, roughness: 0.3 }),
  tireRubber: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }),
  wheelRim: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 }),
  headlight: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  taillight: new THREE.MeshBasicMaterial({ color: 0xef4444 }),

  // Auto-Rickshaw
  autoYellowCanopy: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }),
  autoGreenBody: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4, metalness: 0.3 }),
  autoBlackFrame: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),

  // Truck
  truckCab: new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.4, roughness: 0.4 }),
  truckBed: new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 }),
  truckContainer: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 }),

  // Two Wheeler & Rider
  bikeFrame: new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.7, roughness: 0.3 }),
  helmet: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }),
  riderJacket: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 }),

  // Cattle (Cow)
  cowBody: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 }),
  cowHorns: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 }),

  // Pedestrian
  pedestrianShirt: new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.8 }),
  skinTone: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 }),
  jeans: new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 }),

  // Scenery
  treeTrunk: new THREE.MeshStandardMaterial({ color: 0x543a25, roughness: 0.9 }),
  treeLeaves: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 }),
  stallAwning: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 }),
  stallWood: new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 }),
  shrineOrange: new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.5 }),
  signPost: new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 }),
  signBoard: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
};

/**
 * Creates 3D Autonomous Ego Electric SUV
 */
export function createEgoVehicleMesh(): {
  group: THREE.Group;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  lidarPuck: THREE.Mesh;
  headlightLight: THREE.SpotLight;
} {
  const group = new THREE.Group();
  const carLength = 4.4;
  const carWidth = 1.9;
  const carHeight = 1.45;

  // 1. Lower Chassis
  const chassisGeom = new THREE.BoxGeometry(carLength, carWidth, 0.6);
  const chassis = new THREE.Mesh(chassisGeom, materials.egoBody);
  chassis.position.z = 0.5;
  group.add(chassis);

  // 2. Cabin / Greenhouse
  const cabinGeom = new THREE.BoxGeometry(carLength * 0.55, carWidth * 0.85, 0.65);
  const cabin = new THREE.Mesh(cabinGeom, materials.egoGlass);
  cabin.position.set(-0.2, 0, 0.95);
  group.add(cabin);

  // Cabin Roof
  const roofGeom = new THREE.BoxGeometry(carLength * 0.52, carWidth * 0.82, 0.08);
  const roof = new THREE.Mesh(roofGeom, materials.egoRoof);
  roof.position.set(-0.2, 0, 1.3);
  group.add(roof);

  // 3. Autonomous Roof Sensor Suite (LiDAR Puck + Cameras)
  const sensorRackGeom = new THREE.BoxGeometry(0.8, 0.9, 0.06);
  const sensorRack = new THREE.Mesh(sensorRackGeom, materials.tireRubber);
  sensorRack.position.set(0.1, 0, 1.36);
  group.add(sensorRack);

  // LiDAR Cylinder Puck (Rotating Top)
  const lidarGeom = new THREE.CylinderGeometry(0.16, 0.16, 0.22, 16);
  lidarGeom.rotateX(Math.PI / 2);
  const lidarPuck = new THREE.Mesh(lidarGeom, materials.egoLidarPuck);
  lidarPuck.position.set(0.1, 0, 1.5);
  group.add(lidarPuck);

  // LiDAR Optical Lens Ring
  const lensGeom = new THREE.TorusGeometry(0.165, 0.02, 8, 24);
  const lidarLens = new THREE.Mesh(lensGeom, materials.egoLidarLens);
  lidarLens.position.set(0.1, 0, 1.5);
  group.add(lidarLens);

  // 4. Front Bumper 77GHz RADAR Sensor Dome
  const radarDomeGeom = new THREE.BoxGeometry(0.12, 0.35, 0.18);
  const radarDome = new THREE.Mesh(radarDomeGeom, materials.egoRadarDome);
  radarDome.position.set(carLength / 2 + 0.02, 0, 0.45);
  group.add(radarDome);

  // 5. Headlights and Taillights
  const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.12), materials.headlight);
  hlLeft.position.set(carLength / 2, carWidth * 0.35, 0.55);
  group.add(hlLeft);

  const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.12), materials.headlight);
  hlRight.position.set(carLength / 2, -carWidth * 0.35, 0.55);
  group.add(hlRight);

  const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.12), materials.taillight);
  tlLeft.position.set(-carLength / 2, carWidth * 0.35, 0.55);
  group.add(tlLeft);

  const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.12), materials.taillight);
  tlRight.position.set(-carLength / 2, -carWidth * 0.35, 0.55);
  group.add(tlRight);

  // 6. Wheels (Front steerable, Rear fixed)
  const wheelRadius = 0.35;
  const wheelThickness = 0.22;
  const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 18);
  wheelGeom.rotateZ(Math.PI / 2);

  const createWheel = () => {
    const wGroup = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeom, materials.tireRubber);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, wheelThickness + 0.01, 12), materials.wheelRim);
    rim.rotation.z = Math.PI / 2;
    wGroup.add(tire);
    wGroup.add(rim);
    return wGroup;
  };

  const frontLeftWheel = createWheel();
  frontLeftWheel.position.set(1.4, carWidth / 2 + 0.08, wheelRadius);
  group.add(frontLeftWheel);

  const frontRightWheel = createWheel();
  frontRightWheel.position.set(1.4, -carWidth / 2 - 0.08, wheelRadius);
  group.add(frontRightWheel);

  const rearLeftWheel = createWheel();
  rearLeftWheel.position.set(-1.4, carWidth / 2 + 0.08, wheelRadius);
  group.add(rearLeftWheel);

  const rearRightWheel = createWheel();
  rearRightWheel.position.set(-1.4, -carWidth / 2 - 0.08, wheelRadius);
  group.add(rearRightWheel);

  // Front Headlight Beam (Three.js SpotLight)
  const headlightLight = new THREE.SpotLight(0xffffff, 2.5, 30, Math.PI / 5, 0.4, 1.2);
  headlightLight.position.set(carLength / 2, 0, 0.6);
  headlightLight.target.position.set(carLength / 2 + 10, 0, 0);
  group.add(headlightLight);
  group.add(headlightLight.target);

  return { group, frontLeftWheel, frontRightWheel, lidarPuck, headlightLight };
}

/**
 * Creates 3D Auto-Rickshaw (Tuk-Tuk)
 */
export function createAutoRickshawMesh(): THREE.Group {
  const group = new THREE.Group();
  const length = 2.8;
  const width = 1.35;
  const height = 1.75;

  // Lower chassis (green)
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(length * 0.8, width, 0.6), materials.autoGreenBody);
  lowerBody.position.set(-0.1, 0, 0.45);
  group.add(lowerBody);

  // Yellow Curved Roof Canopy
  const roof = new THREE.Mesh(new THREE.BoxGeometry(length * 0.75, width * 0.95, 0.12), materials.autoYellowCanopy);
  roof.position.set(-0.15, 0, 1.65);
  group.add(roof);

  // Canopy Pillars (black)
  const pillarGeom = new THREE.CylinderGeometry(0.03, 0.03, 1.1);
  const p1 = new THREE.Mesh(pillarGeom, materials.autoBlackFrame);
  p1.position.set(0.65, width * 0.42, 1.1);
  p1.rotation.x = Math.PI / 2;
  group.add(p1);

  const p2 = new THREE.Mesh(pillarGeom, materials.autoBlackFrame);
  p2.position.set(0.65, -width * 0.42, 1.1);
  p2.rotation.x = Math.PI / 2;
  group.add(p2);

  const p3 = new THREE.Mesh(pillarGeom, materials.autoBlackFrame);
  p3.position.set(-0.9, width * 0.42, 1.1);
  p3.rotation.x = Math.PI / 2;
  group.add(p3);

  const p4 = new THREE.Mesh(pillarGeom, materials.autoBlackFrame);
  p4.position.set(-0.9, -width * 0.42, 1.1);
  p4.rotation.x = Math.PI / 2;
  group.add(p4);

  // Front Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.05, width * 0.8, 0.65), materials.egoGlass);
  windshield.position.set(0.7, 0, 1.15);
  group.add(windshield);

  // Front Nose / Wheel Cover
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.6, width * 0.55, 0.45), materials.autoGreenBody);
  nose.position.set(0.95, 0, 0.45);
  group.add(nose);

  // Wheels (1 front, 2 rear)
  const wheelGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 14);
  wheelGeom.rotateZ(Math.PI / 2);

  const fWheel = new THREE.Mesh(wheelGeom, materials.tireRubber);
  fWheel.position.set(1.0, 0, 0.24);
  group.add(fWheel);

  const rWheelL = new THREE.Mesh(wheelGeom, materials.tireRubber);
  rWheelL.position.set(-0.6, width / 2 + 0.05, 0.24);
  group.add(rWheelL);

  const rWheelR = new THREE.Mesh(wheelGeom, materials.tireRubber);
  rWheelR.position.set(-0.6, -width / 2 - 0.05, 0.24);
  group.add(rWheelR);

  // Single Headlight
  const light = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), materials.headlight);
  light.rotation.z = Math.PI / 2;
  light.position.set(1.26, 0, 0.55);
  group.add(light);

  return group;
}

/**
 * Creates 3D Indian Cattle / Sacred Cow
 */
export function createCattleMesh(): THREE.Group {
  const group = new THREE.Group();

  // Torso
  const bodyGeom = new THREE.BoxGeometry(1.6, 0.65, 0.75);
  const body = new THREE.Mesh(bodyGeom, materials.cowBody);
  body.position.set(0, 0, 0.85);
  group.add(body);

  // Hump (Zebu cattle characteristic)
  const humpGeom = new THREE.SphereGeometry(0.22, 10, 10);
  const hump = new THREE.Mesh(humpGeom, materials.cowBody);
  hump.position.set(0.4, 0, 1.3);
  group.add(hump);

  // Neck & Head
  const neckGeom = new THREE.BoxGeometry(0.4, 0.35, 0.45);
  const neck = new THREE.Mesh(neckGeom, materials.cowBody);
  neck.position.set(0.75, 0, 1.05);
  group.add(neck);

  const headGeom = new THREE.BoxGeometry(0.45, 0.32, 0.35);
  const head = new THREE.Mesh(headGeom, materials.cowBody);
  head.position.set(1.05, 0, 1.05);
  group.add(head);

  // Curved Horns
  const hornGeom = new THREE.ConeGeometry(0.04, 0.3, 8);
  const hornLeft = new THREE.Mesh(hornGeom, materials.cowHorns);
  hornLeft.position.set(0.95, 0.2, 1.32);
  hornLeft.rotation.x = Math.PI / 5;
  group.add(hornLeft);

  const hornRight = new THREE.Mesh(hornGeom, materials.cowHorns);
  hornRight.position.set(0.95, -0.2, 1.32);
  hornRight.rotation.x = -Math.PI / 5;
  group.add(hornRight);

  // 4 Legs
  const legGeom = new THREE.CylinderGeometry(0.06, 0.05, 0.7, 8);
  legGeom.rotateX(Math.PI / 2);

  const legFL = new THREE.Mesh(legGeom, materials.cowBody);
  legFL.position.set(0.55, 0.22, 0.35);
  group.add(legFL);

  const legFR = new THREE.Mesh(legGeom, materials.cowBody);
  legFR.position.set(0.55, -0.22, 0.35);
  group.add(legFR);

  const legRL = new THREE.Mesh(legGeom, materials.cowBody);
  legRL.position.set(-0.55, 0.22, 0.35);
  group.add(legRL);

  const legRR = new THREE.Mesh(legGeom, materials.cowBody);
  legRR.position.set(-0.55, -0.22, 0.35);
  group.add(legRR);

  return group;
}

/**
 * Creates 3D Two-Wheeler Motorcycle/Scooter with Rider
 */
export function createTwoWheelerMesh(): THREE.Group {
  const group = new THREE.Group();

  // Bike Frame & Tank
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.45), materials.bikeFrame);
  frame.position.set(0, 0, 0.55);
  group.add(frame);

  // Wheels
  const wGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 14);
  wGeom.rotateZ(Math.PI / 2);

  const frontWheel = new THREE.Mesh(wGeom, materials.tireRubber);
  frontWheel.position.set(0.8, 0, 0.3);
  group.add(frontWheel);

  const rearWheel = new THREE.Mesh(wGeom, materials.tireRubber);
  rearWheel.position.set(-0.7, 0, 0.3);
  group.add(rearWheel);

  // Handlebars
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7), materials.wheelRim);
  bar.position.set(0.65, 0, 0.95);
  group.add(bar);

  // 3D Rider
  // Legs
  const riderSeat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.35), materials.jeans);
  riderSeat.position.set(-0.1, 0, 0.8);
  group.add(riderSeat);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.55), materials.riderJacket);
  torso.position.set(-0.05, 0, 1.2);
  group.add(torso);

  // Helmet / Head
  const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), materials.helmet);
  helmetMesh.position.set(0.05, 0, 1.6);
  group.add(helmetMesh);

  return group;
}

/**
 * Creates 3D Heavy Tata / Ashok Leyland Truck
 */
export function createTruckMesh(): THREE.Group {
  const group = new THREE.Group();
  const truckLength = 7.2;
  const truckWidth = 2.5;

  // Cargo Bed
  const bed = new THREE.Mesh(new THREE.BoxGeometry(truckLength * 0.65, truckWidth, 1.4), materials.truckBed);
  bed.position.set(-truckLength * 0.15, 0, 1.4);
  group.add(bed);

  // High Cab
  const cab = new THREE.Mesh(new THREE.BoxGeometry(truckLength * 0.3, truckWidth, 2.0), materials.truckCab);
  cab.position.set(truckLength * 0.32, 0, 1.7);
  group.add(cab);

  // Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.1, truckWidth * 0.85, 0.8), materials.egoGlass);
  windshield.position.set(truckLength * 0.47 + 0.02, 0, 2.0);
  group.add(windshield);

  // Wheels (6 wheels)
  const wheelGeom = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16);
  wheelGeom.rotateZ(Math.PI / 2);

  const fL = new THREE.Mesh(wheelGeom, materials.tireRubber);
  fL.position.set(2.4, truckWidth / 2 + 0.1, 0.5);
  group.add(fL);

  const fR = new THREE.Mesh(wheelGeom, materials.tireRubber);
  fR.position.set(2.4, -truckWidth / 2 - 0.1, 0.5);
  group.add(fR);

  const r1L = new THREE.Mesh(wheelGeom, materials.tireRubber);
  r1L.position.set(-1.2, truckWidth / 2 + 0.1, 0.5);
  group.add(r1L);

  const r1R = new THREE.Mesh(wheelGeom, materials.tireRubber);
  r1R.position.set(-1.2, -truckWidth / 2 - 0.1, 0.5);
  group.add(r1R);

  const r2L = new THREE.Mesh(wheelGeom, materials.tireRubber);
  r2L.position.set(-2.5, truckWidth / 2 + 0.1, 0.5);
  group.add(r2L);

  const r2R = new THREE.Mesh(wheelGeom, materials.tireRubber);
  r2R.position.set(-2.5, -truckWidth / 2 - 0.1, 0.5);
  group.add(r2R);

  return group;
}

/**
 * Creates 3D Pedestrian
 */
export function createPedestrianMesh(): THREE.Group {
  const group = new THREE.Group();

  // Legs
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.85), materials.jeans);
  legs.position.set(0, 0, 0.42);
  legs.rotation.x = Math.PI / 2;
  group.add(legs);

  // Torso / Shirt
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.65), materials.pedestrianShirt);
  shirt.position.set(0, 0, 1.15);
  group.add(shirt);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), materials.skinTone);
  head.position.set(0, 0, 1.62);
  group.add(head);

  return group;
}

/**
 * Creates Standard 3D Car
 */
export function createCarMesh(colorHex: number = 0x2563eb): THREE.Group {
  const group = new THREE.Group();
  const carLength = 4.2;
  const carWidth = 1.8;

  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.5 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(carLength, carWidth, 0.6), bodyMat);
  body.position.set(0, 0, 0.45);
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(carLength * 0.55, carWidth * 0.85, 0.6), materials.egoGlass);
  cabin.position.set(-0.2, 0, 0.9);
  group.add(cabin);

  // 4 Wheels
  const wheelGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 14);
  wheelGeom.rotateZ(Math.PI / 2);

  const createW = (x: number, y: number) => {
    const w = new THREE.Mesh(wheelGeom, materials.tireRubber);
    w.position.set(x, y, 0.32);
    group.add(w);
  };

  createW(1.3, carWidth / 2 + 0.05);
  createW(1.3, -carWidth / 2 - 0.05);
  createW(-1.3, carWidth / 2 + 0.05);
  createW(-1.3, -carWidth / 2 - 0.05);

  return group;
}

/**
 * Factory for Traffic Obstacle Mesh
 */
export function createObstacleMesh(type: TrafficAgentType, color?: string): THREE.Group {
  let group: THREE.Group;
  const colorHex = color ? parseInt(color.replace('#', '0x'), 16) || 0x2563eb : 0x2563eb;

  switch (type) {
    case 'AUTO_RICKSHAW':
      group = createAutoRickshawMesh();
      break;
    case 'CATTLE':
      group = createCattleMesh();
      break;
    case 'TWO_WHEELER':
      group = createTwoWheelerMesh();
      break;
    case 'TRUCK':
      group = createTruckMesh();
      break;
    case 'PEDESTRIAN':
      group = createPedestrianMesh();
      break;
    case 'CAR':
    default:
      group = createCarMesh(colorHex);
      break;
  }

  return group;
}

/**
 * Creates 3D Roadside Decoration
 */
export function createDecorationMesh(type: 'TREE' | 'STALL' | 'TEMPLE' | 'BARRIER' | 'SIGN', label?: string): THREE.Group {
  const group = new THREE.Group();

  if (type === 'TREE') {
    // Banyan / Neem Tree
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 2.8, 8), materials.treeTrunk);
    trunk.position.z = 1.4;
    trunk.rotation.x = Math.PI / 2;
    group.add(trunk);

    const foliage1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8, 1), materials.treeLeaves);
    foliage1.position.z = 3.6;
    group.add(foliage1);

    const foliage2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 1), materials.treeLeaves);
    foliage2.position.set(0.6, 0.4, 4.2);
    group.add(foliage2);
  } else if (type === 'STALL') {
    // Chai / Fruit vendor roadside stall
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 0.9), materials.stallWood);
    counter.position.z = 0.45;
    group.add(counter);

    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 0.1), materials.stallAwning);
    awning.position.set(0, 0, 2.1);
    awning.rotation.y = 0.12; // tilted sun awning
    group.add(awning);
  } else if (type === 'TEMPLE') {
    // Roadside shrine
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 0.6), materials.curb);
    base.position.z = 0.3;
    group.add(base);

    const shikhara = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.2, 4), materials.shrineOrange);
    shikhara.position.z = 1.7;
    shikhara.rotation.z = Math.PI / 4;
    shikhara.rotation.x = Math.PI / 2;
    group.add(shikhara);
  } else if (type === 'SIGN') {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8), materials.signPost);
    post.position.z = 1.4;
    post.rotation.x = Math.PI / 2;
    group.add(post);

    const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.8), materials.signBoard);
    board.position.z = 2.4;
    group.add(board);
  }

  return group;
}
