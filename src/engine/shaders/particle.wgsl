struct SimUniforms {
  gridSize: vec2f,
  particleRadius: f32,
  _pad0: f32,
  viewScale: vec2f,
  viewOffset: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: SimUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec2f>;
@group(0) @binding(2) var<storage, read> foamValues: array<f32>;

struct VertexOutput {
  @builtin(position) clipPos: vec4f,
  @location(0) localUV: vec2f,
  @location(1) foam: f32,
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

  let foam = clamp(foamValues[instanceIndex], 0.0, 1.0);
  let localPos = quadVertices[vertexIndex];
  let radius = uniforms.particleRadius * (1.0 + 0.32 * foam);
  let particlePos = positions[instanceIndex];
  let worldPos = particlePos + localPos * radius;
  let ndc = world_to_ndc(worldPos, uniforms.viewScale, uniforms.viewOffset);

  var out: VertexOutput;
  out.clipPos = vec4f(ndc, 0.0, 1.0);
  out.localUV = localPos;
  out.foam = foam;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  let dist = length(in.localUV);
  if (dist > 1.0) {
    discard;
  }

  let deep = vec3f(0.02, 0.22, 0.42);
  let body = vec3f(0.08, 0.48, 0.72);
  let lit = vec3f(0.42, 0.82, 0.95);
  let foamCore = vec3f(0.97, 0.99, 1.0);
  let foamEdge = vec3f(0.78, 0.88, 0.96);

  let radial = smoothstep(0.05, 0.95, dist);
  let highlight = exp(-dist * dist * 7.0);
  var water = mix(body, deep, radial * 0.75);
  water = mix(water, lit, highlight * 0.55);

  let foamShade = mix(foamCore, foamEdge, radial);
  let bubble = pow(1.0 - dist, 2.2);
  let color = mix(water, foamShade, in.foam * (0.45 + 0.45 * bubble));

  let waterAlpha = mix(0.72, 0.22, smoothstep(0.55, 1.0, dist));
  let foamAlpha = mix(0.92, 0.16, smoothstep(0.48, 1.0, dist));
  let alpha = mix(waterAlpha, foamAlpha, in.foam);

  return vec4f(color, alpha);
}
