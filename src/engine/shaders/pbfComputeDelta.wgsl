@group(0) @binding(0) var<uniform> params: PbfUniforms;
@group(0) @binding(1) var<storage, read> predicted: array<vec2f>;
@group(0) @binding(2) var<storage, read> lambda: array<f32>;
@group(0) @binding(3) var<storage, read> cellStarts: array<u32>;
@group(0) @binding(4) var<storage, read> cellParticles: array<u32>;
@group(0) @binding(5) var<storage, read> sortedPredicted: array<vec2f>;
@group(0) @binding(6) var<storage, read_write> deltaPos: array<vec2f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.numParticles) { return; }

  let pi = predicted[i];
  let li = lambda[i];
  let ci = cell_coord(pi);

  var delta = vec2f(0.0);

  for (var oy = -1; oy <= 1; oy++) {
    let row = neighbor_row_range(ci, oy);
    if (row.x >= row.y) { continue; }

    let start = cellStarts[row.x];
    let end = cellStarts[row.y];
    for (var slot = start; slot < end; slot++) {
      let j = cellParticles[slot];
      if (j == i) { continue; }

      let r = pi - sortedPredicted[slot];
      let r2 = dot(r, r);
      if (r2 >= H2) { continue; }

      let grad = spiky_grad(r);
      var lj = 0.0;
      if (j < params.numParticles) {
        lj = lambda[j];
      }
      var corr = li + lj;

      if (TENSILE_WDQ > 1e-9) {
        let a = H2 - r2;
        let ratio = (POLY6_COEF * a * a * a) / TENSILE_WDQ;
        let ratio2 = ratio * ratio;
        corr -= TENSILE_K * ratio2 * ratio2;
      }

      delta += corr * grad;
    }
  }

  deltaPos[i] = limit_delta(MASS_OVER_REST * delta);
}
