@group(0) @binding(0) var<storage, read_write> cellCounts: array<atomic<u32>>;
@group(0) @binding(1) var<storage, read_write> cellStarts: array<u32>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x != 0u) { return; }

  let cellCount = arrayLength(&cellStarts);
  var sum = 0u;
  for (var i = 0u; i < cellCount; i++) {
    let count = atomicLoad(&cellCounts[i]);
    cellStarts[i] = sum;
    sum += count;
    atomicStore(&cellCounts[i], 0u);
  }
}
