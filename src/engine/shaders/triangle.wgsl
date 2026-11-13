struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2f, 3>(
    vec2f( 0.0,  0.5),  // Top
    vec2f(-0.5, -0.5),  // Bottom-left
    vec2f( 0.5, -0.5)   // Bottom-right
  );

  var colors = array<vec3f, 3>(
    vec3f(1.0, 0.2, 0.4), // Red-pink
    vec3f(0.2, 0.9, 0.6), // Mint green
    vec3f(0.2, 0.5, 1.0)  // Electric blue
  );

  var out: VertexOutput;
  out.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  out.color = colors[vertexIndex];
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(in.color, 1.0);
}