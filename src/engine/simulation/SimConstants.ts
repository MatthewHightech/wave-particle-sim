const DOMAIN_WIDTH = 64;
const DOMAIN_HEIGHT = 64;
const PARTICLE_SPACING = 0.55;
const H = PARTICLE_SPACING * 2.2;
const MASS = 1.0;
const CELL_SIZE_METERS = 0.05;
const GRAVITY_MPS2 = -9.8;
const BOUNDARY = H;
const WAVE_MAKER_AMPLITUDE = 2.0;
const WAVE_MAKER_FREQUENCY_HZ = 0.85;

function poly6(r2: number, h: number): number {
  const h2 = h * h;
  if (r2 >= h2) return 0;
  const a = h2 - r2;
  return (4 / (Math.PI * h ** 8)) * a * a * a;
}

function restDensityFromLattice(h: number, spacing: number, mass: number): number {
  let density = 0;
  const extent = Math.ceil(h / spacing);
  for (let ix = -extent; ix <= extent; ix++) {
    for (let iy = -extent; iy <= extent; iy++) {
      const r2 = (ix * spacing) ** 2 + (iy * spacing) ** 2;
      density += mass * poly6(r2, h);
    }
  }
  return density;
}

const REST_DENSITY = restDensityFromLattice(H, PARTICLE_SPACING, MASS);

export const SIM_CONFIG = {
  DOMAIN_WIDTH,
  DOMAIN_HEIGHT,
  GRID_WIDTH: DOMAIN_WIDTH,
  GRID_HEIGHT: DOMAIN_HEIGHT,
  PARTICLE_RADIUS: PARTICLE_SPACING * 0.55,
  PARTICLE_SPACING,
  H,
  MASS,
  REST_DENSITY,
  BOUNDARY,
  WAVE_MAKER_AMPLITUDE,
  WAVE_MAKER_FREQUENCY_HZ,
  WAVE_MAKER_OMEGA: 2 * Math.PI * WAVE_MAKER_FREQUENCY_HZ,
  LEFT_WALL_BASE: BOUNDARY,
  HASH_CELL_SIZE: H,
  HASH_WIDTH: Math.ceil(DOMAIN_WIDTH / H),
  HASH_HEIGHT: Math.ceil(DOMAIN_HEIGHT / H),
  MAX_PER_CELL: 64,
  CELL_SIZE_METERS,
  GRAVITY_MPS2,
  GRAVITY: GRAVITY_MPS2 / CELL_SIZE_METERS,
  DT: 1 / 120,
  SUBSTEPS: 2,
  SOLVER_ITERATIONS: 5,
  LAMBDA_EPS: 600.0,
  DELTA_RELAXATION: 0.6,
  MAX_DELTA: H * 0.15,
  TENSILE_K: 0.01,
  TENSILE_DQ: 0.25,
  TENSILE_N: 4,
  XSPH: 0.25,
  VISCOSITY: 0.08,
  VELOCITY_DAMPING: 1.2,
} as const;

export function particleDomain() {
  const b = SIM_CONFIG.BOUNDARY;
  return {
    minX: SIM_CONFIG.LEFT_WALL_BASE + SIM_CONFIG.WAVE_MAKER_AMPLITUDE,
    maxX: SIM_CONFIG.DOMAIN_WIDTH - b,
    minY: b,
    maxY: SIM_CONFIG.DOMAIN_HEIGHT - b,
  };
}

export function leftWallState(timeSeconds: number) {
  const { LEFT_WALL_BASE, WAVE_MAKER_AMPLITUDE, WAVE_MAKER_OMEGA } = SIM_CONFIG;
  const phase = WAVE_MAKER_OMEGA * timeSeconds;
  return {
    x: LEFT_WALL_BASE + WAVE_MAKER_AMPLITUDE * Math.sin(phase),
    vx: WAVE_MAKER_AMPLITUDE * WAVE_MAKER_OMEGA * Math.cos(phase),
  };
}
