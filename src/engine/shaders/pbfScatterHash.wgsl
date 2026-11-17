@group(0) @binding(0) var<uniform> params: PbfUniforms;
@group(0) @binding(1) var<storage, read> predicted: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> cellCounts: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read> cellStarts: array<u32>;
@group(0) @binding(4) var<storage, read_write> cellParticles: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.numTotal) { return; }

  let cIdx = cell_index(cell_coord(predicted[i]));
  let slot = atomicAdd(&cellCounts[cIdx], 1u);
  cellParticles[cellStarts[cIdx] + slot] = i;
}
