import { SIM_CONFIG } from './SimConstants';

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
  return boundary * SIM_CONFIG.LEFT_WALL_BASE_FACTOR;
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

export function floorHeightAt(
  x: number,
  boundary: number,
  shape: FloorShape
): number {
  const clamped = clampFloorShape(shape, boundary);
  const pivot = floorPivotPoint(boundary, clamped.pivotX);
  const mid = { x: clamped.midX, y: clamped.midY };
  const right = floorRightPoint(boundary, clamped.rightY);

  if (x <= pivot.x) {
    return pivot.y;
  }
  if (x <= mid.x) {
    const span = Math.max(mid.x - pivot.x, 1e-6);
    const t = Math.min(1, Math.max(0, (x - pivot.x) / span));
    return pivot.y + (mid.y - pivot.y) * t;
  }
  const span = Math.max(right.x - mid.x, 1e-6);
  const t = Math.min(1, Math.max(0, (x - mid.x) / span));
  return mid.y + (right.y - mid.y) * t;
}

export function floorNormalAt(
  x: number,
  boundary: number,
  shape: FloorShape
): FloorPoint {
  const clamped = clampFloorShape(shape, boundary);
  const pivot = floorPivotPoint(boundary, clamped.pivotX);
  const mid = { x: clamped.midX, y: clamped.midY };
  const right = floorRightPoint(boundary, clamped.rightY);

  if (x <= pivot.x) {
    return { x: 0, y: 1 };
  }

  const a = x <= mid.x ? pivot : mid;
  const b = x <= mid.x ? mid : right;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}
