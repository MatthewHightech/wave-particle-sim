@group(0) @binding(0) var<uniform> params: PbfUniforms;
@group(0) @binding(1) var<storage, read> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> predicted: array<vec2f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.numParticles) { return; }

  var v = vel[i];
  v.y += params.gravity * params.dt;

  var predictedPos = pos[i] + v * params.dt;
  let collided = apply_boundaries(
    predictedPos,
    v,
    params.leftWallX,
    params.leftWallVx,
    params.pivotFloorX,
    vec2f(params.midFloorX, params.midFloorY),
    params.rightFloorY
  );

  predicted[i] = collided.xy;
  vel[i] = collided.zw;
}
