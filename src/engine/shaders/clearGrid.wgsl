@group(0) @binding(0) var<storage, read_write> grid: array<GridNode>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let idx = id.x;
  if (idx >= arrayLength(&grid)) { return; }

  atomicStore(&grid[idx].vx, 0);
  atomicStore(&grid[idx].vy, 0);
  atomicStore(&grid[idx].mass, 0);
}