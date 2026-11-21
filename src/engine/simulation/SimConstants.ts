import {
  defaultFloorShape,
  floorBaseY,
  floorHeightAt,
  type FloorShape,
} from './tankFloor';

export const SIM_CONFIG = {
  DOMAIN_WIDTH: 148,
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
  PISTON_BEAM_WIDTH: 2.2,
  PISTON_ROD_HEIGHT: 1.15,
  PISTON_TIP_MIN_OFFSET: 1.2,
  PISTON_TIP_MAX_OFFSET: 16,
  PISTON_EDGE_MARGIN: 0.6,
  PISTON_HEIGHT_FACTOR: 0.52,
  DEFAULT_PARTICLE_SPACING: 0.387,
  DEFAULT_WAVE_AMPLITUDE: 12,
  DEFAULT_WAVE_PERIOD: 1.75,
  MIN_PARTICLE_SPACING: 0.26,
  MAX_PARTICLE_SPACING: 0.5,
  MIN_WAVE_AMPLITUDE: 0.5,
  MAX_WAVE_AMPLITUDE: 20,
  MIN_WAVE_PERIOD: 0.4,
  MAX_WAVE_PERIOD: 4,
  FILL_FRACTION: 0.55,
  FOAM_LIFETIME: 1.25,
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

export function leftWallBase(boundary: number): number {
  return Math.max(
    boundary,
    SIM_CONFIG.MAX_WAVE_AMPLITUDE +
      SIM_CONFIG.PISTON_BEAM_WIDTH +
      SIM_CONFIG.PISTON_EDGE_MARGIN
  );
}

export function pistonMaxWallX(boundary: number): number {
  return leftWallBase(boundary) + SIM_CONFIG.MAX_WAVE_AMPLITUDE;
}

export function pistonMaxReachX(boundary: number): number {
  return pistonMaxWallX(boundary) + SIM_CONFIG.PISTON_TIP_MAX_OFFSET;
}

export function pistonHeightRange(boundary: number): { yMin: number; yMax: number } {
  const yMin = floorBaseY(boundary);
  const yMax = Math.min(
    SIM_CONFIG.DOMAIN_HEIGHT - boundary * 0.35,
    yMin + SIM_CONFIG.DOMAIN_HEIGHT * SIM_CONFIG.PISTON_HEIGHT_FACTOR
  );
  return { yMin, yMax };
}

export function pistonSealBottomY(
  boundary: number,
  particleRadius: number
): number {
  return floorBaseY(boundary) - particleRadius;
}

export function particleDomain(amplitude: number, boundary: number) {
  return {
    minX: leftWallBase(boundary) + amplitude,
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
