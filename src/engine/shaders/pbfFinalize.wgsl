@group(0) @binding(0) var<uniform> params: PbfUniforms;
@group(0) @binding(1) var<storage, read_write> pos: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read> predicted: array<vec2f>;
@group(0) @binding(4) var<storage, read_write> cellCounts: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read> cellParticles: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.numParticles) { return; }

  let newPos = predicted[i];
  var newVel = (newPos - pos[i]) / max(params.dt, 1e-8);

  let ci = cell_coord(newPos);
  var xsph = vec2f(0.0);
  var visc = vec2f(0.0);
  var wSum = 0.0;

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

        let r = newPos - predicted[j];
        let r2 = dot(r, r);
        let w = poly6(r2);
        if (w <= 0.0) { continue; }

        let vj = (predicted[j] - pos[j]) / max(params.dt, 1e-8);
        let vji = vj - newVel;
        xsph += vji * w;
        wSum += w;

        let rLen = sqrt(r2);
        if (rLen > 1e-6) {
          let closing = dot(vji, r);
          if (closing < 0.0) {
            visc += (closing / rLen) * (r / rLen) * w;
          }
        }
      }
    }
  }

  if (wSum > 1e-8) {
    newVel += XSPH * (xsph / wSum);
    newVel += VISCOSITY * (visc / wSum);
  }

  newVel *= max(0.0, 1.0 - VELOCITY_DAMPING * params.dt);

  if (newPos.x <= PARTICLE_MIN_X && newVel.x < 0.0) { newVel.x = 0.0; }
  if (newPos.x >= PARTICLE_MAX_X && newVel.x > 0.0) { newVel.x = 0.0; }
  if (newPos.y <= PARTICLE_MIN_Y && newVel.y < 0.0) { newVel.y = 0.0; }
  if (newPos.y >= PARTICLE_MAX_Y && newVel.y > 0.0) { newVel.y = 0.0; }

  pos[i] = newPos;
  vel[i] = newVel;
}
