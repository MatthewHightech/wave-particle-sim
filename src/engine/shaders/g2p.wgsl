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

      newVel += weight * gridVel;
      newC += 4.0 * weight * mat2x2f(
        gridVel.x * dpos.x, gridVel.y * dpos.x,
        gridVel.x * dpos.y, gridVel.y * dpos.y
      );
    }
  }

  var newPos = x + newVel * params.dt;
  newPos = clamp(
    newPos,
    vec2f(2.001, 2.001),
    vec2f(f32(GRID_WIDTH) - 3.001, f32(GRID_HEIGHT) - 3.001)
  );

  let traceC = newC[0][0] + newC[1][1];
  let newJ = clamp(jBuffer[p] * (1.0 + params.dt * traceC), 0.6, 1.4);

  pos[p] = newPos;
  vel[p] = newVel;
  cMatrix[p] = newC;
  jBuffer[p] = newJ;
}