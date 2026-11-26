@group(0) @binding(0) var<uniform> params: PbfUniforms;
@group(0) @binding(1) var<storage, read_write> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read> predicted: array<vec2f>;
@group(0) @binding(4) var<storage, read> cellStarts: array<u32>;
@group(0) @binding(5) var<storage, read> cellParticles: array<u32>;
@group(0) @binding(6) var<storage, read> sortedPredicted: array<vec2f>;
@group(0) @binding(7) var<storage, read> boundaryVel: array<vec2f>;
@group(0) @binding(8) var<storage, read_write> foam: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.numParticles) { return; }

  let invDt = 1.0 / max(params.dt, 1e-8);
  var newPos = predicted[i];
  var newVel = (newPos - pos[i]) * invDt;

  let ci = cell_coord(newPos);
  var xsph = vec2f(0.0);
  var visc = vec2f(0.0);
  var wSum = 0.0;
  var maxClosing = 0.0;

  for (var oy = -1; oy <= 1; oy++) {
    let row = neighbor_row_range(ci, oy);
    if (row.x >= row.y) { continue; }

    let start = cellStarts[row.x];
    let end = cellStarts[row.y];
    for (var slot = start; slot < end; slot++) {
      let j = cellParticles[slot];
      if (j == i) { continue; }

      let r = newPos - sortedPredicted[slot];
      let r2 = dot(r, r);
      if (r2 >= H2) { continue; }

      let a = H2 - r2;
      let w = POLY6_COEF * a * a * a;

      var vj = vec2f(0.0);
      if (j < params.numParticles) {
        vj = (sortedPredicted[slot] - pos[j]) * invDt;
      } else {
        vj = boundaryVel[j - params.numParticles];
      }

      let vji = vj - newVel;
      xsph += vji * w;
      wSum += w;

      let rLen = sqrt(r2);
      if (rLen > 1e-6) {
        let rHat = r / rLen;
        let closing = dot(vji, r);
        if (closing < 0.0) {
          visc += (closing / rLen) * rHat * w;
        }

        let approach = -min(dot(newVel - vj, rHat), 0.0);
        if (j < params.numParticles) {
          maxClosing = max(maxClosing, approach);
        } else {
          maxClosing = max(maxClosing, approach * 0.6);
        }
      }
    }
  }

  if (wSum > 1e-8) {
    newVel += XSPH * (xsph / wSum);
    newVel += VISCOSITY * (visc / wSum);
  }

  newVel *= max(0.0, 1.0 - VELOCITY_DAMPING * params.dt);

  let preBoundaryVel = newVel;
  let collided = apply_boundaries(
    newPos,
    newVel,
    params.leftWallX,
    params.leftWallVx,
    params.pistonTipY,
    params.pistonTipOffsetX,
    params.pivotFloorX,
    vec2f(params.midFloorX, params.midFloorY),
    params.rightFloorY
  );

  pos[i] = collided.xy;
  vel[i] = collided.zw;

  let wallImpact = length(preBoundaryVel - collided.zw) * 0.65;
  let impact = max(maxClosing, wallImpact);
  let impactFoam = smoothstep(
    params.foamImpactStart,
    params.foamImpactFull,
    impact
  );
  let speed = length(collided.zw);
  let spray = max(collided.w, 0.0);
  let motionFoam = smoothstep(
    params.foamMotionStart,
    params.foamMotionFull,
    speed
  );
  let sprayFoam = smoothstep(
    params.foamMotionStart * 0.55,
    params.foamMotionFull * 0.85,
    spray
  );
  let targetFoam = clamp(
    impactFoam * 0.8 + motionFoam * 0.35 + sprayFoam * 0.25,
    0.0,
    1.0
  );
  let decay = exp(-params.dt / max(FOAM_LIFETIME, 1e-3));
  foam[i] = clamp(max(targetFoam, foam[i] * decay), 0.0, 1.0);
}
