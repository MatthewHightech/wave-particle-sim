import { SIM_CONFIG, particleDomain } from './SimConstants';

export function spawnDamBreak(): Float32Array {
  const { minX, maxX, minY, maxY } = particleDomain();
  const spacing = SIM_CONFIG.PARTICLE_SPACING;
  const surfaceY = minY + (maxY - minY) * 0.55;

  const points: number[] = [];
  for (let x = minX + spacing * 0.5; x < maxX - spacing * 0.5; x += spacing) {
    for (let y = minY + spacing * 0.5; y < surfaceY; y += spacing) {
      points.push(x, y);
    }
  }

  return new Float32Array(points);
}
