struct PistonUniforms {
  gridSize: vec2f,
  viewScale: vec2f,
  viewOffset: vec2f,
  wallX: f32,
  beamWidth: f32,
  yBottom: f32,
  yMin: f32,
  yMax: f32,
  tipY: f32,
  tipOffsetX: f32,
  rodHeight: f32,
};

@group(0) @binding(0) var<uniform> uniforms: PistonUniforms;

struct VertexOutput {
  @builtin(position) clipPos: vec4f,
  @location(0) uv: vec2f,
  @location(1) part: f32,
};

fn world_to_clip(worldPos: vec2f) -> vec4f {
  let ndc = world_to_ndc(worldPos, uniforms.viewScale, uniforms.viewOffset);
  return vec4f(ndc, 0.0, 1.0);
}

fn emit_quad(
  vertexIndex: u32,
  minPos: vec2f,
  maxPos: vec2f,
  part: f32
) -> VertexOutput {
  var housingQuad = array<vec2f, 6>(
    vec2f(0.0, 0.0),
    vec2f(1.0, 0.0),
    vec2f(0.0, 1.0),
    vec2f(0.0, 1.0),
    vec2f(1.0, 0.0),
    vec2f(1.0, 1.0)
  );
  let local = housingQuad[vertexIndex];
  let worldPos = vec2f(
    mix(minPos.x, maxPos.x, local.x),
    mix(minPos.y, maxPos.y, local.y)
  );
  var out: VertexOutput;
  out.clipPos = world_to_clip(worldPos);
  out.uv = local;
  out.part = part;
  return out;
}

fn emit_hidden() -> VertexOutput {
  var out: VertexOutput;
  out.clipPos = vec4f(0.0, 0.0, 0.0, 1.0);
  out.uv = vec2f(0.0);
  out.part = 1.0;
  return out;
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let beamLeft = uniforms.wallX - uniforms.beamWidth;
  let tip = vec2f(uniforms.wallX + uniforms.tipOffsetX, uniforms.tipY);
  let midY = 0.5 * (uniforms.yMin + uniforms.yMax);
  let rodHalf = 0.5 * uniforms.rodHeight;
  let tipNearFloor = uniforms.tipY <= uniforms.yMin + (uniforms.yMin - uniforms.yBottom);

  if (vertexIndex < 6u) {
    return emit_quad(
      vertexIndex,
      vec2f(0.0, midY - rodHalf),
      vec2f(beamLeft, midY + rodHalf),
      2.0
    );
  }

  if (vertexIndex < 12u) {
    return emit_quad(
      vertexIndex - 6u,
      vec2f(beamLeft, uniforms.yBottom),
      vec2f(uniforms.wallX, uniforms.yMax),
      3.0
    );
  }

  if (vertexIndex < 15u) {
    let topLeft = vec2f(uniforms.wallX, uniforms.yMax);
    let bottomLeft = vec2f(uniforms.wallX, uniforms.yBottom);
    var tri = array<vec2f, 3>(tip, topLeft, bottomLeft);
    let worldPos = tri[vertexIndex - 12u];
    var out: VertexOutput;
    out.clipPos = world_to_clip(worldPos);
    out.uv = vec2f(
      (worldPos.x - uniforms.wallX) / max(uniforms.tipOffsetX, 1e-6),
      (worldPos.y - uniforms.yBottom) / max(uniforms.yMax - uniforms.yBottom, 1e-6)
    );
    out.part = 1.0;
    return out;
  }

  if (!tipNearFloor) {
    return emit_hidden();
  }

  return emit_quad(
    vertexIndex - 15u,
    vec2f(beamLeft, uniforms.yBottom),
    vec2f(tip.x, uniforms.yMin),
    1.0
  );
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  if (in.part > 1.5 && in.part < 2.5) {
    let shade = mix(0.28, 0.4, in.uv.x);
    let rim = smoothstep(0.0, 0.18, in.uv.y) * smoothstep(0.0, 0.18, 1.0 - in.uv.y);
    return vec4f(vec3f(shade * 0.9, shade, shade * 1.05) * max(rim, 0.55), 1.0);
  }

  return vec4f(0.52, 0.55, 0.58, 1.0);
}
