import {
  deriveParticles,
  particleDomain,
  SIM_CONFIG,
  type ParticleDerived,
} from './SimConstants';

export function spawnFluid(spacing: number, amplitude: number): Float32Array {
  const derived: ParticleDerived = deriveParticles(spacing);
  const domain = particleDomain(amplitude, derived.boundary);
  const surfaceY =
    domain.minY + (domain.maxY - domain.minY) * SIM_CONFIG.FILL_FRACTION;

  const points: number[] = [];
  for (
    let x = domain.minX + spacing * 0.5;
    x < domain.maxX - spacing * 0.5;
    x += spacing
  ) {
    for (
      let y = domain.minY + spacing * 0.5;
      y < surfaceY;
      y += spacing
    ) {
      points.push(x, y);
    }
  }

  return new Float32Array(points);
}
