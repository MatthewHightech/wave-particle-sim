@group(0) @binding(0) var<uniform> params: PbfUniforms;
@group(0) @binding(1) var<storage, read> predicted: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> cellCounts: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read> cellStarts: array<u32>;
@group(0) @binding(4) var<storage, read> cellParticles: array<u32>;
@group(0) @binding(5) var<storage, read_write> lambda: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.numParticles) { return; }

  let pi = predicted[i];
  let ci = cell_coord(pi);

  var density = 0.0;
  var sumGradSq = 0.0;
  var gradSelf = vec2f(0.0);

  for (var ox = -1; ox <= 1; ox++) {
    for (var oy = -1; oy <= 1; oy++) {
      let nc = ci + vec2i(ox, oy);
      if (nc.x < 0 || nc.y < 0 || nc.x >= HASH_WIDTH || nc.y >= HASH_HEIGHT) {
        continue;
      }

      let nIdx = cell_index(nc);
      let start = cellStarts[nIdx];
      let count = atomicLoad(&cellCounts[nIdx]);
      for (var s = 0u; s < count; s++) {
        let j = cellParticles[start + s];
        let r = pi - predicted[j];
        let r2 = dot(r, r);
        density += MASS * poly6(r2);

        let grad = spiky_grad(r);
        gradSelf += grad;
        if (j != i) {
          let g = grad * (MASS / REST_DENSITY);
          sumGradSq += dot(g, g);
        }
      }
    }
  }

  let gradSelfScaled = gradSelf * (MASS / REST_DENSITY);
  sumGradSq += dot(gradSelfScaled, gradSelfScaled);

  let constraint = density / REST_DENSITY - 1.0;
  lambda[i] = -constraint / (sumGradSq + LAMBDA_EPS);
}
