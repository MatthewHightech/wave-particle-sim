@group(0) @binding(0) var<storage, read_write> cellCounts: array<atomic<u32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let idx = id.x;
  if (idx >= arrayLength(&cellCounts)) { return; }
  atomicStore(&cellCounts[idx], 0u);
}
