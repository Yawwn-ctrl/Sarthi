function civic_eye_run(scenarioFile, outFile)
% CIVIC_EYE_RUN  Closed-loop run of a Civic Eye scenario in MATLAB/Simulink.
%
%   civic_eye_run('village-2-cattle-bypass.json', 'village-2-cattle-bypass.csv')
%
% Reads a scenario exported from the Civic Eye frontend, runs a closed-loop
% simulation of the kinematic bicycle model under a pure-pursuit + obstacle
% avoidance controller, and writes the 10-column trajectory CSV that the
% frontend imports for replay.
%
% Requires only base MATLAB -- no toolboxes -- so it runs on MATLAB Online (basic).
% Replace the CONTROLLER section with a call to your Simulink model when ready:
%   simOut = sim('sarathi_hybrid', 'StopTime', '0.05');
%
% CSV contract:
%   t, x, y, heading, speed, accel, steer, curvature, active_planner, latency_ms

if nargin < 1 || isempty(scenarioFile)
    error('civic_eye_run:noScenario', 'Pass the exported scenario JSON path.');
end
if nargin < 2 || isempty(outFile)
    [~, base, ~] = fileparts(scenarioFile);
    outFile = [base '.csv'];
end

%% ---------------------------------------------------------------- LOAD
raw = fileread(scenarioFile);
S   = jsondecode(raw);

fprintf('Scenario: %s (%s)\n', S.title, S.id);

ego.x        = S.egoStart.x;
ego.y        = S.egoStart.y;
ego.heading  = S.egoStart.heading;
ego.speed    = S.egoStart.speed;
ego.wheelbase= S.egoStart.wheelbase;

goal      = [S.egoGoal.x, S.egoGoal.y];
roadWidth = S.roadWidth;

% Centerline as an Nx2 array
cl = zeros(numel(S.centerlineWaypoints), 2);
for i = 1:numel(S.centerlineWaypoints)
    cl(i,:) = [S.centerlineWaypoints(i).x, S.centerlineWaypoints(i).y];
end

% Agents and potholes as plain arrays (empty-safe)
nA = numel(S.agents);
agents = zeros(nA, 5);   % [x y vx vy radius]
for i = 1:nA
    a = S.agents(i);
    agents(i,:) = [a.x, a.y, a.vx, a.vy, a.radius];
end

nP = numel(S.potholes);
pots = zeros(nP, 3);     % [x y radius]
for i = 1:nP
    p = S.potholes(i);
    pots(i,:) = [p.x, p.y, p.radius];
end

%% ------------------------------------------------------------ SIM SETUP
dt       = 0.05;
maxTime  = 120;
nSteps   = floor(maxTime / dt);

L         = ego.wheelbase;
maxSteer  = 0.6;          % rad
maxAccel  = 3.5;          % m/s^2
maxSpeed  = 12.0;         % m/s
lookahead = 8.0;          % m, pure-pursuit

log = zeros(nSteps, 8);   % t x y heading speed accel steer curvature
mode = strings(nSteps, 1);
lat  = zeros(nSteps, 1);
k = 0;

%% ------------------------------------------------------------ MAIN LOOP
for step = 1:nSteps
    t = (step-1) * dt;
    tic;   % planner latency measurement starts

    % --- propagate traffic (constant velocity) --------------------------
    agents(:,1) = agents(:,1) + agents(:,3) * dt;
    agents(:,2) = agents(:,2) + agents(:,4) * dt;

    % ===================== CONTROLLER =====================
    % Replace this block with your Simulink model call when sarathi_hybrid.slx
    % is ready. Everything above and below stays the same.

    % 1. Lateral: pure pursuit toward a lookahead point on the centerline
    tgt = local_lookahead(cl, [ego.x ego.y], lookahead, goal);

    % 2. Lateral correction: repulsion from nearby agents and potholes
    lateralPush = 0;
    for i = 1:size(agents,1)
        d = hypot(agents(i,1)-ego.x, agents(i,2)-ego.y);
        if d < 12.0 && agents(i,1) > ego.x - 2
            side = sign(ego.y - agents(i,2));
            if side == 0, side = 1; end
            lateralPush = lateralPush + side * (12.0 - d) * 0.28;
        end
    end
    for i = 1:size(pots,1)
        d = hypot(pots(i,1)-ego.x, pots(i,2)-ego.y);
        if d < 8.0 && pots(i,1) > ego.x - 1
            side = sign(ego.y - pots(i,2));
            if side == 0, side = 1; end
            lateralPush = lateralPush + side * (8.0 - d) * 0.35;
        end
    end

    halfRoad = roadWidth/2 - 1.0;
    tgt(2) = max(-halfRoad, min(halfRoad, tgt(2) + lateralPush));

    % 3. Steering from heading error
    desiredHeading = atan2(tgt(2)-ego.y, tgt(1)-ego.x);
    headErr = local_wrap(desiredHeading - ego.heading);
    steer = max(-maxSteer, min(maxSteer, 1.4 * headErr));

    % 4. Longitudinal: slow for close obstacles, otherwise track target speed
    minAhead = inf;
    for i = 1:size(agents,1)
        dx = agents(i,1) - ego.x;
        dy = agents(i,2) - ego.y;
        if dx > 0 && abs(dy) < 2.6
            minAhead = min(minAhead, dx);
        end
    end
    if minAhead < 8.0
        targetSpeed = max(0, maxSpeed * (minAhead / 8.0) * 0.5);
    else
        targetSpeed = maxSpeed * 0.65;
    end
    accel = max(-maxAccel, min(maxAccel, 1.2 * (targetSpeed - ego.speed)));
    % ==================== END CONTROLLER ====================

    latencyMs = toc * 1000;

    % --- kinematic bicycle model integration ----------------------------
    ego.speed   = max(0, ego.speed + accel * dt);
    yawRate     = (ego.speed / L) * tan(steer);
    ego.heading = local_wrap(ego.heading + yawRate * dt);
    ego.x       = ego.x + ego.speed * cos(ego.heading) * dt;
    ego.y       = ego.y + ego.speed * sin(ego.heading) * dt;
    curvature   = tan(steer) / L;

    % --- log -------------------------------------------------------------
    k = k + 1;
    log(k,:) = [t, ego.x, ego.y, ego.heading, ego.speed, accel, steer, curvature];
    mode(k)  = "SIMULINK_BICYCLE";
    lat(k)   = latencyMs;

    % --- termination -----------------------------------------------------
    if hypot(goal(1)-ego.x, goal(2)-ego.y) < 2.5
        fprintf('Goal reached at t = %.2f s\n', t);
        break;
    end
end

log  = log(1:k,:);
mode = mode(1:k);
lat  = lat(1:k);

%% ---------------------------------------------------------------- WRITE
T = table(log(:,1), log(:,2), log(:,3), log(:,4), log(:,5), ...
          log(:,6), log(:,7), log(:,8), mode, lat, ...
    'VariableNames', {'t','x','y','heading','speed','accel', ...
                      'steer','curvature','active_planner','latency_ms'});

writetable(T, outFile);
fprintf('Wrote %d steps to %s\n', k, outFile);
fprintf('Mean planner latency: %.3f ms\n', mean(lat));
end

%% ------------------------------------------------------------- HELPERS
function p = local_lookahead(cl, pos, Ld, goal)
% Nearest centerline point ahead of pos by roughly Ld metres.
if isempty(cl)
    p = goal;
    return;
end
d = hypot(cl(:,1)-pos(1), cl(:,2)-pos(2));
[~, idx] = min(d);
j = idx;
acc = 0;
while j < size(cl,1) && acc < Ld
    acc = acc + hypot(cl(j+1,1)-cl(j,1), cl(j+1,2)-cl(j,2));
    j = j + 1;
end
p = cl(j,:);
if j >= size(cl,1)
    p = goal;
end
end

function a = local_wrap(a)
while a >  pi, a = a - 2*pi; end
while a < -pi, a = a + 2*pi; end
end
