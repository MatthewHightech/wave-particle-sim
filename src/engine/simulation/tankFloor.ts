import { SIM_CONFIG } from './SimConstants';
import { pistonMaxReachX } from './pistonGeometry';

export const TANK_FLOOR = {
  MAX_RIGHT_Y_FACTOR: 0.48,
  MID_EDGE_MARGIN: 0.5,
} as const;

export type FloorShape = {
  pivotX: number;
  rightY: number;
  midX: number;
  midY: number;
};

export type FloorPoint = {
  x: number;
  y: number;
};

export function floorMinPivotX(boundary: number): number {
  return pistonMaxReachX(boundary) + TANK_FLOOR.MID_EDGE_MARGIN;
}

export function floorBaseY(boundary: number): number {
  return boundary;
}

export function floorMaxX(boundary: number): number {
  return SIM_CONFIG.DOMAIN_WIDTH - boundary;
}

export function floorPivotPoint(
  boundary: number,
  pivotX: number
): FloorPoint {
  return {
    x: clampFloorPivotX(pivotX, boundary),
    y: floorBaseY(boundary),
  };
}

export function floorRightPoint(boundary: number, rightY: number): FloorPoint {
  return {
    x: floorMaxX(boundary),
    y: clampRightFloorY(rightY, boundary),
  };
}

export function defaultFloorShape(boundary: number): FloorShape {
  const pivotX = floorMinPivotX(boundary);
  const right = floorRightPoint(boundary, floorBaseY(boundary));
  return {
    pivotX,
    rightY: right.y,
    midX: (pivotX + right.x) * 0.5,
    midY: (floorBaseY(boundary) + right.y) * 0.5,
  };
}

export function clampRightFloorY(rightFloorY: number, boundary: number): number {
  const minY = floorBaseY(boundary);
  const maxY = SIM_CONFIG.DOMAIN_HEIGHT * TANK_FLOOR.MAX_RIGHT_Y_FACTOR;
  return Math.min(maxY, Math.max(minY, rightFloorY));
}

export function clampFloorPivotX(pivotX: number, boundary: number): number {
  const minX = floorMinPivotX(boundary);
  const maxX = floorMaxX(boundary);
  const margin = TANK_FLOOR.MID_EDGE_MARGIN;
  return Math.min(maxX - 2 * margin, Math.max(minX, pivotX));
}

export function clampFloorMid(
  mid: FloorPoint,
  boundary: number,
  pivotX: number
): FloorPoint {
  const clampedPivotX = clampFloorPivotX(pivotX, boundary);
  const maxX = floorMaxX(boundary);
  const minY = floorBaseY(boundary);
  const maxY = SIM_CONFIG.DOMAIN_HEIGHT * TANK_FLOOR.MAX_RIGHT_Y_FACTOR;
  const margin = TANK_FLOOR.MID_EDGE_MARGIN;
  return {
    x: Math.min(maxX - margin, Math.max(clampedPivotX + margin, mid.x)),
    y: Math.min(maxY, Math.max(minY, mid.y)),
  };
}

export function clampFloorShape(
  shape: FloorShape,
  boundary: number
): FloorShape {
  const margin = TANK_FLOOR.MID_EDGE_MARGIN;
  const minPivot = floorMinPivotX(boundary);
  const maxX = floorMaxX(boundary);
  const rightY = clampRightFloorY(shape.rightY, boundary);

  let pivotX = Math.min(maxX - 2 * margin, Math.max(minPivot, shape.pivotX));
  let mid = clampFloorMid(
    { x: shape.midX, y: shape.midY },
    boundary,
    pivotX
  );
  pivotX = Math.min(mid.x - margin, Math.max(minPivot, pivotX));
  mid = clampFloorMid(mid, boundary, pivotX);

  return {
    pivotX,
    rightY,
    midX: mid.x,
    midY: mid.y,
  };
}

function remapFloorAxis(
  value: number,
  oldMin: number,
  oldMax: number,
  newMin: number,
  newMax: number
): number {
  const oldSpan = Math.max(oldMax - oldMin, 1e-6);
  const t = (value - oldMin) / oldSpan;
  return newMin + t * (newMax - newMin);
}

export function remapFloorShape(
  shape: FloorShape,
  oldBoundary: number,
  newBoundary: number
): FloorShape {
  if (oldBoundary === newBoundary) {
    return clampFloorShape(shape, newBoundary);
  }

  const oldBase = floorBaseY(oldBoundary);
  const newBase = floorBaseY(newBoundary);
  const dy = newBase - oldBase;
  const oldMinX = floorMinPivotX(oldBoundary);
  const oldMaxX = floorMaxX(oldBoundary);
  const newMinX = floorMinPivotX(newBoundary);
  const newMaxX = floorMaxX(newBoundary);

  return clampFloorShape(
    {
      pivotX: remapFloorAxis(shape.pivotX, oldMinX, oldMaxX, newMinX, newMaxX),
      midX: remapFloorAxis(shape.midX, oldMinX, oldMaxX, newMinX, newMaxX),
      midY: shape.midY + dy,
      rightY: shape.rightY + dy,
    },
    newBoundary
  );
}

function floorHeightAtClamped(
  x: number,
  boundary: number,
  shape: FloorShape
): number {
  const pivotX = shape.pivotX;
  const pivotY = floorBaseY(boundary);
  const midX = shape.midX;
  const midY = shape.midY;
  const rightX = floorMaxX(boundary);
  const rightY = shape.rightY;

  if (x <= pivotX) {
    return pivotY;
  }
  if (x <= midX) {
    const span = Math.max(midX - pivotX, 1e-6);
    const t = Math.min(1, Math.max(0, (x - pivotX) / span));
    return pivotY + (midY - pivotY) * t;
  }
  const span = Math.max(rightX - midX, 1e-6);
  const t = Math.min(1, Math.max(0, (x - midX) / span));
  return midY + (rightY - midY) * t;
}

function floorNormalAtClamped(
  x: number,
  boundary: number,
  shape: FloorShape
): FloorPoint {
  const pivotX = shape.pivotX;
  const pivotY = floorBaseY(boundary);
  const midX = shape.midX;
  const midY = shape.midY;
  const rightX = floorMaxX(boundary);
  const rightY = shape.rightY;

  if (x <= pivotX) {
    return { x: 0, y: 1 };
  }

  const ax = x <= midX ? pivotX : midX;
  const ay = x <= midX ? pivotY : midY;
  const bx = x <= midX ? midX : rightX;
  const by = x <= midX ? midY : rightY;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

export function floorHeightAt(
  x: number,
  boundary: number,
  shape: FloorShape
): number {
  return floorHeightAtClamped(x, boundary, clampFloorShape(shape, boundary));
}

export function floorNormalAt(
  x: number,
  boundary: number,
  shape: FloorShape
): FloorPoint {
  return floorNormalAtClamped(x, boundary, clampFloorShape(shape, boundary));
}

export function floorHeightAtTrusted(
  x: number,
  boundary: number,
  shape: FloorShape
): number {
  return floorHeightAtClamped(x, boundary, shape);
}

export function floorNormalAtTrusted(
  x: number,
  boundary: number,
  shape: FloorShape
): FloorPoint {
  return floorNormalAtClamped(x, boundary, shape);
}
