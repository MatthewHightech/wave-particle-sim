import { SIM_CONFIG, particleDomain } from '../simulation/SimConstants';

const domain = particleDomain();

export const PBF_HEADER = `
const DOMAIN_WIDTH: f32 = ${SIM_CONFIG.DOMAIN_WIDTH}.0;
const DOMAIN_HEIGHT: f32 = ${SIM_CONFIG.DOMAIN_HEIGHT}.0;
const H: f32 = ${SIM_CONFIG.H};
const H2: f32 = ${SIM_CONFIG.H * SIM_CONFIG.H};
const MASS: f32 = ${SIM_CONFIG.MASS};
const REST_DENSITY: f32 = ${SIM_CONFIG.REST_DENSITY};
const LAMBDA_EPS: f32 = ${SIM_CONFIG.LAMBDA_EPS};
const DELTA_RELAXATION: f32 = ${SIM_CONFIG.DELTA_RELAXATION};
const MAX_DELTA: f32 = ${SIM_CONFIG.MAX_DELTA};
const TENSILE_K: f32 = ${SIM_CONFIG.TENSILE_K};
const TENSILE_DQ: f32 = ${SIM_CONFIG.TENSILE_DQ};
const TENSILE_N: f32 = ${SIM_CONFIG.TENSILE_N}.0;
const XSPH: f32 = ${SIM_CONFIG.XSPH};
const VISCOSITY: f32 = ${SIM_CONFIG.VISCOSITY};
const VELOCITY_DAMPING: f32 = ${SIM_CONFIG.VELOCITY_DAMPING};
const HASH_CELL_SIZE: f32 = ${SIM_CONFIG.HASH_CELL_SIZE};
const HASH_WIDTH: i32 = ${SIM_CONFIG.HASH_WIDTH};
const HASH_HEIGHT: i32 = ${SIM_CONFIG.HASH_HEIGHT};
const MAX_PER_CELL: i32 = ${SIM_CONFIG.MAX_PER_CELL};
const PARTICLE_MIN_X: f32 = ${domain.minX};
const PARTICLE_MAX_X: f32 = ${domain.maxX};
const PARTICLE_MIN_Y: f32 = ${domain.minY};
const PARTICLE_MAX_Y: f32 = ${domain.maxY};
const PI: f32 = 3.141592653589793;

struct PbfUniforms {
  dt: f32,
  gravity: f32,
  numParticles: u32,
  _pad: u32,
};

fn poly6(r2: f32) -> f32 {
  if (r2 >= H2) { return 0.0; }
  let a = H2 - r2;
  return 4.0 / (PI * pow(H, 8.0)) * a * a * a;
}

fn spiky_grad(r: vec2f) -> vec2f {
  let rLen = length(r);
  if (rLen <= 1e-6 || rLen >= H) { return vec2f(0.0); }
  let a = H - rLen;
  return (-30.0 / (PI * pow(H, 5.0))) * a * a * (r / rLen);
}

fn cell_coord(p: vec2f) -> vec2i {
  return vec2i(
    clamp(i32(floor(p.x / HASH_CELL_SIZE)), 0, HASH_WIDTH - 1),
    clamp(i32(floor(p.y / HASH_CELL_SIZE)), 0, HASH_HEIGHT - 1)
  );
}

fn cell_index(c: vec2i) -> u32 {
  return u32(c.y * HASH_WIDTH + c.x);
}

fn clamp_to_domain(p: vec2f) -> vec2f {
  return clamp(p, vec2f(PARTICLE_MIN_X, PARTICLE_MIN_Y), vec2f(PARTICLE_MAX_X, PARTICLE_MAX_Y));
}

fn limit_delta(delta: vec2f) -> vec2f {
  let scaled = delta * DELTA_RELAXATION;
  let len = length(scaled);
  if (len > MAX_DELTA && len > 1e-8) {
    return scaled * (MAX_DELTA / len);
  }
  return scaled;
}
`;
