/**
 * Scenario -> MATLAB/Simulink handoff.
 *
 * Serialises a Scenario into the flat JSON contract consumed by the MATLAB side
 * (see matlab/civic_eye_replay_logger.m). Deliberately plain data: no classes,
 * no undefined fields, so jsondecode() in MATLAB yields clean structs.
 */

import { Agent, Pothole, Scenario } from '../types/planner';

export interface ExportedScenario {
  schema: string;
  id: string;
  title: string;
  category: string;
  roadWidth: number;
  centerlineWaypoints: { x: number; y: number }[];
  egoStart: {
    x: number;
    y: number;
    heading: number;
    speed: number;
    width: number;
    length: number;
    wheelbase: number;
    radius: number;
  };
  egoGoal: { x: number; y: number };
  potholes: { id: string; x: number; y: number; radius: number; severity: string }[];
  agents: {
    id: string;
    type: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    heading: number;
    speed: number;
    targetSpeed: number;
    radius: number;
    width: number;
    length: number;
    behavior: string;
    pathWaypoints: { x: number; y: number }[];
  }[];
  intersectionZone?: {
    conflictPolygon: { x: number; y: number }[];
    entryLine: { x: number; y: number }[];
  };
}

const round = (n: number, dp: number = 4): number => {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

export function buildExportedScenario(
  scenario: Scenario,
  potholes: Pothole[],
  agents: Agent[]
): ExportedScenario {
  const out: ExportedScenario = {
    schema: 'civic-eye/scenario@1',
    id: scenario.id,
    title: scenario.title,
    category: String(scenario.category),
    roadWidth: scenario.roadWidth || 14,
    centerlineWaypoints: (scenario.centerlineWaypoints || []).map(p => ({
      x: round(p.x),
      y: round(p.y)
    })),
    egoStart: {
      x: round(scenario.egoStart.x),
      y: round(scenario.egoStart.y),
      heading: round(scenario.egoStart.heading, 6),
      speed: round(scenario.egoStart.speed),
      width: round(scenario.egoStart.width),
      length: round(scenario.egoStart.length),
      wheelbase: round(scenario.egoStart.wheelbase || 2.7),
      radius: round(scenario.egoStart.radius)
    },
    egoGoal: { x: round(scenario.egoGoal.x), y: round(scenario.egoGoal.y) },
    potholes: potholes.map(p => ({
      id: p.id,
      x: round(p.x),
      y: round(p.y),
      radius: round(p.radius),
      severity: p.severity || 'MODERATE'
    })),
    agents: agents.map(a => ({
      id: a.id,
      type: a.type,
      x: round(a.x),
      y: round(a.y),
      vx: round(a.vx),
      vy: round(a.vy),
      heading: round(a.heading, 6),
      speed: round(a.speed),
      targetSpeed: round(a.targetSpeed),
      radius: round(a.radius),
      width: round(a.width),
      length: round(a.length),
      behavior: a.behavior || 'LANE_FOLLOWING',
      pathWaypoints: (a.pathWaypoints || []).map(p => ({ x: round(p.x), y: round(p.y) }))
    }))
  };

  if (scenario.intersectionZone) {
    out.intersectionZone = {
      conflictPolygon: (scenario.intersectionZone.conflictPolygon || []).map(p => ({
        x: round(p.x),
        y: round(p.y)
      })),
      entryLine: (scenario.intersectionZone.entryLine || []).map(p => ({
        x: round(p.x),
        y: round(p.y)
      }))
    };
  }

  return out;
}

export function scenarioToJsonString(
  scenario: Scenario,
  potholes: Pothole[],
  agents: Agent[]
): string {
  return JSON.stringify(buildExportedScenario(scenario, potholes, agents), null, 2);
}

/** Triggers a browser download of the scenario JSON. */
export function downloadScenarioJson(
  scenario: Scenario,
  potholes: Pothole[],
  agents: Agent[]
): string {
  const json = scenarioToJsonString(scenario, potholes, agents);
  const filename = `${scenario.id}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}
