struct SimUniforms {
    gridSize: vec2f,
    particleRadius: f32,
    aspectRatio: f32, // canvas.width / canvas.height
  };
  
  @group(0) @binding(0) var<uniform> uniforms: SimUniforms;
  @group(0) @binding(1) var<storage, read> positions: array<vec2f>;
  
  struct VertexOutput {
    @builtin(position) clipPos: vec4f,
    @location(0) localUV: vec2f, // [-1, 1] inside the quad
  };
  
  @vertex
  fn vs_main(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32
  ) -> VertexOutput {
    // 2 triangles forming a quad in [-1, 1]
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
  
    // World position in grid units
    let worldPos = particlePos + localPos * uniforms.particleRadius;
  
    // Map grid space [0, gridSize] -> NDC [-1, 1]
    // Keep simulation box centered if canvas isn't 1:1 square
    var ndc = (worldPos / uniforms.gridSize) * 2.0 - 1.0;
    if (uniforms.aspectRatio > 1.0) {
      ndc.x /= uniforms.aspectRatio;
    } else {
      ndc.y *= uniforms.aspectRatio;
    }
  
    var out: VertexOutput;
    out.clipPos = vec4f(ndc, 0.0, 1.0);
    out.localUV = localPos;
    return out;
  }
  
  @fragment
  fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    let dist = length(in.localUV);
    if (dist > 1.0) {
      discard; // Carve the square into a circle
    }
  
    // Subtle soft edge + water-blue tint
    let alpha = 1.0 - smoothstep(0.75, 1.0, dist);
    return vec4f(0.18, 0.68, 0.98, alpha);
  }