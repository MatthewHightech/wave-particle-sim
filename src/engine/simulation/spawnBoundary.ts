import {
  deriveParticles,
  leftWallState,
  SIM_CONFIG,
  type ParticleDerived,
} from './SimConstants';
import {
  clampFloorShape,
  defaultFloorShape,
  floorBaseY,
  floorHeightAt,
  floorMaxX,
  floorNormalAt,
  type FloorShape,
} from './tankFloor';
export type BoundaryParticles = {
  positions: Float32Array;
  velocities: Float32Array;
  numStatic: number;
  numLeftWall: number;
  leftWallOffsets: Float32Array;
  leftWallYs: Float32Array;
  floorStart: number;
  floorCount: number;
  floorXs: Float32Array;
  floorLayers: Float32Array;
  rightWallStart: number;
  rightWallCount: number;
  rightWallLayers: Float32Array;
  rightWallLocalYs: Float32Array;
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

export function spawnBoundary(
  spacing: number,
  floorShape = defaultFloorShape(deriveParticles(spacing).boundary)
): BoundaryParticles {
  const derived: ParticleDerived = deriveParticles(spacing);
  const layers = SIM_CONFIG.BOUNDARY_LAYERS;
  const baseY = floorBaseY(derived.boundary);
  const maxY = SIM_CONFIG.DOMAIN_HEIGHT - derived.boundary;
  const wallBase = derived.boundary * SIM_CONFIG.LEFT_WALL_BASE_FACTOR;
  const wall = leftWallState(0, 0, 1, wallBase);
  const shape = clampFloorShape(floorShape, derived.boundary);

  const topPoints: number[] = [];
  for (let layer = 0; layer < layers; layer++) {
    const inset = (0.5 + layer) * spacing;
    for (let x = spacing * 0.5; x < SIM_CONFIG.DOMAIN_WIDTH; x += spacing) {
      pushParticle(topPoints, x, maxY + inset);
    }
  }

  const floorXs: number[] = [];
  const floorLayers: number[] = [];
  for (let layer = 0; layer < layers; layer++) {
    for (let x = spacing * 0.5; x < SIM_CONFIG.DOMAIN_WIDTH; x += spacing) {
      floorXs.push(x);
      floorLayers.push(layer);
    }
  }

  const rightWallLayers: number[] = [];
  const rightWallLocalYs: number[] = [];
  for (let layer = 0; layer < layers; layer++) {
    for (let y = baseY; y <= maxY; y += spacing) {
      rightWallLayers.push(layer);
      rightWallLocalYs.push(y);
    }
  }

  const floorStart = topPoints.length / 2;
  const floorCount = floorXs.length;
  const rightWallStart = floorStart + floorCount;
  const rightWallCount = rightWallLocalYs.length;
  const numStatic = rightWallStart + rightWallCount;

  const leftOffsets: number[] = [];
  const leftYs: number[] = [];
  for (let layer = 0; layer < layers; layer++) {
    const offsetX = -(0.5 + layer) * spacing;
    for (let y = baseY; y <= maxY; y += spacing) {
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

  const numLeftWall = leftOffsets.length;
  const positions = new Float32Array((numStatic + numLeftWall) * 2);
  const velocities = new Float32Array((numStatic + numLeftWall) * 2);
  positions.set(topPoints);

  const boundary: BoundaryParticles = {
    positions,
    velocities,
    numStatic,
    numLeftWall,
    leftWallOffsets: new Float32Array(leftOffsets),
    leftWallYs: new Float32Array(leftYs),
    floorStart,
    floorCount,
    floorXs: new Float32Array(floorXs),
    floorLayers: new Float32Array(floorLayers),
    rightWallStart,
    rightWallCount,
    rightWallLayers: new Float32Array(rightWallLayers),
    rightWallLocalYs: new Float32Array(rightWallLocalYs),
  };

  writeFloorBoundary(boundary, derived.spacing, derived.boundary, shape);
  writeLeftWallBoundary(boundary, wall.x, wall.vx);
  return boundary;
}

export function writeFloorBoundary(
  boundary: BoundaryParticles,
  spacing: number,
  particleBoundary: number,
  floorShape: FloorShape
): void {
  const shape = clampFloorShape(floorShape, particleBoundary);
  const maxX = floorMaxX(particleBoundary);
  const {
    positions,
    velocities,
    floorStart,
    floorCount,
    floorXs,
    floorLayers,
    rightWallStart,
    rightWallCount,
    rightWallLayers,
    rightWallLocalYs,
  } = boundary;

  for (let i = 0; i < floorCount; i++) {
    const x = floorXs[i];
    const layer = floorLayers[i];
    const inset = (0.5 + layer) * spacing;
    const normal = floorNormalAt(x, particleBoundary, shape);
    const surfaceY = floorHeightAt(x, particleBoundary, shape);
    const idx = (floorStart + i) * 2;
    positions[idx] = x - normal.x * inset;
    positions[idx + 1] = surfaceY - normal.y * inset;
    velocities[idx] = 0;
    velocities[idx + 1] = 0;
  }

  const baseY = floorBaseY(particleBoundary);
  const topY = SIM_CONFIG.DOMAIN_HEIGHT - particleBoundary;
  const cornerY = floorHeightAt(maxX, particleBoundary, shape);
  const wallSpan = Math.max(topY - baseY, 1e-6);

  for (let i = 0; i < rightWallCount; i++) {
    const layer = rightWallLayers[i];
    const inset = (0.5 + layer) * spacing;
    const localY = rightWallLocalYs[i];
    const t = (localY - baseY) / wallSpan;
    const y = cornerY + t * (topY - cornerY);
    const idx = (rightWallStart + i) * 2;
    positions[idx] = maxX + inset;
    positions[idx + 1] = y;
    velocities[idx] = 0;
    velocities[idx + 1] = 0;
  }
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
