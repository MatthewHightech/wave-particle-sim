@group(0) @binding(0) var<uniform> params: PbfUniforms;
@group(0) @binding(1) var<storage, read_write> predicted: array<vec2f>;
@group(0) @binding(2) var<storage, read> deltaPos: array<vec2f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.numParticles) { return; }

  let moved = predicted[i] + deltaPos[i];
  predicted[i] = clamp_to_domain(
    moved,
    params.leftWallX,
    params.pistonTipY,
    params.pistonTipOffsetX,
    params.pivotFloorX,
    vec2f(params.midFloorX, params.midFloorY),
    params.rightFloorY
  );
}
