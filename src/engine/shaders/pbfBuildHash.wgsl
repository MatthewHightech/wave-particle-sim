@group(0) @binding(0) var<uniform> params: PbfUniforms;
@group(0) @binding(1) var<storage, read> predicted: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> cellCounts: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> cellParticles: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.numParticles) { return; }

  let c = cell_coord(predicted[i]);
  let cIdx = cell_index(c);
  let slot = atomicAdd(&cellCounts[cIdx], 1u);
  if (slot < u32(MAX_PER_CELL)) {
    cellParticles[cIdx * u32(MAX_PER_CELL) + slot] = i;
  }
}
