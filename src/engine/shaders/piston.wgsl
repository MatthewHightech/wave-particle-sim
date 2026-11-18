struct PistonUniforms {
  gridSize: vec2f,
  aspectRatio: f32,
  wallX: f32,
  beamWidth: f32,
  housingRight: f32,
  yMin: f32,
  yMax: f32,
  tipY: f32,
  tipOffsetX: f32,
  rodHeight: f32,
  _pad0: f32,
};

@group(0) @binding(0) var<uniform> uniforms: PistonUniforms;

struct VertexOutput {
  @builtin(position) clipPos: vec4f,
  @location(0) uv: vec2f,
  @location(1) part: f32,
};

fn world_to_clip(worldPos: vec2f) -> vec4f {
  let domainAspect = uniforms.gridSize.x / max(uniforms.gridSize.y, 1e-6);
  var ndc = (worldPos / uniforms.gridSize) * 2.0 - 1.0;
  ndc.y *= uniforms.aspectRatio / domainAspect;
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

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let beamLeft = uniforms.wallX - uniforms.beamWidth;
  let tip = vec2f(uniforms.wallX + uniforms.tipOffsetX, uniforms.tipY);
  let midY = 0.5 * (uniforms.yMin + uniforms.yMax);
  let rodHalf = 0.5 * uniforms.rodHeight;

  if (vertexIndex < 6u) {
    return emit_quad(
      vertexIndex,
      vec2f(0.0, uniforms.yMin),
      vec2f(uniforms.housingRight, uniforms.yMax),
      0.0
    );
  }

  if (vertexIndex < 12u) {
    return emit_quad(
      vertexIndex - 6u,
      vec2f(0.0, midY - rodHalf),
      vec2f(beamLeft, midY + rodHalf),
      2.0
    );
  }

  if (vertexIndex < 18u) {
    return emit_quad(
      vertexIndex - 12u,
      vec2f(beamLeft, uniforms.yMin),
      vec2f(uniforms.wallX, uniforms.yMax),
      3.0
    );
  }

  let topLeft = vec2f(uniforms.wallX, uniforms.yMax);
  let bottomLeft = vec2f(uniforms.wallX, uniforms.yMin);
  var tri = array<vec2f, 3>(tip, topLeft, bottomLeft);
  let worldPos = tri[vertexIndex - 18u];
  var out: VertexOutput;
  out.clipPos = world_to_clip(worldPos);
  out.uv = vec2f(
    (worldPos.x - uniforms.wallX) / max(uniforms.tipOffsetX, 1e-6),
    (worldPos.y - uniforms.yMin) / max(uniforms.yMax - uniforms.yMin, 1e-6)
  );
  out.part = 1.0;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  if (in.part < 0.5) {
    let warm = mix(0.14, 0.22, in.uv.x);
    let seam = smoothstep(0.94, 1.0, in.uv.x) * 0.06;
    return vec4f(
      vec3f(warm + 0.08, warm * 0.72, warm * 0.42) + vec3f(seam),
      1.0
    );
  }

  if (in.part > 1.5 && in.part < 2.5) {
    let shade = mix(0.28, 0.4, in.uv.x);
    let rim = smoothstep(0.0, 0.18, in.uv.y) * smoothstep(0.0, 0.18, 1.0 - in.uv.y);
    return vec4f(vec3f(shade * 0.9, shade, shade * 1.05) * max(rim, 0.55), 1.0);
  }

  return vec4f(0.52, 0.55, 0.58, 1.0);
}
