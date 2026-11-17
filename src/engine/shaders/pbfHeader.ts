import { SIM_CONFIG, type ParticleDerived } from '../simulation/SimConstants';

export function buildPbfHeader(derived: ParticleDerived): string {
  const maxX = SIM_CONFIG.DOMAIN_WIDTH - derived.boundary;
  const minY = derived.boundary;
  const maxY = SIM_CONFIG.DOMAIN_HEIGHT - derived.boundary;

  return `
const DOMAIN_WIDTH: f32 = ${SIM_CONFIG.DOMAIN_WIDTH}.0;
const DOMAIN_HEIGHT: f32 = ${SIM_CONFIG.DOMAIN_HEIGHT}.0;
const H: f32 = ${derived.h};
const H2: f32 = ${derived.h * derived.h};
const MASS: f32 = ${SIM_CONFIG.MASS};
const REST_DENSITY: f32 = ${derived.restDensity};
const LAMBDA_EPS: f32 = ${SIM_CONFIG.LAMBDA_EPS};
const DELTA_RELAXATION: f32 = ${SIM_CONFIG.DELTA_RELAXATION};
const MAX_DELTA: f32 = ${derived.maxDelta};
const TENSILE_K: f32 = ${SIM_CONFIG.TENSILE_K};
const TENSILE_DQ: f32 = ${SIM_CONFIG.TENSILE_DQ};
const TENSILE_N: f32 = ${SIM_CONFIG.TENSILE_N}.0;
const XSPH: f32 = ${SIM_CONFIG.XSPH};
const VISCOSITY: f32 = ${SIM_CONFIG.VISCOSITY};
const VELOCITY_DAMPING: f32 = ${SIM_CONFIG.VELOCITY_DAMPING};
const HASH_CELL_SIZE: f32 = ${derived.hashCellSize};
const HASH_WIDTH: i32 = ${derived.hashWidth};
const HASH_HEIGHT: i32 = ${derived.hashHeight};
const PARTICLE_MAX_X: f32 = ${maxX};
const PARTICLE_MIN_Y: f32 = ${minY};
const PARTICLE_MAX_Y: f32 = ${maxY};
const PI: f32 = 3.141592653589793;

struct PbfUniforms {
  dt: f32,
  gravity: f32,
  numParticles: u32,
  numTotal: u32,
  leftWallX: f32,
  leftWallVx: f32,
  _pad1: f32,
  _pad2: f32,
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

fn clamp_to_domain(p: vec2f, leftWallX: f32) -> vec2f {
  return clamp(
    p,
    vec2f(leftWallX, PARTICLE_MIN_Y),
    vec2f(PARTICLE_MAX_X, PARTICLE_MAX_Y)
  );
}

fn apply_moving_left_wall(p: vec2f, v: vec2f, leftWallX: f32, leftWallVx: f32) -> vec4f {
  var pos = p;
  var vel = v;

  if (pos.x < leftWallX) {
    pos.x = leftWallX;
    if (vel.x < leftWallVx) {
      vel.x = leftWallVx;
    }
  }

  if (pos.x > PARTICLE_MAX_X) {
    pos.x = PARTICLE_MAX_X;
    if (vel.x > 0.0) { vel.x = 0.0; }
  }
  if (pos.y < PARTICLE_MIN_Y) {
    pos.y = PARTICLE_MIN_Y;
    if (vel.y < 0.0) { vel.y = 0.0; }
  }
  if (pos.y > PARTICLE_MAX_Y) {
    pos.y = PARTICLE_MAX_Y;
    if (vel.y > 0.0) { vel.y = 0.0; }
  }

  return vec4f(pos, vel);
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
}
