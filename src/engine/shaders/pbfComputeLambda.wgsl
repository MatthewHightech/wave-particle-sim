@group(0) @binding(0) var<uniform> params: PbfUniforms;
@group(0) @binding(1) var<storage, read> predicted: array<vec2f>;
@group(0) @binding(2) var<storage, read> cellStarts: array<u32>;
@group(0) @binding(3) var<storage, read> cellParticles: array<u32>;
@group(0) @binding(4) var<storage, read> sortedPredicted: array<vec2f>;
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

  for (var oy = -1; oy <= 1; oy++) {
    let row = neighbor_row_range(ci, oy);
    if (row.x >= row.y) { continue; }

    let start = cellStarts[row.x];
    let end = cellStarts[row.y];
    for (var slot = start; slot < end; slot++) {
      let j = cellParticles[slot];
      let r = pi - sortedPredicted[slot];
      let r2 = dot(r, r);
      if (r2 >= H2) { continue; }

      let a = H2 - r2;
      density += MASS * POLY6_COEF * a * a * a;

      let grad = spiky_grad(r);
      gradSelf += grad;
      if (j != i) {
        let g = grad * MASS_OVER_REST;
        sumGradSq += dot(g, g);
      }
    }
  }

  let gradSelfScaled = gradSelf * MASS_OVER_REST;
  sumGradSq += dot(gradSelfScaled, gradSelfScaled);

  let constraint = density / REST_DENSITY - 1.0;
  lambda[i] = -constraint / (sumGradSq + LAMBDA_EPS);
}
