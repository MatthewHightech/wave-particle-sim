@group(0) @binding(0) var<uniform> params: PbfUniforms;
@group(0) @binding(1) var<storage, read_write> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> predicted: array<vec2f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.numParticles) {
    return;
  }

  let hit = apply_boundaries(
    pos[i],
    vel[i],
    params.leftWallX,
    0.0,
    params.pistonTipY,
    params.pistonTipOffsetX,
    params.pivotFloorX,
    vec2f(params.midFloorX, params.midFloorY),
    params.rightFloorY
  );
  pos[i] = hit.xy;
  vel[i] = hit.zw;
  predicted[i] = hit.xy;
}
