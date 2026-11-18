import { defaultFloorShape, floorHeightAt, type FloorShape } from './tankFloor';

export const SIM_CONFIG = {
  DOMAIN_WIDTH: 112,
  DOMAIN_HEIGHT: 64,
  CELL_SIZE_METERS: 0.05,
  GRAVITY_MPS2: -9.8,
  GRAVITY: -9.8 / 0.05,
  DT: 1 / 120,
  SUBSTEPS: 2,
  SOLVER_ITERATIONS: 5,
  LAMBDA_EPS: 600.0,
  DELTA_RELAXATION: 0.6,
  TENSILE_K: 0.01,
  TENSILE_DQ: 0.25,
  TENSILE_N: 4,
  XSPH: 0.25,
  VISCOSITY: 0.08,
  VELOCITY_DAMPING: 1.2,
  MASS: 1.0,
  BOUNDARY_LAYERS: 2,
  LEFT_WALL_BASE_FACTOR: 1.0,
  DEFAULT_PARTICLE_SPACING: 0.32,
  DEFAULT_WAVE_AMPLITUDE: 5.0,
  DEFAULT_WAVE_PERIOD: 1 / 0.85,
  MIN_PARTICLE_SPACING: 0.26,
  MAX_PARTICLE_SPACING: 0.5,
  MIN_WAVE_AMPLITUDE: 0.5,
  MAX_WAVE_AMPLITUDE: 8,
  MIN_WAVE_PERIOD: 0.4,
  MAX_WAVE_PERIOD: 4,
  FILL_FRACTION: 0.55,
} as const;

export type WaveParams = {
  amplitude: number;
  periodSeconds: number;
};

export type ParticleDerived = {
  spacing: number;
  h: number;
  restDensity: number;
  boundary: number;
  particleRadius: number;
  hashCellSize: number;
  hashWidth: number;
  hashHeight: number;
  maxDelta: number;
};

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

export function deriveParticles(spacing: number): ParticleDerived {
  const h = spacing * 2.2;
  return {
    spacing,
    h,
    restDensity: restDensityFromLattice(h, spacing, SIM_CONFIG.MASS),
    boundary: h,
    particleRadius: spacing * 0.52,
    hashCellSize: h,
    hashWidth: Math.ceil(SIM_CONFIG.DOMAIN_WIDTH / h),
    hashHeight: Math.ceil(SIM_CONFIG.DOMAIN_HEIGHT / h),
    maxDelta: h * 0.15,
  };
}

export function particleDomain(amplitude: number, boundary: number) {
  return {
    minX: boundary * SIM_CONFIG.LEFT_WALL_BASE_FACTOR + amplitude,
    maxX: SIM_CONFIG.DOMAIN_WIDTH - boundary,
    minY: boundary,
    maxY: SIM_CONFIG.DOMAIN_HEIGHT - boundary,
  };
}

export function estimateParticleCount(
  spacing: number,
  amplitude: number,
  floorShape?: FloorShape
): number {
  const derived = deriveParticles(spacing);
  const domain = particleDomain(amplitude, derived.boundary);
  const surfaceY = domain.minY + (domain.maxY - domain.minY) * SIM_CONFIG.FILL_FRACTION;
  const shape = floorShape ?? defaultFloorShape(derived.boundary);
  let count = 0;
  for (let x = domain.minX + spacing * 0.5; x < domain.maxX - spacing * 0.5; x += spacing) {
    const minY = floorHeightAt(x, derived.boundary, shape);
    for (let y = minY + spacing * 0.5; y < surfaceY; y += spacing) {
      count += 1;
    }
  }
  return count;
}

export function spacingForTargetCount(targetCount: number, amplitude: number): number {
  let lo: number = SIM_CONFIG.MIN_PARTICLE_SPACING;
  let hi: number = SIM_CONFIG.MAX_PARTICLE_SPACING;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) * 0.5;
    if (estimateParticleCount(mid, amplitude) > targetCount) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) * 0.5;
}

export function leftWallState(
  timeSeconds: number,
  amplitude: number,
  periodSeconds: number,
  wallBase: number
) {
  const omega = (2 * Math.PI) / Math.max(periodSeconds, 0.05);
  const phase = omega * timeSeconds;
  return {
    x: wallBase + amplitude * Math.sin(phase),
    vx: amplitude * omega * Math.cos(phase),
  };
}
