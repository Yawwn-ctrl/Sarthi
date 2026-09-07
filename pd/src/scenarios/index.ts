/**
 * Scenarios Engine for Unstructured Indian Road Environments
 * Contains 9 modular scenarios across Market, Village, and Intersection domains,
 * plus 1 master Continuous Multi-Stage Indian Corridor scenario.
 */

import { Agent, Point2D, Scenario } from '../types/planner';

export const SCENARIOS: Scenario[] = [
  // ==========================================
  // MARKET SCENARIOS (APF Domain)
  // ==========================================
  {
    id: 'market-1-pedestrians',
    title: 'Market 1: Light Pedestrian & Auto Mix',
    category: 'MARKET',
    badge: 'APF Baseline',
    description: 'Chawri Bazaar style street with strolling shoppers, fruit carts, and an auto-rickshaw drifting ahead.',
    roadWidth: 16,
    centerlineWaypoints: [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 60, y: 0 },
      { x: 90, y: 0 }
    ],
    egoStart: {
      x: 0,
      y: 0,
      heading: 0,
      speed: 0,
      accel: 0,
      steerAngle: 0,
      curvature: 0,
      width: 1.8,
      length: 4.2,
      wheelbase: 2.7,
      radius: 1.3
    },
    egoGoal: { x: 85, y: 0 },
    obstacles: [
      {
        id: 'ped-1',
        type: 'PEDESTRIAN',
        x: 18,
        y: -4,
        vx: 0,
        vy: 0.8,
        heading: Math.PI / 2,
        width: 0.6,
        length: 0.6,
        radius: 0.5,
        color: '#ec4899',
        label: 'Shopper',
        speed: 0.8,
        targetSpeed: 0.8,
        behavior: 'CROSSING'
      },
      {
        id: 'ped-2',
        type: 'PEDESTRIAN',
        x: 32,
        y: 3.5,
        vx: 0.1,
        vy: -0.6,
        heading: -Math.PI / 2,
        width: 0.6,
        length: 0.6,
        radius: 0.5,
        color: '#f43f5e',
        label: 'Pedestrian',
        speed: 0.6,
        targetSpeed: 0.6,
        behavior: 'CROSSING'
      },
      {
        id: 'auto-1',
        type: 'AUTO_RICKSHAW',
        x: 45,
        y: -1.2,
        vx: 2.2,
        vy: 0.2,
        heading: 0.05,
        width: 1.4,
        length: 2.7,
        radius: 1.0,
        color: '#eab308',
        label: 'Auto (Bajaj)',
        speed: 2.2,
        targetSpeed: 2.2,
        behavior: 'LANE_FOLLOWING'
      },
      {
        id: 'ped-3',
        type: 'PEDESTRIAN',
        x: 62,
        y: -2.0,
        vx: 0.3,
        vy: 0.1,
        heading: 0,
        width: 0.6,
        length: 0.6,
        radius: 0.5,
        color: '#d946ef',
        label: 'Vendor Cart',
        speed: 0.3,
        targetSpeed: 0.3,
        behavior: 'WANDERING'
      }
    ],
    decorations: [
      { type: 'STALL', x: 15, y: -7, label: 'Spices' },
      { type: 'STALL', x: 28, y: 7, label: 'Textiles' },
      { type: 'STALL', x: 50, y: -7.5, label: 'Chai Stall' },
      { type: 'STALL', x: 65, y: 7, label: 'Fruits' }
    ]
  },
  {
    id: 'market-2-dense-bazaar',
    title: 'Market 2: Dense Bazaar Squeeze',
    category: 'MARKET',
    badge: 'High Density',
    description: 'Extremely tight clearance between parked scooters, oncoming bikes, and erratically moving pedestrians.',
    roadWidth: 14,
    centerlineWaypoints: [
      { x: 0, y: 0 },
      { x: 35, y: 0 },
      { x: 70, y: 0 },
      { x: 95, y: 0 }
    ],
    egoStart: {
      x: 0,
      y: 0,
      heading: 0,
      speed: 0,
      accel: 0,
      steerAngle: 0,
      curvature: 0,
      width: 1.8,
      length: 4.2,
      wheelbase: 2.7,
      radius: 1.3
    },
    egoGoal: { x: 90, y: 0 },
    obstacles: [
      {
        id: 'bike-parked-1',
        type: 'TWO_WHEELER',
        x: 14,
        y: -3.8,
        vx: 0,
        vy: 0,
        heading: 0.1,
        width: 0.8,
        length: 1.9,
        radius: 0.7,
        color: '#f97316',
        label: 'Parked Hero Splendor',
        speed: 0,
        targetSpeed: 0,
        behavior: 'STALLED'
      },
      {
        id: 'bike-oncoming-1',
        type: 'TWO_WHEELER',
        x: 38,
        y: 2.2,
        vx: -2.8,
        vy: -0.1,
        heading: Math.PI,
        width: 0.8,
        length: 1.9,
        radius: 0.7,
        color: '#ea580c',
        label: 'Oncoming Pulsar',
        speed: 2.8,
        targetSpeed: 2.8,
        behavior: 'LANE_FOLLOWING'
      },
      {
        id: 'auto-cutin',
        type: 'AUTO_RICKSHAW',
        x: 28,
        y: -2.5,
        vx: 1.8,
        vy: 0.8,
        heading: 0.35,
        width: 1.4,
        length: 2.7,
        radius: 1.0,
        color: '#84cc16',
        label: 'Cutting Auto',
        speed: 2.0,
        targetSpeed: 2.0,
        behavior: 'AGGRESSIVE_CUT_IN'
      },
      {
        id: 'ped-crowd-1',
        type: 'PEDESTRIAN',
        x: 52,
        y: 1.5,
        vx: -0.2,
        vy: -0.5,
        heading: -Math.PI / 2,
        width: 0.6,
        length: 0.6,
        radius: 0.5,
        color: '#ec4899',
        label: 'Pedestrian',
        speed: 0.6,
        targetSpeed: 0.6,
        behavior: 'CROSSING'
      },
      {
        id: 'bike-parked-2',
        type: 'TWO_WHEELER',
        x: 68,
        y: 3.5,
        vx: 0,
        vy: 0,
        heading: 0,
        width: 0.8,
        length: 1.9,
        radius: 0.7,
        color: '#f97316',
        label: 'Activa',
        speed: 0,
        targetSpeed: 0,
        behavior: 'STALLED'
      }
    ],
    decorations: [
      { type: 'STALL', x: 20, y: -6, label: 'Paan Shop' },
      { type: 'STALL', x: 40, y: 6, label: 'Sweets' },
      { type: 'STALL', x: 75, y: -6, label: 'Hardware' }
    ]
  },
  {
    id: 'market-3-stalled-truck',
    title: 'Market 3: Stalled Tata Lorry Trap Escape',
    category: 'MARKET',
    badge: 'Anti-Trap Benchmark',
    description: 'A massive stalled Tata truck blocks the lane directly ahead. Evaluates APF zero-gradient trap detection and deterministic tangential escape.',
    roadWidth: 16,
    centerlineWaypoints: [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 60, y: 0 },
      { x: 90, y: 0 }
    ],
    egoStart: {
      x: 0,
      y: 0,
      heading: 0,
      speed: 0,
      accel: 0,
      steerAngle: 0,
      curvature: 0,
      width: 1.8,
      length: 4.2,
      wheelbase: 2.7,
      radius: 1.3
    },
    egoGoal: { x: 80, y: 0 },
    obstacles: [
      {
        id: 'stalled-lorry',
        type: 'TRUCK',
        x: 35,
        y: 0.0, // Dead center obstacle on goal line
        vx: 0,
        vy: 0,
        heading: 0,
        width: 2.6,
        length: 7.2,
        radius: 2.2,
        color: '#ca8a04',
        label: 'Stalled Tata Truck 1613',
        speed: 0,
        targetSpeed: 0,
        isStalled: true,
        behavior: 'STALLED'
      },
      {
        id: 'side-cart',
        type: 'PEDESTRIAN',
        x: 35,
        y: 5.5,
        vx: 0,
        vy: 0,
        heading: 0,
        width: 1.0,
        length: 1.0,
        radius: 0.8,
        color: '#a855f7',
        label: 'Vegetable Cart',
        speed: 0,
        targetSpeed: 0,
        behavior: 'STALLED'
      }
    ],
    decorations: [
      { type: 'BARRIER', x: 32, y: 0, label: 'Hazard Leaves' },
      { type: 'STALL', x: 20, y: -7, label: 'Mechanic Shop' }
    ]
  },

  // ==========================================
  // VILLAGE SCENARIOS (Frenet Frame Domain)
  // ==========================================
  {
    id: 'village-1-curving-track',
    title: 'Village 1: Curving Dirt Track (Kaccha Road)',
    category: 'VILLAGE',
    badge: 'Frenet Spline',
    description: 'Smooth S-curve through rural greenery. Demonstrates curvilinear Frenet coordinate transformation and straight-line center tracking.',
    roadWidth: 10,
    centerlineWaypoints: [
      { x: 0, y: 0 },
      { x: 25, y: -3 },
      { x: 50, y: 8 },
      { x: 75, y: 2 },
      { x: 105, y: -4 },
      { x: 130, y: 0 }
    ],
    egoStart: {
      x: 0,
      y: 0,
      heading: -0.1,
      speed: 0,
      accel: 0,
      steerAngle: 0,
      curvature: 0,
      width: 1.8,
      length: 4.2,
      wheelbase: 2.7,
      radius: 1.3
    },
    egoGoal: { x: 125, y: 0 },
    obstacles: [
      {
        id: 'slow-tractor',
        type: 'TRUCK',
        x: 65,
        y: 4.5,
        vx: 1.5,
        vy: -0.3,
        heading: -0.2,
        width: 2.0,
        length: 4.0,
        radius: 1.5,
        color: '#dc2626',
        label: 'Mahindra Tractor',
        speed: 1.5,
        targetSpeed: 1.5,
        behavior: 'LANE_FOLLOWING'
      }
    ],
    decorations: [
      { type: 'TREE', x: 15, y: -9 },
      { type: 'TREE', x: 35, y: 12 },
      { type: 'TREE', x: 60, y: -8 },
      { type: 'TREE', x: 90, y: 9 },
      { type: 'SIGN', x: 5, y: 6, label: 'Village Speed 20km/h' }
    ]
  },
  {
    id: 'village-2-cattle-bypass',
    title: 'Village 2: Wandering Cattle Herd Bypass',
    category: 'VILLAGE',
    badge: 'Strict Straight Bias',
    description: 'Sacred Indian cows resting and grazing on the roadway. Strict lateral penalty (wd) ensures minimal diversion and instant return to center.',
    roadWidth: 11,
    centerlineWaypoints: [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 60, y: 0 },
      { x: 90, y: 0 },
      { x: 120, y: 0 }
    ],
    egoStart: {
      x: 0,
      y: 0,
      heading: 0,
      speed: 0,
      accel: 0,
      steerAngle: 0,
      curvature: 0,
      width: 1.8,
      length: 4.2,
      wheelbase: 2.7,
      radius: 1.3
    },
    egoGoal: { x: 115, y: 0 },
    obstacles: [
      {
        id: 'cow-1',
        type: 'CATTLE',
        x: 35,
        y: 0.8,
        vx: 0.1,
        vy: 0.2,
        heading: 1.2,
        width: 1.1,
        length: 2.4,
        radius: 1.2,
        color: '#f8fafc',
        label: 'Desi Cow (Resting)',
        speed: 0.2,
        targetSpeed: 0.2,
        behavior: 'WANDERING'
      },
      {
        id: 'cow-2',
        type: 'CATTLE',
        x: 65,
        y: -1.2,
        vx: -0.1,
        vy: 0.1,
        heading: 2.5,
        width: 1.0,
        length: 2.2,
        radius: 1.1,
        color: '#e2e8f0',
        label: 'Calf (Grazing)',
        speed: 0.1,
        targetSpeed: 0.1,
        behavior: 'WANDERING'
      },
      {
        id: 'oncoming-cycle',
        type: 'TWO_WHEELER',
        x: 88,
        y: 2.5,
        vx: -2.0,
        vy: 0,
        heading: Math.PI,
        width: 0.6,
        length: 1.8,
        radius: 0.6,
        color: '#38bdf8',
        label: 'Bicycle Rider',
        speed: 2.0,
        targetSpeed: 2.0,
        behavior: 'LANE_FOLLOWING'
      }
    ],
    decorations: [
      { type: 'TEMPLE', x: 50, y: 9, label: 'Village Shrine' },
      { type: 'TREE', x: 25, y: -7 },
      { type: 'TREE', x: 80, y: -7 }
    ]
  },
  {
    id: 'village-3-culvert-bridge',
    title: 'Village 3: Narrow Culvert Bridge Merge',
    category: 'VILLAGE',
    badge: 'Corridor Bottleneck',
    description: 'Road narrows down to a single-lane concrete culvert. Frenet quintic polynomial plans smooth bottleneck entry and deceleration.',
    roadWidth: 7,
    centerlineWaypoints: [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 60, y: 0 },
      { x: 90, y: 0 }
    ],
    egoStart: {
      x: 0,
      y: 0,
      heading: 0,
      speed: 0,
      accel: 0,
      steerAngle: 0,
      curvature: 0,
      width: 1.8,
      length: 4.2,
      wheelbase: 2.7,
      radius: 1.3
    },
    egoGoal: { x: 85, y: 0 },
    obstacles: [
      {
        id: 'oncoming-bike-culvert',
        type: 'TWO_WHEELER',
        x: 75,
        y: 0.5,
        vx: -3.0,
        vy: 0,
        heading: Math.PI,
        width: 0.7,
        length: 1.8,
        radius: 0.6,
        color: '#fb923c',
        label: 'Royal Enfield',
        speed: 3.0,
        targetSpeed: 3.0,
        behavior: 'LANE_FOLLOWING'
      }
    ],
    decorations: [
      { type: 'BARRIER', x: 35, y: -3.8, label: 'Culvert Parapet' },
      { type: 'BARRIER', x: 35, y: 3.8, label: 'Culvert Parapet' },
      { type: 'BARRIER', x: 55, y: -3.8, label: 'Culvert Parapet' },
      { type: 'BARRIER', x: 55, y: 3.8, label: 'Culvert Parapet' }
    ]
  },

  // ==========================================
  // INTERSECTION SCENARIOS (Gap Acceptance Domain)
  // ==========================================
  {
    id: 'intersection-1-high-speed-cross',
    title: 'Intersection 1: High-Speed Uncontrolled Crossing',
    category: 'INTERSECTION',
    badge: 'TTC Critical Gap',
    description: 'Signal-less 4-way cross-junction with perpendicular high-speed cars. FSM yields, calculates TTC, and commits straight-line crossing.',
    roadWidth: 14,
    centerlineWaypoints: [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 60, y: 0 },
      { x: 90, y: 0 }
    ],
    egoStart: {
      x: 0,
      y: 0,
      heading: 0,
      speed: 4.0,
      accel: 0,
      steerAngle: 0,
      curvature: 0,
      width: 1.8,
      length: 4.2,
      wheelbase: 2.7,
      radius: 1.3
    },
    egoGoal: { x: 85, y: 0 },
    intersectionZone: {
      entryLine: [{ x: 32, y: -8 }, { x: 32, y: 8 }],
      conflictPolygon: [
        { x: 32, y: -10 },
        { x: 56, y: -10 },
        { x: 56, y: 10 },
        { x: 32, y: 10 }
      ],
      exitLine: [{ x: 56, y: -8 }, { x: 56, y: 8 }]
    },
    obstacles: [
      {
        id: 'cross-car-1',
        type: 'CAR',
        x: 44,
        y: -30,
        vx: 0,
        vy: 7.5,
        heading: Math.PI / 2,
        width: 1.8,
        length: 4.4,
        radius: 1.4,
        color: '#38bdf8',
        label: 'Cross Sedan (7.5 m/s)',
        speed: 7.5,
        targetSpeed: 7.5,
        behavior: 'CROSSING'
      },
      {
        id: 'cross-car-2',
        type: 'CAR',
        x: 44,
        y: 45,
        vx: 0,
        vy: -6.8,
        heading: -Math.PI / 2,
        width: 1.8,
        length: 4.4,
        radius: 1.4,
        color: '#60a5fa',
        label: 'Cross SUV (Gap trailing)',
        speed: 6.8,
        targetSpeed: 6.8,
        behavior: 'CROSSING'
      }
    ],
    decorations: [
      { type: 'SIGN', x: 28, y: -9, label: 'Uncontrolled Junction' }
    ]
  },
  {
    id: 'intersection-2-blind-t-junction',
    title: 'Intersection 2: Blind T-Junction Merge',
    category: 'INTERSECTION',
    badge: 'Yield & Merge',
    description: 'Entering a busy arterial road from an alley with roadside structures blocking direct line-of-sight until creep zone.',
    roadWidth: 14,
    centerlineWaypoints: [
      { x: 0, y: 0 },
      { x: 28, y: 0 },
      { x: 50, y: 0 },
      { x: 80, y: 0 }
    ],
    egoStart: {
      x: 0,
      y: 0,
      heading: 0,
      speed: 3.0,
      accel: 0,
      steerAngle: 0,
      curvature: 0,
      width: 1.8,
      length: 4.2,
      wheelbase: 2.7,
      radius: 1.3
    },
    egoGoal: { x: 75, y: 0 },
    intersectionZone: {
      entryLine: [{ x: 30, y: -7 }, { x: 30, y: 7 }],
      conflictPolygon: [
        { x: 30, y: -12 },
        { x: 52, y: -12 },
        { x: 52, y: 12 },
        { x: 30, y: 12 }
      ],
      exitLine: [{ x: 52, y: -7 }, { x: 52, y: 7 }]
    },
    obstacles: [
      {
        id: 'cross-auto-1',
        type: 'AUTO_RICKSHAW',
        x: 41,
        y: -18,
        vx: 0,
        vy: 4.2,
        heading: Math.PI / 2,
        width: 1.4,
        length: 2.7,
        radius: 1.0,
        color: '#eab308',
        label: 'Auto Stream 1',
        speed: 4.2,
        targetSpeed: 4.2,
        behavior: 'CROSSING'
      },
      {
        id: 'cross-bike-2',
        type: 'TWO_WHEELER',
        x: 41,
        y: -36,
        vx: 0,
        vy: 5.5,
        heading: Math.PI / 2,
        width: 0.8,
        length: 1.9,
        radius: 0.7,
        color: '#f97316',
        label: 'Following Bike',
        speed: 5.5,
        targetSpeed: 5.5,
        behavior: 'CROSSING'
      }
    ],
    decorations: [
      { type: 'STALL', x: 26, y: -8, label: 'News Stand (Blind Sight)' },
      { type: 'STALL', x: 26, y: 8, label: 'Tea Stall' }
    ]
  },
  {
    id: 'intersection-3-multi-vehicle-deadlock',
    title: 'Intersection 3: Multi-Vehicle Chaotic Merge',
    category: 'INTERSECTION',
    badge: 'Deadlock Resolver',
    description: 'Multiple heterogeneous vehicles approaching the intersection box concurrently. Assesses gap acceptance robustness in dense chaotic flows.',
    roadWidth: 16,
    centerlineWaypoints: [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 60, y: 0 },
      { x: 90, y: 0 }
    ],
    egoStart: {
      x: 0,
      y: 0,
      heading: 0,
      speed: 3.5,
      accel: 0,
      steerAngle: 0,
      curvature: 0,
      width: 1.8,
      length: 4.2,
      wheelbase: 2.7,
      radius: 1.3
    },
    egoGoal: { x: 85, y: 0 },
    intersectionZone: {
      entryLine: [{ x: 30, y: -9 }, { x: 30, y: 9 }],
      conflictPolygon: [
        { x: 30, y: -12 },
        { x: 55, y: -12 },
        { x: 55, y: 12 },
        { x: 30, y: 12 }
      ],
      exitLine: [{ x: 55, y: -9 }, { x: 55, y: 9 }]
    },
    obstacles: [
      {
        id: 'deadlock-truck',
        type: 'TRUCK',
        x: 42,
        y: -24,
        vx: 0,
        vy: 3.2,
        heading: Math.PI / 2,
        width: 2.4,
        length: 6.0,
        radius: 1.8,
        color: '#ca8a04',
        label: 'Eicher Delivery',
        speed: 3.2,
        targetSpeed: 3.2,
        behavior: 'CROSSING'
      },
      {
        id: 'deadlock-auto',
        type: 'AUTO_RICKSHAW',
        x: 45,
        y: 26,
        vx: 0,
        vy: -3.8,
        heading: -Math.PI / 2,
        width: 1.4,
        length: 2.7,
        radius: 1.0,
        color: '#eab308',
        label: 'Shared Auto',
        speed: 3.8,
        targetSpeed: 3.8,
        behavior: 'CROSSING'
      },
      {
        id: 'deadlock-bike',
        type: 'TWO_WHEELER',
        x: 42,
        y: -48,
        vx: 0,
        vy: 6.0,
        heading: Math.PI / 2,
        width: 0.8,
        length: 1.9,
        radius: 0.7,
        color: '#f97316',
        label: 'Fast Scooter',
        speed: 6.0,
        targetSpeed: 6.0,
        behavior: 'CROSSING'
      }
    ],
    decorations: [
      { type: 'SIGN', x: 27, y: 10, label: 'Chowk Intersection' }
    ]
  },

  // ==========================================
  // MASTER MULTI-STAGE CORRIDOR SCENARIO
  // ==========================================
  {
    id: 'master-mixed-corridor',
    title: 'Master Corridor: Market -> Village -> Uncontrolled Junction',
    category: 'MIXED_CORRIDOR',
    badge: 'Full Multi-Planner Switch',
    description: 'Comprehensive Indian transit: Starts in dense market (APF) -> transitions to winding village track with cattle (Frenet) -> crosses busy uncontrolled junction (Gap Acceptance).',
    roadWidth: 14,
    centerlineWaypoints: [
      { x: 0, y: 0 },
      { x: 35, y: 0 },     // Market zone
      { x: 70, y: 0 },     // Market to rural transition
      { x: 100, y: -4 },   // Village S-curve
      { x: 130, y: 5 },    // Village cattle curve
      { x: 160, y: 0 },    // Rural straightaway
      { x: 195, y: 0 },    // Intersection zone
      { x: 230, y: 0 },    // Exit zone
      { x: 260, y: 0 }
    ],
    egoStart: {
      x: 0,
      y: 0,
      heading: 0,
      speed: 0,
      accel: 0,
      steerAngle: 0,
      curvature: 0,
      width: 1.8,
      length: 4.2,
      wheelbase: 2.7,
      radius: 1.3
    },
    egoGoal: { x: 255, y: 0 },
    intersectionZone: {
      entryLine: [{ x: 185, y: -9 }, { x: 185, y: 9 }],
      conflictPolygon: [
        { x: 185, y: -14 },
        { x: 215, y: -14 },
        { x: 215, y: 14 },
        { x: 185, y: 14 }
      ],
      exitLine: [{ x: 215, y: -9 }, { x: 215, y: 9 }]
    },
    obstacles: [
      // Zone 1: Market (x: 10 to 60)
      {
        id: 'm-ped-1',
        type: 'PEDESTRIAN',
        x: 18,
        y: -3,
        vx: 0,
        vy: 0.7,
        heading: Math.PI / 2,
        width: 0.6,
        length: 0.6,
        radius: 0.5,
        color: '#ec4899',
        label: 'Shopper',
        speed: 0.7,
        targetSpeed: 0.7,
        behavior: 'CROSSING'
      },
      {
        id: 'm-auto-1',
        type: 'AUTO_RICKSHAW',
        x: 34,
        y: 1.5,
        vx: 1.8,
        vy: -0.2,
        heading: -0.1,
        width: 1.4,
        length: 2.7,
        radius: 1.0,
        color: '#eab308',
        label: 'Auto Bajaj',
        speed: 1.8,
        targetSpeed: 1.8,
        behavior: 'LANE_FOLLOWING'
      },
      {
        id: 'm-bike-1',
        type: 'TWO_WHEELER',
        x: 50,
        y: -2.0,
        vx: 0,
        vy: 0,
        heading: 0,
        width: 0.8,
        length: 1.9,
        radius: 0.7,
        color: '#f97316',
        label: 'Parked Bike',
        speed: 0,
        targetSpeed: 0,
        behavior: 'STALLED'
      },

      // Zone 2: Village Track (x: 75 to 165)
      {
        id: 'v-cow-1',
        type: 'CATTLE',
        x: 110,
        y: -1.0,
        vx: 0.1,
        vy: 0.1,
        heading: 0.8,
        width: 1.1,
        length: 2.3,
        radius: 1.2,
        color: '#f1f5f9',
        label: 'Village Cow',
        speed: 0.1,
        targetSpeed: 0.1,
        behavior: 'WANDERING'
      },
      {
        id: 'v-cow-2',
        type: 'CATTLE',
        x: 140,
        y: 2.5,
        vx: -0.1,
        vy: 0,
        heading: Math.PI,
        width: 1.0,
        length: 2.1,
        radius: 1.1,
        color: '#e2e8f0',
        label: 'Calf',
        speed: 0.1,
        targetSpeed: 0.1,
        behavior: 'WANDERING'
      },

      // Zone 3: Uncontrolled Intersection (x: 185 to 215)
      {
        id: 'int-car-1',
        type: 'CAR',
        x: 200,
        y: -35,
        vx: 0,
        vy: 6.5,
        heading: Math.PI / 2,
        width: 1.8,
        length: 4.4,
        radius: 1.4,
        color: '#38bdf8',
        label: 'Cross Traffic 1',
        speed: 6.5,
        targetSpeed: 6.5,
        behavior: 'CROSSING'
      },
      {
        id: 'int-truck-2',
        type: 'TRUCK',
        x: 200,
        y: 48,
        vx: 0,
        vy: -5.0,
        heading: -Math.PI / 2,
        width: 2.4,
        length: 6.2,
        radius: 1.8,
        color: '#ca8a04',
        label: 'Tata Lorry',
        speed: 5.0,
        targetSpeed: 5.0,
        behavior: 'CROSSING'
      }
    ],
    decorations: [
      { type: 'STALL', x: 20, y: -7, label: 'Market Gateway' },
      { type: 'TREE', x: 85, y: -9, label: 'Banyan Tree' },
      { type: 'TEMPLE', x: 125, y: 11, label: 'Hanuman Temple' },
      { type: 'SIGN', x: 175, y: -9, label: 'Uncontrolled Crossing 50m' },
      { type: 'SIGN', x: 240, y: 7, label: 'Destination Village' }
    ]
  }
];
