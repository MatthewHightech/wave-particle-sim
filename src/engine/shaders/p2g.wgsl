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

  let pMass = 0.25;
  let pVol = 0.25;

  // Tait's Equation of State for nearly incompressible water (gamma = 7)
  let jClamped = clamp(J, 0.5, 1.2);
  let jPow = pow(jClamped, 7.0);
  let divV = C[0][0] + C[1][1];
  let bulkViscosity = 0.5;
  // Strictly non-negative pressure eliminates tensile wall-crawling
  let pressure = max(0.0, params.stiffness * (1.0 / jPow - 1.0) - bulkViscosity * divV);
  let stress = mat2x2f(-pressure, 0.0, 0.0, -pressure);

  // Multiply stress by particle volume (pVol), and momentum by particle mass (pMass)
  let affine = (-4.0 * params.dt * pVol * stress) + pMass * C;

  for (var gx = 0; gx < 3; gx++) {
    for (var gy = 0; gy < 3; gy++) {
      let nodeCoord = cellIdx + vec2i(gx, gy);
      if (nodeCoord.x < 0 || nodeCoord.x >= GRID_WIDTH || nodeCoord.y < 0 || nodeCoord.y >= GRID_HEIGHT) {
        continue;
      }

      let weight = w[gx].x * w[gy].y;
      let dpos = vec2f(vec2i(gx, gy)) - fx;
      let momentum = weight * (pMass * v + affine * dpos);

      let flatIdx = u32(nodeCoord.y * GRID_WIDTH + nodeCoord.x);
      atomicAdd(&grid[flatIdx].vx, i32(round(momentum.x * FIXED_POINT)));
      atomicAdd(&grid[flatIdx].vy, i32(round(momentum.y * FIXED_POINT)));
      atomicAdd(&grid[flatIdx].mass, i32(round(weight * pMass * FIXED_POINT)));
    }
  }
}