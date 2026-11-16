@group(0) @binding(0) var<uniform> params: PhysicsUniforms;
@group(0) @binding(1) var<storage, read_write> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> cMatrix: array<mat2x2f>;
@group(0) @binding(4) var<storage, read_write> jBuffer: array<f32>;
@group(0) @binding(5) var<storage, read_write> grid: array<GridNode>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let p = id.x;
  if (p >= arrayLength(&pos)) { return; }

  let x = pos[p];
  let cellIdx = vec2i(floor(x - 0.5));
  let fx = x - vec2f(cellIdx);

  let w = array<vec2f, 3>(
    0.5 * (1.5 - fx) * (1.5 - fx),
    0.75 - (fx - 1.0) * (fx - 1.0),
    0.5 * (fx - 0.5) * (fx - 0.5)
  );

  var newVel = vec2f(0.0);
  var newC = mat2x2f(0.0, 0.0, 0.0, 0.0);
  var localMass = 0.0;

  for (var gx = 0; gx < 3; gx++) {
    for (var gy = 0; gy < 3; gy++) {
      let nodeCoord = cellIdx + vec2i(gx, gy);
      if (nodeCoord.x < 0 || nodeCoord.x >= GRID_WIDTH || nodeCoord.y < 0 || nodeCoord.y >= GRID_HEIGHT) {
        continue;
      }

      let weight = w[gx].x * w[gy].y;
      let dpos = vec2f(vec2i(gx, gy)) - fx;
      let flatIdx = u32(nodeCoord.y * GRID_WIDTH + nodeCoord.x);

      let gridVel = vec2f(
        f32(atomicLoad(&grid[flatIdx].vx)),
        f32(atomicLoad(&grid[flatIdx].vy))
      ) / FIXED_POINT;

      // Read actual local mass density from the grid
      let nodeMass = f32(atomicLoad(&grid[flatIdx].mass)) / FIXED_POINT;
      localMass += weight * nodeMass;

      newVel += weight * gridVel;
      newC += 4.0 * weight * mat2x2f(
        gridVel.x * dpos.x, gridVel.y * dpos.x,
        gridVel.x * dpos.y, gridVel.y * dpos.y
      );
    }
  }

  newVel = mix(newVel, vel[p] * 0.9, 0.05);
  var newPos = x + newVel * params.dt;

  // Keep particles 0.5 cells inside the outermost active grid nodes (3 and GRID_WIDTH - 4)
  // so their 3x3 stencils never split across zero-velocity wall nodes
  let minBound = 3.5;
  let maxBoundX = f32(GRID_WIDTH) - 4.5; // 59.5 (symmetric with 3.5 around [3..60])
  let maxBoundY = f32(GRID_HEIGHT) - 4.5;

  if (newPos.x < minBound) {
    newPos.x = minBound;
    if (newVel.x < 0.0) { newVel.x = 0.0; }
    newC[0][0] = 0.0;
    newC[1][0] = 0.0;
  } else if (newPos.x > maxBoundX) {
    newPos.x = maxBoundX;
    if (newVel.x > 0.0) { newVel.x = 0.0; }
    newC[0][0] = 0.0;
    newC[1][0] = 0.0;
  }

  if (newPos.y < minBound) {
    newPos.y = minBound;
    if (newVel.y < 0.0) { newVel.y = 0.0; }
    newC[0][1] = 0.0;
    newC[1][1] = 0.0;
  } else if (newPos.y > maxBoundY) {
    newPos.y = maxBoundY;
    if (newVel.y > 0.0) { newVel.y = 0.0; }
    newC[0][1] = 0.0;
    newC[1][1] = 0.0;
  }

  let traceC = newC[0][0] + newC[1][1];
  // Prevent artificial volume expansion (advectedJ > 1.0) caused by wall-stencil shear
  let clampedTrace = min(traceC, 0.2);
  let advectedJ = jBuffer[p] * (1.0 + params.dt * clampedTrace);

  var targetJ = advectedJ;
  if (localMass > 0.85) {
    let gridBasedJ = 1.0 / localMass;
    targetJ = mix(advectedJ, gridBasedJ, 0.05);
  } else {
    // Near free surfaces and walls, gently relax J back toward 1.0 instead of letting it stay inflated
    targetJ = mix(advectedJ, 1.0, 0.02);
  }

  let newJ = clamp(targetJ, 0.7, 1.05);

  pos[p] = newPos;
  vel[p] = newVel;
  cMatrix[p] = newC * 0.985; // Physical shear damping stops spurious vortex spin-up
  jBuffer[p] = newJ;
}