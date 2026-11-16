@group(0) @binding(0) var<uniform> params: PbfUniforms;
@group(0) @binding(1) var<storage, read> predicted: array<vec2f>;
@group(0) @binding(2) var<storage, read> lambda: array<f32>;
@group(0) @binding(3) var<storage, read_write> cellCounts: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> cellParticles: array<u32>;
@group(0) @binding(5) var<storage, read_write> deltaPos: array<vec2f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.numParticles) { return; }

  let pi = predicted[i];
  let li = lambda[i];
  let ci = cell_coord(pi);
  let wDq = poly6(TENSILE_DQ * TENSILE_DQ * H2);

  var delta = vec2f(0.0);

  for (var ox = -1; ox <= 1; ox++) {
    for (var oy = -1; oy <= 1; oy++) {
      let nc = ci + vec2i(ox, oy);
      if (nc.x < 0 || nc.y < 0 || nc.x >= HASH_WIDTH || nc.y >= HASH_HEIGHT) {
        continue;
      }

      let nIdx = cell_index(nc);
      let count = min(atomicLoad(&cellCounts[nIdx]), u32(MAX_PER_CELL));
      for (var s = 0u; s < count; s++) {
        let j = cellParticles[nIdx * u32(MAX_PER_CELL) + s];
        if (j == i) { continue; }

        let r = pi - predicted[j];
        let r2 = dot(r, r);
        let grad = spiky_grad(r);
        var corr = li + lambda[j];

        if (wDq > 1e-9) {
          let ratio = poly6(r2) / wDq;
          corr -= TENSILE_K * pow(ratio, TENSILE_N);
        }

        delta += corr * grad;
      }
    }
  }

  deltaPos[i] = limit_delta((MASS / REST_DENSITY) * delta);
}
