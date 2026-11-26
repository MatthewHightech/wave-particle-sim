import {
  deriveParticles,
  SIM_CONFIG,
  type ParticleDerived,
} from './SimConstants';
import { leftWallBase } from './pistonGeometry';
import {
  defaultFloorShape,
  floorHeightAt,
  type FloorShape,
} from './tankFloor';

export function particleDomain(amplitude: number, boundary: number) {
  return {
    minX: leftWallBase(boundary) + amplitude,
    maxX: SIM_CONFIG.DOMAIN_WIDTH - boundary,
    minY: boundary,
    maxY: SIM_CONFIG.DOMAIN_HEIGHT - boundary,
  };
}

function forEachFluidLatticePoint(
  spacing: number,
  amplitude: number,
  floorShape: FloorShape,
  visit: (x: number, y: number) => void
): void {
  const derived: ParticleDerived = deriveParticles(spacing);
  const domain = particleDomain(amplitude, derived.boundary);
  const surfaceY =
    domain.minY + (domain.maxY - domain.minY) * SIM_CONFIG.FILL_FRACTION;

  for (
    let x = domain.minX + spacing * 0.5;
    x < domain.maxX - spacing * 0.5;
    x += spacing
  ) {
    const minY = floorHeightAt(x, derived.boundary, floorShape);
    for (let y = minY + spacing * 0.5; y < surfaceY; y += spacing) {
      visit(x, y);
    }
  }
}

export function spawnFluid(
  spacing: number,
  amplitude: number,
  floorShape = defaultFloorShape(deriveParticles(spacing).boundary)
): Float32Array {
  const points: number[] = [];
  forEachFluidLatticePoint(spacing, amplitude, floorShape, (x, y) => {
    points.push(x, y);
  });
  return new Float32Array(points);
}

export function estimateParticleCount(
  spacing: number,
  amplitude: number,
  floorShape?: FloorShape
): number {
  const shape =
    floorShape ?? defaultFloorShape(deriveParticles(spacing).boundary);
  let count = 0;
  forEachFluidLatticePoint(spacing, amplitude, shape, () => {
    count += 1;
  });
  return count;
}

export function spacingForTargetCount(
  targetCount: number,
  amplitude: number
): number {
  const clamped = Math.min(
    SIM_CONFIG.MAX_PARTICLE_COUNT,
    Math.max(SIM_CONFIG.MIN_PARTICLE_COUNT, targetCount)
  );
  let lo: number = SIM_CONFIG.MIN_PARTICLE_SPACING;
  let hi: number = SIM_CONFIG.MAX_PARTICLE_SPACING;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) * 0.5;
    if (estimateParticleCount(mid, amplitude) >= clamped) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return estimateParticleCount(hi, amplitude) >= clamped ? hi : lo;
}

export function defaultParticleSpacing(): number {
  return spacingForTargetCount(
    SIM_CONFIG.MIN_PARTICLE_COUNT,
    SIM_CONFIG.DEFAULT_WAVE_AMPLITUDE
  );
}
