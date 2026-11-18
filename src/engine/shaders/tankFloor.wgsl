struct FloorUniforms {
  gridSize: vec2f,
  aspectRatio: f32,
  baseY: f32,
  pivotX: f32,
  midX: f32,
  midY: f32,
  rightX: f32,
  rightY: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<uniform> uniforms: FloorUniforms;

struct VertexOutput {
  @builtin(position) clipPos: vec4f,
  @location(0) ndc: vec2f,
};

fn floor_height(x: f32) -> f32 {
  if (x <= uniforms.pivotX) {
    return uniforms.baseY;
  }
  if (x <= uniforms.midX) {
    let span = max(uniforms.midX - uniforms.pivotX, 1e-6);
    let t = clamp((x - uniforms.pivotX) / span, 0.0, 1.0);
    return mix(uniforms.baseY, uniforms.midY, t);
  }
  let span = max(uniforms.rightX - uniforms.midX, 1e-6);
  let t = clamp((x - uniforms.midX) / span, 0.0, 1.0);
  return mix(uniforms.midY, uniforms.rightY, t);
}

fn concrete(worldPos: vec2f) -> vec4f {
  let grain = fract(worldPos.x * 0.37 + worldPos.y * 0.21) * 0.03;
  return vec4f(0.45 + grain, 0.44 + grain * 0.9, 0.41 + grain * 0.7, 1.0);
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var quad = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0)
  );
  let ndc = quad[vertexIndex];
  var out: VertexOutput;
  out.clipPos = vec4f(ndc, 0.0, 1.0);
  out.ndc = ndc;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let domainAspect = uniforms.gridSize.x / max(uniforms.gridSize.y, 1e-6);
  let world = vec2f(
    (in.ndc.x * 0.5 + 0.5) * uniforms.gridSize.x,
    (in.ndc.y * domainAspect / max(uniforms.aspectRatio, 1e-6) * 0.5 + 0.5) *
      uniforms.gridSize.y
  );

  if (world.y < 0.0) {
    return concrete(world);
  }

  if (
    world.x < 0.0 ||
    world.x > uniforms.gridSize.x ||
    world.y > uniforms.gridSize.y
  ) {
    return vec4f(0.04, 0.08, 0.12, 1.0);
  }

  if (world.y <= floor_height(world.x)) {
    return concrete(world);
  }

  return vec4f(0.04, 0.08, 0.12, 1.0);
}
