struct SimUniforms {
  gridSize: vec2f,
  particleRadius: f32,
  aspectRatio: f32,
};

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec2f>;

struct VertexOutput {
  @builtin(position) clipPos: vec4f,
  @location(0) localUV: vec2f,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  var quadVertices = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0)
  );

  let localPos = quadVertices[vertexIndex];
  let particlePos = positions[instanceIndex];
  let worldPos = particlePos + localPos * uniforms.particleRadius;

  let domainAspect = uniforms.gridSize.x / max(uniforms.gridSize.y, 1e-6);
  var ndc = (worldPos / uniforms.gridSize) * 2.0 - 1.0;
  ndc.y *= uniforms.aspectRatio / domainAspect;

  var out: VertexOutput;
  out.clipPos = vec4f(ndc, 0.0, 1.0);
  out.localUV = localPos;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let dist = length(in.localUV);
  if (dist > 1.0) {
    discard;
  }

  let alpha = 1.0 - smoothstep(0.75, 1.0, dist);
  return vec4f(0.18, 0.68, 0.98, alpha);
}
