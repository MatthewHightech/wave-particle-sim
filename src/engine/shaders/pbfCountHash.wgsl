@group(0) @binding(0) var<uniform> params: PbfUniforms;
@group(0) @binding(1) var<storage, read> predicted: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> cellCounts: array<atomic<u32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.numTotal) { return; }

  let cIdx = cell_index(cell_coord(predicted[i]));
  atomicAdd(&cellCounts[cIdx], 1u);
}
