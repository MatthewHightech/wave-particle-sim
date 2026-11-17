import {
  deriveParticles,
  leftWallState,
  SIM_CONFIG,
  type ParticleDerived,
} from './SimConstants';

export type BoundaryParticles = {
  positions: Float32Array;
  velocities: Float32Array;
  numStatic: number;
  numLeftWall: number;
  leftWallOffsets: Float32Array;
  leftWallYs: Float32Array;
};

function pushParticle(points: number[], x: number, y: number): void {
  if (
    x < 0 ||
    y < 0 ||
    x >= SIM_CONFIG.DOMAIN_WIDTH ||
    y >= SIM_CONFIG.DOMAIN_HEIGHT
  ) {
    return;
  }
  points.push(x, y);
}

export function spawnBoundary(spacing: number): BoundaryParticles {
  const derived: ParticleDerived = deriveParticles(spacing);
  const layers = SIM_CONFIG.BOUNDARY_LAYERS;
  const minY = derived.boundary;
  const maxY = SIM_CONFIG.DOMAIN_HEIGHT - derived.boundary;
  const maxX = SIM_CONFIG.DOMAIN_WIDTH - derived.boundary;
  const wallBase = derived.boundary * SIM_CONFIG.LEFT_WALL_BASE_FACTOR;
  const wall = leftWallState(0, 0, 1, wallBase);

  const staticPoints: number[] = [];
  for (let layer = 0; layer < layers; layer++) {
    const inset = (0.5 + layer) * spacing;
    for (let x = spacing * 0.5; x < SIM_CONFIG.DOMAIN_WIDTH; x += spacing) {
      pushParticle(staticPoints, x, minY - inset);
      pushParticle(staticPoints, x, maxY + inset);
    }
    for (let y = minY; y <= maxY; y += spacing) {
      pushParticle(staticPoints, maxX + inset, y);
    }
  }

  const leftOffsets: number[] = [];
  const leftYs: number[] = [];
  for (let layer = 0; layer < layers; layer++) {
    const offsetX = -(0.5 + layer) * spacing;
    for (let y = minY; y <= maxY; y += spacing) {
      const x = wall.x + offsetX;
      if (
        x < 0 ||
        x >= SIM_CONFIG.DOMAIN_WIDTH ||
        y < 0 ||
        y >= SIM_CONFIG.DOMAIN_HEIGHT
      ) {
        continue;
      }
      leftOffsets.push(offsetX);
      leftYs.push(y);
    }
  }

  const numStatic = staticPoints.length / 2;
  const numLeftWall = leftOffsets.length;
  const positions = new Float32Array((numStatic + numLeftWall) * 2);
  const velocities = new Float32Array((numStatic + numLeftWall) * 2);
  positions.set(staticPoints);

  for (let i = 0; i < numLeftWall; i++) {
    const idx = (numStatic + i) * 2;
    positions[idx] = wall.x + leftOffsets[i];
    positions[idx + 1] = leftYs[i];
  }

  return {
    positions,
    velocities,
    numStatic,
    numLeftWall,
    leftWallOffsets: new Float32Array(leftOffsets),
    leftWallYs: new Float32Array(leftYs),
  };
}

export function writeLeftWallBoundary(
  boundary: BoundaryParticles,
  leftWallX: number,
  leftWallVx: number
): void {
  const { numStatic, numLeftWall, leftWallOffsets, leftWallYs, positions, velocities } =
    boundary;
  for (let i = 0; i < numLeftWall; i++) {
    const idx = (numStatic + i) * 2;
    positions[idx] = leftWallX + leftWallOffsets[i];
    positions[idx + 1] = leftWallYs[i];
    velocities[idx] = leftWallVx;
    velocities[idx + 1] = 0;
  }
}
