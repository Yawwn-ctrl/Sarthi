/**
 * 3D Simulation Canvas Component
 * Full Three.js 3D WebGL Simulation for Autonomous Vehicle Adaptive Path Planning
 * on Unstructured Indian Roads with 32-Beam 3D LiDAR & 77GHz Automotive RADAR Perception.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Agent,
  CameraMode3D,
  EnvironmentLighting,
  Scenario,
  SensorConfig,
  SimulationMetrics,
  TrafficAgentType
} from '../types/planner';
import { SimulationEngine } from '../simulation/engine';
import { createEgoVehicleMesh, createObstacleMesh } from './3d/VehicleModels';
import { RoadEnvironment3D } from './3d/RoadEnvironment';
import { SensorVisualizer3D } from './3d/SensorMeshes';
import {
  Activity,
  AlertTriangle,
  Camera,
  Car,
  Compass,
  Crosshair,
  Eye,
  Layers,
  Maximize2,
  Minimize2,
  Moon,
  Navigation,
  Radio,
  RotateCw,
  Sliders,
  Sparkles,
  Sun,
  Sunset,
  Volume2,
  Wifi,
  Zap
} from 'lucide-react';

interface SimulationCanvasProps {
  engine: SimulationEngine;
  scenario: Scenario;
  metrics: SimulationMetrics;
  layerVisibility: {
    apfVectors: boolean;
    frenetFan: boolean;
    gapCones: boolean;
    centerline: boolean;
    boundingRadii: boolean;
    sensorLidar: boolean;
    trajectoryHistory: boolean;
    potholes?: boolean;
    imaginaryCenterline?: boolean;
  };
  onToggleLayer: (layerKey: string) => void;
  onCanvasClickSpawn?: (type: TrafficAgentType, x: number, y: number) => void;
  selectedSpawnType: TrafficAgentType | null;
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  engine,
  scenario,
  metrics,
  layerVisibility,
  onToggleLayer,
  onCanvasClickSpawn,
  selectedSpawnType
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sensor and 3D Camera Controls State
  const [cameraMode, setCameraMode] = useState<CameraMode3D>('CHASE');
  const [lighting, setLighting] = useState<EnvironmentLighting>('SUNSET');
  const [showSensorSettings, setShowSensorSettings] = useState<boolean>(false);

  // Local sensor config state
  const [sensorConfig, setSensorConfig] = useState<SensorConfig>({
    lidarEnabled: true,
    lidarRange: 50,
    lidarBeams: 32,
    lidarShowBeams: true,
    lidarColorMode: 'ELEVATION',
    radarEnabled: true,
    radarRange: 80,
    radarFovDegrees: 70,
    radarShowFrustum: true,
    radarShowDoppler: true,
    showBoundingBoxes3D: true,
    cameraMode: 'CHASE',
    lighting: 'SUNSET'
  });

  // Sync with engine
  useEffect(() => {
    engine.sensorConfig = {
      ...sensorConfig,
      cameraMode,
      lighting
    };
  }, [sensorConfig, cameraMode, lighting, engine]);

  // Orbit camera drag state for 'ORBIT' mode
  const orbitState = useRef({
    distance: 28,
    theta: -Math.PI / 4,
    phi: Math.PI / 3.2,
    target: new THREE.Vector3(0, 0, 0),
    isDragging: false,
    dragButton: 0, // 0 = left, 2 = right
    lastMouseX: 0,
    lastMouseY: 0
  });

  // Three.js References
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    dirLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    roadEnv: RoadEnvironment3D;
    sensorVis: SensorVisualizer3D;
    egoMeshes: ReturnType<typeof createEgoVehicleMesh>;
    obstacleMeshes: Map<string, THREE.Group>;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;
    groundPlane: THREE.Plane;
  } | null>(null);

  // Initialize Three.js WebGL Scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 520;

    // 1. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.008);

    // 3. Camera
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.2, 350);
    camera.up.set(0, 0, 1); // Z is up in robotics / autonomous driving convention

    // 4. Lights
    const hemiLight = new THREE.HemisphereLight(0xffecd2, 0x1e293b, 0.85);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff1db, 1.8);
    dirLight.position.set(40, 25, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 5;
    dirLight.shadow.camera.far = 120;
    scene.add(dirLight);

    // 5. Road Environment 3D
    const roadEnv = new RoadEnvironment3D();
    roadEnv.build(scenario);
    scene.add(roadEnv.group);

    // 6. Ego Vehicle 3D Model
    const egoMeshes = createEgoVehicleMesh();
    scene.add(egoMeshes.group);

    // 7. Sensor Perception 3D Visualizer
    const sensorVis = new SensorVisualizer3D();
    scene.add(sensorVis.lidarPointsMesh);
    scene.add(sensorVis.lidarSweepMesh);
    scene.add(sensorVis.radarFrustumMesh);
    scene.add(sensorVis.radarDopplerGroup);
    scene.add(sensorVis.boundingBoxesGroup);
    scene.add(sensorVis.plannedPathLine);
    scene.add(sensorVis.frenetFanGroup);
    scene.add(sensorVis.apfVectorsGroup);
    scene.add(sensorVis.goalBeaconGroup);
    scene.add(sensorVis.potholesGroup);
    scene.add(sensorVis.imaginaryCenterlineGroup);

    // Raycaster for obstacle spawning
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    threeRef.current = {
      renderer,
      scene,
      camera,
      dirLight,
      hemiLight,
      roadEnv,
      sensorVis,
      egoMeshes,
      obstacleMeshes: new Map(),
      raycaster,
      mouse,
      groundPlane
    };

    // Resize listener
    const handleResize = () => {
      if (!containerRef.current || !threeRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      threeRef.current.renderer.setSize(w, h);
      threeRef.current.camera.aspect = w / h;
      threeRef.current.camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      renderer.dispose();
      threeRef.current = null;
    };
  }, []);

  // Rebuild 3D road environment when scenario changes
  useEffect(() => {
    if (threeRef.current) {
      threeRef.current.roadEnv.build(scenario);
      threeRef.current.sensorVis.setGoalPosition(scenario.egoGoal);
    }
  }, [scenario]);

  // Update Environment Lighting Preset (Day, Sunset, Cyber-AV)
  useEffect(() => {
    if (!threeRef.current) return;
    const { scene, dirLight, hemiLight } = threeRef.current;

    if (lighting === 'DAY') {
      scene.background = new THREE.Color(0x60a5fa); // Bright blue Indian sky
      scene.fog = new THREE.FogExp2(0x93c5fd, 0.005);
      hemiLight.color.setHex(0xffffff);
      hemiLight.groundColor.setHex(0x334155);
      hemiLight.intensity = 1.0;
      dirLight.color.setHex(0xffffff);
      dirLight.intensity = 2.0;
      dirLight.position.set(20, 10, 60);
    } else if (lighting === 'SUNSET') {
      scene.background = new THREE.Color(0x1e1b2e); // Warm dusk
      scene.fog = new THREE.FogExp2(0x271e2e, 0.007);
      hemiLight.color.setHex(0xfb923c); // Warm amber
      hemiLight.groundColor.setHex(0x1e293b);
      hemiLight.intensity = 0.8;
      dirLight.color.setHex(0xf97316); // Golden hour sun
      dirLight.intensity = 2.2;
      dirLight.position.set(60, 40, 25);
    } else {
      // NIGHT_CYBER (Sensor Autonomous Mode)
      scene.background = new THREE.Color(0x040711); // Midnight darkness
      scene.fog = new THREE.FogExp2(0x040711, 0.01);
      hemiLight.color.setHex(0x0284c7); // Cyan glow
      hemiLight.groundColor.setHex(0x030712);
      hemiLight.intensity = 0.4;
      dirLight.color.setHex(0x38bdf8);
      dirLight.intensity = 0.8;
      dirLight.position.set(0, 0, 40);
    }
  }, [lighting]);

  // Main 3D Animation & Render Loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      if (threeRef.current) {
        const {
          renderer,
          scene,
          camera,
          sensorVis,
          egoMeshes,
          obstacleMeshes
        } = threeRef.current;

        const ego = engine.ego;
        const perception = engine.perception;
        const plannerOutput = engine.currentPlannerOutput;
        const time = performance.now() * 0.001;

        // 1. Update Ego Autonomous SUV Position and Orientation
        egoMeshes.group.position.set(ego.x, ego.y, 0);
        egoMeshes.group.rotation.z = ego.heading;

        // Steer front wheels
        egoMeshes.frontLeftWheel.rotation.z = ego.steerAngle;
        egoMeshes.frontRightWheel.rotation.z = ego.steerAngle;

        // Spin roof LiDAR puck
        egoMeshes.lidarPuck.rotation.y = time * 20.0;

        // 2. Update Obstacle Meshes (Create, Update, Prune)
        const activeIds = new Set<string>();
        for (const obs of engine.obstacles) {
          activeIds.add(obs.id);
          let obsMesh = obstacleMeshes.get(obs.id);

          if (!obsMesh) {
            obsMesh = createObstacleMesh(obs.type, obs.color);
            scene.add(obsMesh);
            obstacleMeshes.set(obs.id, obsMesh);
          }

          obsMesh.position.set(obs.x, obs.y, 0);
          obsMesh.rotation.z = obs.heading;
        }

        // Remove deleted obstacles
        for (const [id, mesh] of obstacleMeshes.entries()) {
          if (!activeIds.has(id)) {
            scene.remove(mesh);
            obstacleMeshes.delete(id);
          }
        }

        // 3. Update Sensor Perception Visualizers
        if (perception) {
          sensorVis.updateLidarPoints(perception.lidarPoints, sensorConfig);
          sensorVis.updateLidarSweep(ego, sensorConfig, time);
          sensorVis.updateRadarFrustum(ego, sensorConfig);
          sensorVis.updateRadarDoppler(perception.radarTargets, sensorConfig);
          sensorVis.updateBoundingBoxes(perception.boundingBoxes3D, sensorConfig);
        }

        // 4. Update Planned Path and Trajectory Visualizers
        if (plannerOutput) {
          sensorVis.updatePlannedPath(plannerOutput.plannedPath, plannerOutput.activePlanner);
          sensorVis.updateFrenetFan(plannerOutput.frenetCandidates, layerVisibility.frenetFan);
          sensorVis.updateAPFVectors(plannerOutput.apfForceVectors, layerVisibility.apfVectors);

          // 4b. Update Imaginary Centerline Layer (Road Slip Guard initiating from ego)
          sensorVis.updateImaginaryCenterline(
            plannerOutput.imaginaryCenterline,
            layerVisibility.imaginaryCenterline !== false,
            Boolean(plannerOutput.roadEdgeWarning),
            time,
            scenario.roadWidth || 14
          );
        }

        // 4c. Update Potholes Visual Layer (Fixed obstacles + APF Repulsive Sources)
        sensorVis.updatePotholes(
          engine.potholes,
          layerVisibility.potholes !== false,
          time
        );

        // 5. Update Camera based on active CameraMode3D
        if (cameraMode === 'CHASE') {
          // Dynamic chase camera following behind ego with look-ahead
          const chaseDist = 11.5;
          const chaseHeight = 4.2;
          const lookAheadDist = 8.0;

          const targetCamX = ego.x - Math.cos(ego.heading) * chaseDist;
          const targetCamY = ego.y - Math.sin(ego.heading) * chaseDist;
          const targetCamZ = chaseHeight;

          // Smooth interpolation
          camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.12);

          const lookX = ego.x + Math.cos(ego.heading) * lookAheadDist;
          const lookY = ego.y + Math.sin(ego.heading) * lookAheadDist;
          camera.lookAt(lookX, lookY, 1.2);
        } else if (cameraMode === 'COCKPIT') {
          // Inside ego cabin POV looking out the front windshield
          const eyeX = ego.x + Math.cos(ego.heading) * 0.4;
          const eyeY = ego.y + Math.sin(ego.heading) * 0.4;
          camera.position.set(eyeX, eyeY, 1.18);

          const forwardX = eyeX + Math.cos(ego.heading) * 30.0;
          const forwardY = eyeY + Math.sin(ego.heading) * 30.0;
          camera.lookAt(forwardX, forwardY, 0.9);
        } else if (cameraMode === 'TOP_DOWN') {
          // High-altitude tactical 3D top-down bird's-eye view
          const topZ = 42.0;
          camera.position.lerp(new THREE.Vector3(ego.x - 3, ego.y, topZ), 0.1);
          camera.lookAt(ego.x + 4, ego.y, 0);
        } else if (cameraMode === 'ORBIT') {
          // Free Orbit / Drone 3D view
          const orb = orbitState.current;
          orb.target.lerp(new THREE.Vector3(ego.x, ego.y, 1.0), 0.08);

          const camX = orb.target.x + orb.distance * Math.sin(orb.phi) * Math.cos(orb.theta);
          const camY = orb.target.y + orb.distance * Math.sin(orb.phi) * Math.sin(orb.theta);
          const camZ = orb.target.z + orb.distance * Math.cos(orb.phi);

          camera.position.set(camX, camY, camZ);
          camera.lookAt(orb.target);
        }

        // Render Frame
        renderer.render(scene, camera);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [engine, scenario, cameraMode, sensorConfig, layerVisibility]);

  // Mouse Orbit Drag & Zoom Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedSpawnType) {
      // Spawn obstacle in 3D using Three.js raycasting
      if (threeRef.current && onCanvasClickSpawn) {
        const { camera, raycaster, mouse, groundPlane } = threeRef.current;
        const rect = e.currentTarget.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane, intersectPoint);

        if (intersectPoint) {
          onCanvasClickSpawn(selectedSpawnType, intersectPoint.x, intersectPoint.y);
        }
      }
      return;
    }

    orbitState.current.isDragging = true;
    orbitState.current.dragButton = e.button;
    orbitState.current.lastMouseX = e.clientX;
    orbitState.current.lastMouseY = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!orbitState.current.isDragging) return;

    const dx = e.clientX - orbitState.current.lastMouseX;
    const dy = e.clientY - orbitState.current.lastMouseY;
    orbitState.current.lastMouseX = e.clientX;
    orbitState.current.lastMouseY = e.clientY;

    if (cameraMode !== 'ORBIT') {
      // Automatically switch to Orbit mode when user drags canvas
      setCameraMode('ORBIT');
    }

    if (orbitState.current.dragButton === 0) {
      // Rotate
      orbitState.current.theta -= dx * 0.008;
      orbitState.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, orbitState.current.phi - dy * 0.008));
    } else {
      // Pan
      orbitState.current.target.x -= dx * 0.05;
      orbitState.current.target.y += dy * 0.05;
    }
  };

  const handleMouseUp = () => {
    orbitState.current.isDragging = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (cameraMode !== 'ORBIT') {
      setCameraMode('ORBIT');
    }
    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    orbitState.current.distance = Math.max(6, Math.min(90, orbitState.current.distance * factor));
  };

  const stats = engine.perception?.sensorStats;
  const criticalThreat = stats?.emergencyBrakeRequired;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[540px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none"
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${
          selectedSpawnType ? 'cursor-crosshair' : orbitState.current.isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={e => e.preventDefault()}
      />

      {/* 1. TOP-LEFT: 3D Camera Mode & Environment Lighting Pills */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-800 shadow-lg text-xs z-10">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">View</span>

        <button
          onClick={() => setCameraMode('CHASE')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            cameraMode === 'CHASE'
              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
          }`}
          title="3D Chase Camera (Follows Ego Behind)"
        >
          <Car className="w-3.5 h-3.5 text-cyan-400" />
          <span>Chase 3D</span>
        </button>

        <button
          onClick={() => setCameraMode('COCKPIT')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            cameraMode === 'COCKPIT'
              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
          }`}
          title="1st-Person Driver / Sensor POV"
        >
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
          <span>Cockpit POV</span>
        </button>

        <button
          onClick={() => setCameraMode('ORBIT')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            cameraMode === 'ORBIT'
              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
          }`}
          title="Free 3D Orbit / Drone (Drag to Orbit, Scroll to Zoom)"
        >
          <RotateCw className="w-3.5 h-3.5 text-purple-400" />
          <span>Orbit Drone</span>
        </button>

        <button
          onClick={() => setCameraMode('TOP_DOWN')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
            cameraMode === 'TOP_DOWN'
              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
          }`}
          title="Tactical Bird's-Eye 3D View"
        >
          <Navigation className="w-3.5 h-3.5 text-amber-400" />
          <span>Tactical 3D</span>
        </button>

        <div className="h-4 w-px bg-slate-700 mx-0.5" />

        {/* Lighting Atmosphere Selector */}
        <button
          onClick={() => {
            const next = lighting === 'DAY' ? 'SUNSET' : lighting === 'SUNSET' ? 'NIGHT_CYBER' : 'DAY';
            setLighting(next);
          }}
          className="flex items-center gap-1 px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700/60"
          title="Cycle Lighting Preset: Day / Sunset / Cyber Sensor"
        >
          {lighting === 'DAY' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : lighting === 'SUNSET' ? (
            <Sunset className="w-3.5 h-3.5 text-orange-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <span className="capitalize">{lighting.toLowerCase().replace('_', ' ')}</span>
        </button>
      </div>

      {/* 2. TOP-RIGHT: Sensor Perception Controls & Layer Toggles */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        {/* Toggle Sensor Perception Drawer Button */}
        <button
          onClick={() => setShowSensorSettings(!showSensorSettings)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-lg backdrop-blur-md transition-all border ${
            showSensorSettings
              ? 'bg-cyan-500 text-slate-950 border-cyan-400'
              : 'bg-slate-900/90 text-cyan-300 border-slate-700/80 hover:border-cyan-500/40'
          }`}
        >
          <Wifi className="w-3.5 h-3.5" />
          <span>LiDAR & RADAR Suite</span>
        </button>

        {/* Camera Reset */}
        <button
          onClick={() => {
            setCameraMode('CHASE');
            orbitState.current.distance = 28;
            orbitState.current.theta = -Math.PI / 4;
            orbitState.current.phi = Math.PI / 3.2;
          }}
          className="px-2.5 py-1.5 bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-xs backdrop-blur-md"
          title="Reset Camera View"
        >
          Reset
        </button>
      </div>

      {/* 3. Sensor Settings Dropdown Panel (When Opened) */}
      {showSensorSettings && (
        <div className="absolute top-14 right-3 w-80 bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl z-20 flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-white">Sensor Perception Suite</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
              32-Beam • 77GHz
            </span>
          </div>

          {/* LiDAR Controls */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-slate-300 font-semibold">
              <span className="text-cyan-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> 3D LiDAR Point Cloud
              </span>
              <input
                type="checkbox"
                checked={sensorConfig.lidarEnabled}
                onChange={e => setSensorConfig({ ...sensorConfig, lidarEnabled: e.target.checked })}
                className="rounded accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <label className="text-[10px] text-slate-400">Beam Rings</label>
                <select
                  value={sensorConfig.lidarBeams}
                  onChange={e => setSensorConfig({ ...sensorConfig, lidarBeams: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs"
                >
                  <option value={16}>16-Beam LiDAR</option>
                  <option value={32}>32-Beam LiDAR</option>
                  <option value={64}>64-Beam HD</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400">Color Gradient</label>
                <select
                  value={sensorConfig.lidarColorMode}
                  onChange={e => setSensorConfig({ ...sensorConfig, lidarColorMode: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs"
                >
                  <option value="ELEVATION">Elevation Ramp</option>
                  <option value="DISTANCE">Range / Distance</option>
                  <option value="INTENSITY">Reflectivity</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-slate-400 pt-1">
              <span>Show Rotating Laser Fan</span>
              <input
                type="checkbox"
                checked={sensorConfig.lidarShowBeams}
                onChange={e => setSensorConfig({ ...sensorConfig, lidarShowBeams: e.target.checked })}
                className="rounded accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="h-px bg-slate-800" />

          {/* RADAR Controls */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-slate-300 font-semibold">
              <span className="text-blue-400 flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5" /> 77GHz Automotive RADAR
              </span>
              <input
                type="checkbox"
                checked={sensorConfig.radarEnabled}
                onChange={e => setSensorConfig({ ...sensorConfig, radarEnabled: e.target.checked })}
                className="rounded accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span>Radar Frustum Cone (70° FOV)</span>
              <input
                type="checkbox"
                checked={sensorConfig.radarShowFrustum}
                onChange={e => setSensorConfig({ ...sensorConfig, radarShowFrustum: e.target.checked })}
                className="rounded accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span>Doppler Relative Velocity Vectors</span>
              <input
                type="checkbox"
                checked={sensorConfig.radarShowDoppler}
                onChange={e => setSensorConfig({ ...sensorConfig, radarShowDoppler: e.target.checked })}
                className="rounded accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span>3D Bounding Cuboids</span>
              <input
                type="checkbox"
                checked={sensorConfig.showBoundingBoxes3D}
                onChange={e => setSensorConfig({ ...sensorConfig, showBoundingBoxes3D: e.target.checked })}
                className="rounded accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="h-px bg-slate-800" />

          {/* Planning Layer Toggles */}
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-slate-300">Safety & Planning Overlays</span>
            <div className="flex items-center justify-between text-slate-400">
              <span>Potholes & APF Fields</span>
              <input
                type="checkbox"
                checked={layerVisibility.potholes !== false}
                onChange={() => onToggleLayer('potholes')}
                className="rounded accent-orange-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Imaginary Centerline (Edge Guard)</span>
              <input
                type="checkbox"
                checked={layerVisibility.imaginaryCenterline !== false}
                onChange={() => onToggleLayer('imaginaryCenterline')}
                className="rounded accent-cyan-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Frenet Candidate Fan</span>
              <input
                type="checkbox"
                checked={layerVisibility.frenetFan}
                onChange={() => onToggleLayer('frenetFan')}
                className="rounded accent-emerald-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>APF Force Vectors</span>
              <input
                type="checkbox"
                checked={layerVisibility.apfVectors}
                onChange={() => onToggleLayer('apfVectors')}
                className="rounded accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. BOTTOM-LEFT: Real-Time Perception Telemetry HUD */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 shadow-xl z-10 text-xs">
        {/* Active Planner Badge */}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-ping bg-cyan-400" />
          <span className="text-slate-400 font-medium">Planner:</span>
          <span
            className={`font-bold px-2 py-0.5 rounded-md ${
              engine.currentPlannerOutput?.activePlanner === 'APF'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : engine.currentPlannerOutput?.activePlanner === 'FRENET'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
            }`}
          >
            {engine.currentPlannerOutput?.activePlanner || 'SUPERVISOR'}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-700" />

        {/* 3D LiDAR Status */}
        <div className="flex items-center gap-1.5">
          <span className="text-cyan-400 font-bold">LiDAR:</span>
          <span className="font-mono text-slate-200">
            {stats ? stats.lidarPointsCount : 0} pts
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-700" />

        {/* 77GHz RADAR Status */}
        <div className="flex items-center gap-1.5">
          <span className="text-blue-400 font-bold">RADAR:</span>
          <span className="font-mono text-slate-200">
            {stats ? stats.radarTargetsCount : 0} targets
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-700" />

        {/* Potholes Status */}
        <div className="flex items-center gap-1.5">
          <span className="text-orange-400 font-bold">Potholes:</span>
          <span className="font-mono text-slate-200">
            {engine.potholes.length} craters
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-700" />

        {/* Road Edge Margin (Bushes Slip Guard) */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Edge Dist:</span>
          <span className={`font-mono font-bold ${
            metrics.edgeClearance !== undefined && metrics.edgeClearance < 1.5
              ? 'text-red-400'
              : metrics.edgeClearance !== undefined && metrics.edgeClearance < 2.5
              ? 'text-amber-400'
              : 'text-emerald-400'
          }`}>
            {metrics.edgeClearance !== undefined ? `${metrics.edgeClearance.toFixed(1)}m` : '--'}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-700" />

        {/* Closest Obstacle Range & TTC */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Closest:</span>
          <span className="font-mono font-semibold text-slate-200">
            {stats && stats.closestTargetDistance < 90 ? `${stats.closestTargetDistance.toFixed(1)}m` : '--'}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">TTC:</span>
          <span
            className={`font-mono font-bold ${
              stats && stats.closestTargetTTC < 2.5
                ? 'text-red-400 animate-pulse'
                : stats && stats.closestTargetTTC < 4.5
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}
          >
            {stats && stats.closestTargetTTC < 90 ? `${stats.closestTargetTTC.toFixed(1)}s` : 'Safe'}
          </span>
        </div>

        {/* Pothole APF Repulsion Active Badge */}
        {engine.currentPlannerOutput?.potholeRepulsionActive && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold text-[11px]">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>POTHOLE REPULSION</span>
          </div>
        )}

        {/* Unrailed Edge Slip Guard Warning Alert */}
        {engine.currentPlannerOutput?.roadEdgeWarning && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/40 font-bold animate-pulse text-[11px]">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span>UNRAILED EDGE SLIP WARNING</span>
          </div>
        )}

        {/* Critical Emergency Alert */}
        {criticalThreat && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/40 font-bold animate-pulse text-[11px]">
            <AlertTriangle className="w-3 h-3" />
            <span>CRITICAL PROXIMITY</span>
          </div>
        )}
      </div>

      {/* 5. BOTTOM-RIGHT: Spawner Notification Tooltip */}
      {selectedSpawnType && (
        <div className="absolute bottom-3 right-3 bg-cyan-950/90 border border-cyan-500/50 text-cyan-200 px-3 py-1.5 rounded-xl text-xs backdrop-blur-md shadow-lg animate-pulse flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-cyan-400" />
          <span>Click anywhere on the 3D road to spawn <strong>{selectedSpawnType.replace('_', ' ')}</strong></span>
        </div>
      )}
    </div>
  );
};
