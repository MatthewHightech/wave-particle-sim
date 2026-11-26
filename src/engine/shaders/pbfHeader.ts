import { SIM_CONFIG, type ParticleDerived } from '../simulation/SimConstants';
import { pistonHeightRange } from '../simulation/pistonGeometry';

export function buildPbfHeader(derived: ParticleDerived): string {
  const maxX = SIM_CONFIG.DOMAIN_WIDTH - derived.boundary;
  const minY = derived.boundary;
  const maxY = SIM_CONFIG.DOMAIN_HEIGHT - derived.boundary;
  const { yMin: pistonYMin, yMax: pistonYMax } = pistonHeightRange(
    derived.boundary
  );
  const h = derived.h;
  const h2 = h * h;
  const poly6Coef = 4 / (Math.PI * h ** 8);
  const spikyCoef = -30 / (Math.PI * h ** 5);
  const tensileR2 = SIM_CONFIG.TENSILE_DQ * SIM_CONFIG.TENSILE_DQ * h2;
  const tensileA = h2 - tensileR2;
  const tensileWdq =
    tensileR2 >= h2 ? 0 : poly6Coef * tensileA * tensileA * tensileA;
  const numHashCells = derived.hashWidth * derived.hashHeight;

  return `
const DOMAIN_WIDTH: f32 = ${SIM_CONFIG.DOMAIN_WIDTH}.0;
const DOMAIN_HEIGHT: f32 = ${SIM_CONFIG.DOMAIN_HEIGHT}.0;
const H: f32 = ${h};
const H2: f32 = ${h2};
const MASS: f32 = ${SIM_CONFIG.MASS};
const REST_DENSITY: f32 = ${derived.restDensity};
const MASS_OVER_REST: f32 = ${SIM_CONFIG.MASS / derived.restDensity};
const LAMBDA_EPS: f32 = ${SIM_CONFIG.LAMBDA_EPS};
const DELTA_RELAXATION: f32 = ${SIM_CONFIG.DELTA_RELAXATION};
const MAX_DELTA: f32 = ${derived.maxDelta};
const TENSILE_K: f32 = ${SIM_CONFIG.TENSILE_K};
const TENSILE_WDQ: f32 = ${tensileWdq};
const XSPH: f32 = ${SIM_CONFIG.XSPH};
const VISCOSITY: f32 = ${SIM_CONFIG.VISCOSITY};
const VELOCITY_DAMPING: f32 = ${SIM_CONFIG.VELOCITY_DAMPING};
const FOAM_LIFETIME: f32 = ${SIM_CONFIG.FOAM_LIFETIME};
const HASH_CELL_SIZE: f32 = ${derived.hashCellSize};
const HASH_WIDTH: i32 = ${derived.hashWidth};
const HASH_HEIGHT: i32 = ${derived.hashHeight};
const NUM_HASH_CELLS: u32 = ${numHashCells}u;
const PARTICLE_MAX_X: f32 = ${maxX};
const PARTICLE_MIN_Y: f32 = ${minY};
const PARTICLE_MAX_Y: f32 = ${maxY};
const PISTON_Y_MIN: f32 = ${pistonYMin};
const PISTON_Y_MAX: f32 = ${pistonYMax};
const PISTON_TIP_MIN_OFFSET: f32 = ${SIM_CONFIG.PISTON_TIP_MIN_OFFSET};
const PISTON_TIP_MAX_OFFSET: f32 = ${SIM_CONFIG.PISTON_TIP_MAX_OFFSET};
const POLY6_COEF: f32 = ${poly6Coef};
const SPIKY_COEF: f32 = ${spikyCoef};
const PI: f32 = 3.141592653589793;

struct PbfUniforms {
  dt: f32,
  gravity: f32,
  numParticles: u32,
  numTotal: u32,
  leftWallX: f32,
  leftWallVx: f32,
  rightFloorY: f32,
  midFloorX: f32,
  midFloorY: f32,
  pivotFloorX: f32,
  foamImpactStart: f32,
  foamImpactFull: f32,
  foamMotionStart: f32,
  foamMotionFull: f32,
  pistonTipY: f32,
  pistonTipOffsetX: f32,
};

fn poly6(r2: f32) -> f32 {
  if (r2 >= H2) { return 0.0; }
  let a = H2 - r2;
  return POLY6_COEF * a * a * a;
}

fn spiky_grad(r: vec2f) -> vec2f {
  let r2 = dot(r, r);
  if (r2 >= H2 || r2 <= 1e-12) { return vec2f(0.0); }
  let rLen = sqrt(r2);
  let a = H - rLen;
  return SPIKY_COEF * a * a * (r / rLen);
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

fn neighbor_row_range(ci: vec2i, oy: i32) -> vec2u {
  let y = ci.y + oy;
  if (y < 0 || y >= HASH_HEIGHT) {
    return vec2u(0u, 0u);
  }
  let x0 = max(ci.x - 1, 0);
  let x1 = min(ci.x + 1, HASH_WIDTH - 1);
  let startCell = cell_index(vec2i(x0, y));
  let endCell = cell_index(vec2i(x1, y));
  return vec2u(startCell, endCell + 1u);
}

fn segment_closest(p: vec2f, a: vec2f, b: vec2f) -> vec2f {
  let ab = b - a;
  let abLen2 = max(dot(ab, ab), 1e-8);
  let t = clamp(dot(p - a, ab) / abLen2, 0.0, 1.0);
  return a + ab * t;
}

fn segment_normal(a: vec2f, b: vec2f) -> vec2f {
  let ab = b - a;
  return normalize(vec2f(-ab.y, ab.x));
}

fn project_to_floor(p: vec2f, pivotFloorX: f32, midFloor: vec2f, rightFloorY: f32) -> vec2f {
  if (p.x <= pivotFloorX) {
    return vec2f(p.x, max(p.y, PARTICLE_MIN_Y));
  }

  let pivot = vec2f(pivotFloorX, PARTICLE_MIN_Y);
  let right = vec2f(PARTICLE_MAX_X, rightFloorY);
  let c1 = segment_closest(p, pivot, midFloor);
  let c2 = segment_closest(p, midFloor, right);
  let useFirst = distance(p, c1) <= distance(p, c2);
  let closest = select(c2, c1, useFirst);
  let n = select(
    segment_normal(midFloor, right),
    segment_normal(pivot, midFloor),
    useFirst
  );
  let dist = dot(p - closest, n);
  if (dist >= 0.0) {
    return p;
  }
  return closest;
}

fn piston_face_x(y: f32, wallX: f32, tipY: f32, tipOffsetX: f32) -> f32 {
  let tip = clamp(tipY, PISTON_Y_MIN, PISTON_Y_MAX);
  let tipX = wallX + clamp(tipOffsetX, PISTON_TIP_MIN_OFFSET, PISTON_TIP_MAX_OFFSET);
  if (y >= tip) {
    let span = max(PISTON_Y_MAX - tip, 1e-6);
    let t = clamp((y - tip) / span, 0.0, 1.0);
    return mix(tipX, wallX, t);
  }
  let span = max(tip - PISTON_Y_MIN, 1e-6);
  let t = clamp((tip - y) / span, 0.0, 1.0);
  return mix(tipX, wallX, t);
}

fn apply_piston(
  p: vec2f,
  v: vec2f,
  wallX: f32,
  wallVx: f32,
  tipY: f32,
  tipOffsetX: f32
) -> vec4f {
  var pos = p;
  var vel = v;
  let tip = vec2f(
    wallX + clamp(tipOffsetX, PISTON_TIP_MIN_OFFSET, PISTON_TIP_MAX_OFFSET),
    clamp(tipY, PISTON_Y_MIN, PISTON_Y_MAX)
  );
  let topLeft = vec2f(wallX, PISTON_Y_MAX);
  let bottomLeft = vec2f(wallX, PISTON_Y_MIN);

  if (pos.y >= tip.y) {
    let closest = segment_closest(pos, tip, topLeft);
    let n = segment_normal(tip, topLeft);
    let fluidN = select(n, -n, n.x < 0.0);
    let dist = dot(pos - closest, fluidN);
    if (dist < 0.0) {
      pos = closest;
      let vn = dot(vel, fluidN);
      if (vn < wallVx * fluidN.x) {
        vel = vel + fluidN * (wallVx * fluidN.x - vn);
      }
    }
  } else {
    let closest = segment_closest(pos, tip, bottomLeft);
    let n = segment_normal(tip, bottomLeft);
    let fluidN = select(n, -n, n.x < 0.0);
    let dist = dot(pos - closest, fluidN);
    if (dist < 0.0) {
      pos = closest;
      let vn = dot(vel, fluidN);
      if (vn < wallVx * fluidN.x) {
        vel = vel + fluidN * (wallVx * fluidN.x - vn);
      }
    }
  }

  let faceX = piston_face_x(pos.y, wallX, tipY, tipOffsetX);
  if (pos.x < faceX) {
    pos.x = faceX;
    if (vel.x < wallVx) {
      vel.x = wallVx;
    }
  }

  return vec4f(pos, vel);
}

fn clamp_to_domain(
  p: vec2f,
  leftWallX: f32,
  pistonTipY: f32,
  pistonTipOffsetX: f32,
  pivotFloorX: f32,
  midFloor: vec2f,
  rightFloorY: f32
) -> vec2f {
  var pos = clamp(
    p,
    vec2f(0.0, 0.0),
    vec2f(PARTICLE_MAX_X, PARTICLE_MAX_Y)
  );
  let faceX = piston_face_x(pos.y, leftWallX, pistonTipY, pistonTipOffsetX);
  pos.x = max(pos.x, faceX);
  return project_to_floor(pos, pivotFloorX, midFloor, rightFloorY);
}

fn apply_boundaries(
  p: vec2f,
  v: vec2f,
  leftWallX: f32,
  leftWallVx: f32,
  pistonTipY: f32,
  pistonTipOffsetX: f32,
  pivotFloorX: f32,
  midFloor: vec2f,
  rightFloorY: f32
) -> vec4f {
  var pos = p;
  var vel = v;

  let pistonHit = apply_piston(
    pos,
    vel,
    leftWallX,
    leftWallVx,
    pistonTipY,
    pistonTipOffsetX
  );
  pos = pistonHit.xy;
  vel = pistonHit.zw;

  if (pos.x > PARTICLE_MAX_X) {
    pos.x = PARTICLE_MAX_X;
    if (vel.x > 0.0) { vel.x = 0.0; }
  }

  if (pos.y > PARTICLE_MAX_Y) {
    pos.y = PARTICLE_MAX_Y;
    if (vel.y > 0.0) { vel.y = 0.0; }
  }

  if (pos.x <= pivotFloorX) {
    if (pos.y < PARTICLE_MIN_Y) {
      pos.y = PARTICLE_MIN_Y;
      if (vel.y < 0.0) { vel.y = 0.0; }
    }
  } else {
    let pivot = vec2f(pivotFloorX, PARTICLE_MIN_Y);
    let right = vec2f(PARTICLE_MAX_X, rightFloorY);
    let c1 = segment_closest(pos, pivot, midFloor);
    let c2 = segment_closest(pos, midFloor, right);
    let useFirst = distance(pos, c1) <= distance(pos, c2);
    let closest = select(c2, c1, useFirst);
    let n = select(
      segment_normal(midFloor, right),
      segment_normal(pivot, midFloor),
      useFirst
    );
    let dist = dot(pos - closest, n);
    if (dist < 0.0) {
      pos = closest;
      let vn = dot(vel, n);
      if (vn < 0.0) {
        vel = vel - n * vn;
      }
    }
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
