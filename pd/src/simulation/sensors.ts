/**
 * Automotive Sensor Perception Pipeline
 * Simulates high-fidelity 3D LiDAR (32-Beam Point Cloud) and 77GHz FMCW RADAR
 * with Doppler velocity extraction, target tracking, and 3D bounding box estimation.
 */

import {
  Agent,
  BoundingBox3D,
  EgoVehicleState,
  LidarPoint,
  PerceptionState,
  Point2D,
  RadarTarget,
  Scenario,
  SensorConfig,
  TrafficAgentType
} from '../types/planner';

export class SensorPerceptionPipeline {
  private scanAngle: number = 0; // Current rotating lidar beam angle

  public update(
    ego: EgoVehicleState,
    obstacles: Agent[],
    scenario: Scenario,
    config: SensorConfig,
    dt: number = 0.05
  ): PerceptionState {
    // Advance lidar rotation (10 Hz = 20 * PI rad/s)
    this.scanAngle = (this.scanAngle + 20 * Math.PI * dt) % (Math.PI * 2);

    const lidarPoints: LidarPoint[] = [];
    const radarTargets: RadarTarget[] = [];
    const boundingBoxes3D: BoundingBox3D[] = [];

    const egoPos = { x: ego.x, y: ego.y, z: 0.8 }; // LiDAR mounted on roof (0.8m above ground)

    // ==========================================
    // 1. 3D LiDAR POINT CLOUD GENERATION
    // ==========================================
    if (config.lidarEnabled) {
      const numRings = Math.min(32, Math.max(8, config.lidarBeams || 32));
      const maxRange = config.lidarRange || 45;
      const verticalFovMin = -16 * (Math.PI / 180); // -16 deg down
      const verticalFovMax = 12 * (Math.PI / 180);  // +12 deg up
      const ringStep = (verticalFovMax - verticalFovMin) / (numRings - 1);

      // Horizontal ray resolution (sampled around 360 deg)
      const azimuthSteps = 64;
      const azimuthStep = (Math.PI * 2) / azimuthSteps;

      // Ground plane return calculation:
      // z_ray(t) = z_ego + t * sin(phi) = 0 => t_ground = -z_ego / sin(phi)
      for (let r = 0; r < numRings; r++) {
        const phi = verticalFovMin + r * ringStep;
        if (phi < -0.01) {
          // Ray points downward toward ground
          const tGround = -egoPos.z / Math.sin(phi);
          if (tGround > 1.2 && tGround < maxRange) {
            // Sample along horizontal azimuth
            for (let a = 0; a < azimuthSteps; a += 2) {
              const theta = a * azimuthStep + ego.heading;
              const gx = egoPos.x + tGround * Math.cos(phi) * Math.cos(theta);
              const gy = egoPos.y + tGround * Math.cos(phi) * Math.sin(theta);
              
              // Only include if within reasonable road corridor / vicinity
              const distFromCenter = Math.hypot(gx - ego.x, gy - ego.y);
              if (distFromCenter <= maxRange) {
                // Noise
                const noiseZ = (Math.random() - 0.5) * 0.03;
                const groundIntensity = Math.max(0.1, 0.9 - tGround / maxRange);
                lidarPoints.push({
                  x: gx,
                  y: gy,
                  z: noiseZ,
                  intensity: groundIntensity,
                  distance: tGround,
                  ring: r,
                  hitType: 'GROUND'
                });
              }
            }
          }
        }
      }

      // Obstacle 3D Point Returns
      for (const obs of obstacles) {
        const dX = obs.x - ego.x;
        const dY = obs.y - ego.y;
        const dist = Math.hypot(dX, dY);

        if (dist <= maxRange) {
          const obsHeight = this.getObstacleHeight(obs.type);
          const obsWidth = obs.width || 1.8;
          const obsLength = obs.length || 3.5;

          // Point density scales inversely with distance (closer = denser point cloud)
          const numSamplePoints = Math.max(12, Math.min(80, Math.floor(400 / (dist + 2))));

          for (let p = 0; p < numSamplePoints; p++) {
            // Sample points across obstacle cuboid perimeter and top surface
            const localU = (Math.random() - 0.5) * obsLength;
            const localV = (Math.random() - 0.5) * obsWidth;
            const localW = Math.random() * obsHeight;

            // Rotate by obstacle heading
            const cosH = Math.cos(obs.heading);
            const sinH = Math.sin(obs.heading);
            const px = obs.x + (localU * cosH - localV * sinH) + (Math.random() - 0.5) * 0.05;
            const py = obs.y + (localU * sinH + localV * cosH) + (Math.random() - 0.5) * 0.05;
            const pz = localW;

            const pointDist = Math.hypot(px - ego.x, py - ego.y, pz - egoPos.z);
            const intensity = Math.max(0.2, Math.min(1.0, 1.2 - pointDist / maxRange + (Math.random() * 0.2)));

            lidarPoints.push({
              x: px,
              y: py,
              z: pz,
              intensity,
              distance: pointDist,
              ring: Math.floor(Math.random() * numRings),
              hitType: 'OBSTACLE'
            });
          }
        }
      }

      // Roadside stalls & trees decoration returns
      if (scenario.decorations) {
        for (const dec of scenario.decorations) {
          const dist = Math.hypot(dec.x - ego.x, dec.y - ego.y);
          if (dist <= maxRange) {
            const count = Math.max(8, Math.min(30, Math.floor(180 / (dist + 2))));
            const height = dec.type === 'TREE' ? 4.5 : dec.type === 'STALL' ? 2.4 : 1.8;
            const radius = dec.type === 'TREE' ? 2.0 : 1.4;

            for (let i = 0; i < count; i++) {
              const ang = Math.random() * Math.PI * 2;
              const rad = Math.random() * radius;
              lidarPoints.push({
                x: dec.x + Math.cos(ang) * rad,
                y: dec.y + Math.sin(ang) * rad,
                z: Math.random() * height,
                intensity: 0.6 + Math.random() * 0.3,
                distance: dist,
                ring: Math.floor(Math.random() * numRings),
                hitType: 'DECORATION'
              });
            }
          }
        }
      }
    }

    // ==========================================
    // 2. 77GHz FMCW RADAR PERCEPTION
    // ==========================================
    let closestDist = Infinity;
    let closestTTC = Infinity;
    let criticalThreat = false;

    if (config.radarEnabled) {
      const radarMaxRange = config.radarRange || 85;
      const fovRad = ((config.radarFovDegrees || 70) * Math.PI) / 180;
      const halfFov = fovRad / 2;

      // Ego velocity vector
      const egoVx = ego.speed * Math.cos(ego.heading);
      const egoVy = ego.speed * Math.sin(ego.heading);

      for (const obs of obstacles) {
        const dx = obs.x - ego.x;
        const dy = obs.y - ego.y;
        const range = Math.hypot(dx, dy);

        if (range <= radarMaxRange && range > 0.5) {
          // Angle of obstacle in world frame
          const worldAngle = Math.atan2(dy, dx);
          // Angle relative to ego heading (azimuth)
          let azimuth = worldAngle - ego.heading;
          // Normalize to [-PI, PI]
          while (azimuth > Math.PI) azimuth -= 2 * Math.PI;
          while (azimuth < -Math.PI) azimuth += 2 * Math.PI;

          // Check if obstacle is inside forward radar field of view
          if (Math.abs(azimuth) <= halfFov) {
            // Unit vector from ego to obstacle
            const uX = dx / range;
            const uY = dy / range;

            // Relative velocity vector: v_rel = v_obs - v_ego
            const relVx = obs.vx - egoVx;
            const relVy = obs.vy - egoVy;

            // Radial velocity (Doppler return): dot product with line-of-sight unit vector
            // Negative = closing/approaching ego, Positive = opening/moving away
            const radialVelocity = relVx * uX + relVy * uY;

            // Radar Cross Section (RCS) in dBsm
            const rcs = this.getObstacleRCS(obs.type);

            // Time To Collision (TTC) calculation
            let ttc = Infinity;
            if (radialVelocity < -0.15) {
              ttc = range / Math.abs(radialVelocity);
            }

            // Threat level assessment
            let threatLevel: 'SAFE' | 'CAUTION' | 'CRITICAL' = 'SAFE';
            if (range < 7.0 || (ttc < 2.2 && range < 20.0)) {
              threatLevel = 'CRITICAL';
              criticalThreat = true;
            } else if (range < 14.0 || (ttc < 4.2 && range < 35.0)) {
              threatLevel = 'CAUTION';
            }

            if (range < closestDist) {
              closestDist = range;
            }
            if (ttc < closestTTC) {
              closestTTC = ttc;
            }

            radarTargets.push({
              id: obs.id,
              x: obs.x,
              y: obs.y,
              z: 0.5,
              range,
              azimuth,
              radialVelocity,
              rcs,
              ttc: isFinite(ttc) ? ttc : 99.9,
              label: obs.label,
              type: obs.type,
              threatLevel
            });
          }
        }
      }
    }

    // ==========================================
    // 3. 3D BOUNDING BOX ESTIMATION (CUBOIDS)
    // ==========================================
    for (const obs of obstacles) {
      const dist = Math.hypot(obs.x - ego.x, obs.y - ego.y);
      if (dist <= 65) {
        const height = this.getObstacleHeight(obs.type);
        const matchedRadar = radarTargets.find(r => r.id === obs.id);

        boundingBoxes3D.push({
          id: obs.id,
          type: obs.type,
          x: obs.x,
          y: obs.y,
          z: height / 2,
          width: obs.width || 1.8,
          length: obs.length || 3.8,
          height,
          heading: obs.heading,
          confidence: Math.min(0.99, Math.max(0.72, 1.0 - dist / 80)),
          label: obs.label,
          ttc: matchedRadar?.ttc
        });
      }
    }

    return {
      lidarPoints,
      radarTargets,
      boundingBoxes3D,
      sensorStats: {
        lidarPointsCount: lidarPoints.length,
        radarTargetsCount: radarTargets.length,
        lidarHz: 20,
        radarHz: 40,
        closestTargetDistance: isFinite(closestDist) ? closestDist : 0,
        closestTargetTTC: isFinite(closestTTC) ? closestTTC : 99.9,
        emergencyBrakeRequired: criticalThreat
      }
    };
  }

  private getObstacleHeight(type: TrafficAgentType): number {
    switch (type) {
      case 'TRUCK':
        return 3.2;
      case 'CAR':
        return 1.5;
      case 'AUTO_RICKSHAW':
        return 1.8;
      case 'TWO_WHEELER':
        return 1.4;
      case 'CATTLE':
        return 1.4;
      case 'PEDESTRIAN':
        return 1.75;
      default:
        return 1.5;
    }
  }

  private getObstacleRCS(type: TrafficAgentType): number {
    switch (type) {
      case 'TRUCK':
        return 18.5; // High metal reflective cross section
      case 'CAR':
        return 10.4;
      case 'AUTO_RICKSHAW':
        return 6.5;
      case 'TWO_WHEELER':
        return 3.8;
      case 'CATTLE':
        return 4.2;
      case 'PEDESTRIAN':
        return -2.4; // Very low dielectric absorption
      default:
        return 5.0;
    }
  }
}
