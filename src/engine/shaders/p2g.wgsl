@group(0) @binding(0) var<uniform> params: PhysicsUniforms;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read> cMatrix: array<mat2x2f>;
@group(0) @binding(4) var<storage, read> jBuffer: array<f32>;
@group(0) @binding(5) var<storage, read_write> grid: array<GridNode>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let p = id.x;
  if (p >= arrayLength(&pos)) { return; }

  let x = pos[p];
  let v = vel[p];
  let C = cMatrix[p];
  let J = jBuffer[p];

  let cellIdx = vec2i(floor(x - 0.5));
  let fx = x - vec2f(cellIdx);

  // Quadratic B-spline interpolation weights
  let w = array<vec2f, 3>(
    0.5 * (1.5 - fx) * (1.5 - fx),
    0.75 - (fx - 1.0) * (fx - 1.0),
    0.5 * (fx - 0.5) * (fx - 0.5)
  );

  // Weakly compressible fluid equation of state (clamp negative pressure to avoid clumping)
  let pressure = max(-0.2, params.stiffness * (1.0 - J));
  let stress = mat2x2f(-pressure, 0.0, 0.0, -pressure);

  // Fused MLS-MPM stress + affine momentum matrix
  let affine = (-4.0 * params.dt * stress) + C;

  for (var gx = 0; gx < 3; gx++) {
    for (var gy = 0; gy < 3; gy++) {
      let nodeCoord = cellIdx + vec2i(gx, gy);
      if (nodeCoord.x < 0 || nodeCoord.x >= GRID_WIDTH || nodeCoord.y < 0 || nodeCoord.y >= GRID_HEIGHT) {
        continue;
      }

      let weight = w[gx].x * w[gy].y;
      let dpos = vec2f(vec2i(gx, gy)) - fx;
      let momentum = weight * (v + affine * dpos);

      let flatIdx = u32(nodeCoord.y * GRID_WIDTH + nodeCoord.x);
      atomicAdd(&grid[flatIdx].vx, i32(momentum.x * FIXED_POINT));
      atomicAdd(&grid[flatIdx].vy, i32(momentum.y * FIXED_POINT));
      atomicAdd(&grid[flatIdx].mass, i32(weight * FIXED_POINT));
    }
  }
}