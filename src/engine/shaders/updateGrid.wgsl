@group(0) @binding(0) var<uniform> params: PhysicsUniforms;
@group(0) @binding(1) var<storage, read_write> grid: array<GridNode>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let idx = id.x;
  if (idx >= arrayLength(&grid)) { return; }

  let rawMass = atomicLoad(&grid[idx].mass);
  if (rawMass <= 0) { return; }

  let mass = f32(rawMass) / FIXED_POINT;
  var v = vec2f(
    f32(atomicLoad(&grid[idx].vx)) / FIXED_POINT,
    f32(atomicLoad(&grid[idx].vy)) / FIXED_POINT
  ) / mass;

  // Apply gravity & slight velocity damping
  v.y += params.gravity * params.dt;
  v *= (1.0 - params.viscosity * params.dt);

  // Enforce box boundaries (2-cell border)
  let x = i32(idx) % GRID_WIDTH;
  let y = i32(idx) / GRID_WIDTH;

  if (x < 2 && v.x < 0.0) { v.x = 0.0; }
  if (x > GRID_WIDTH - 3 && v.x > 0.0) { v.x = 0.0; }
  if (y < 2 && v.y < 0.0) { v.y = 0.0; }
  if (y > GRID_HEIGHT - 3 && v.y > 0.0) { v.y = 0.0; }

  atomicStore(&grid[idx].vx, i32(v.x * FIXED_POINT));
  atomicStore(&grid[idx].vy, i32(v.y * FIXED_POINT));
}