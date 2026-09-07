# MATLAB / Simulink handoff

Model-in-the-loop workflow. Planning, decision logic and vehicle motion execute
in MATLAB/Simulink; the browser app authors the scenario and visualises the result.

## Loop

1. In the app, select planner mode **MATLAB / Simulink**, then **Export Scenario JSON**.
   You get `<scenario-id>.json`.
2. Upload that file and `civic_eye_run.m` to MATLAB Drive.
3. In MATLAB Online: `civic_eye_run('village-2-cattle-bypass.json')`
   It writes `village-2-cattle-bypass.csv`.
4. Download the CSV, then **Load Trajectory CSV** in the app and press play.
   The vehicle now follows the trajectory the MATLAB model produced. Collision
   checks, pothole impacts, clearance, smoothness and latency are all scored
   against that trajectory.

## CSV contract

    t, x, y, heading, speed, accel, steer, curvature, active_planner, latency_ms

Only `t, x, y, heading` are required; the rest default sensibly. Column order
does not matter and common aliases (`time`, `yaw`, `v`, `kappa`) are accepted.

## Swapping in sarathi_hybrid.slx

`civic_eye_run.m` currently uses a plain pure-pursuit controller inside the
block marked `CONTROLLER`. Replace that block with a step of your Simulink
model and keep the logging below it unchanged:

    set_param('sarathi_hybrid/EgoPose', 'Value', mat2str([ego.x ego.y ego.heading]));
    simOut = sim('sarathi_hybrid', 'StopTime', num2str(dt));
    steer  = simOut.steer_cmd(end);
    accel  = simOut.accel_cmd(end);

Everything else — JSON loading, traffic propagation, CSV writing — stays as is.
