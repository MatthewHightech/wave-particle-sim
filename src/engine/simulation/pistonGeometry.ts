import {
  leftWallBase,
  pistonHeightRange,
  SIM_CONFIG,
} from './SimConstants';

export type PistonPoint = { x: number; y: number };

export type PistonTip = {
  offsetX: number;
  y: number;
};

export function clampPistonTipY(tipY: number, boundary: number): number {
  const { yMin, yMax } = pistonHeightRange(boundary);
  return Math.min(yMax, Math.max(yMin, tipY));
}

export function clampPistonTipOffsetX(offsetX: number): number {
  return Math.min(
    SIM_CONFIG.PISTON_TIP_MAX_OFFSET,
    Math.max(SIM_CONFIG.PISTON_TIP_MIN_OFFSET, offsetX)
  );
}

export function clampPistonTip(tip: PistonTip, boundary: number): PistonTip {
  return {
    offsetX: clampPistonTipOffsetX(tip.offsetX),
    y: clampPistonTipY(tip.y, boundary),
  };
}

export function defaultPistonTip(boundary: number): PistonTip {
  const { yMin } = pistonHeightRange(boundary);
  return {
    offsetX:
      (SIM_CONFIG.PISTON_TIP_MIN_OFFSET + SIM_CONFIG.PISTON_TIP_MAX_OFFSET) *
      0.5,
    y: yMin,
  };
}

export function pistonFaceX(
  y: number,
  wallX: number,
  tip: PistonTip,
  boundary: number
): number {
  const { yMin, yMax } = pistonHeightRange(boundary);
  const clamped = clampPistonTip(tip, boundary);
  const tipX = wallX + clamped.offsetX;
  if (y >= clamped.y) {
    const span = Math.max(yMax - clamped.y, 1e-6);
    const t = Math.min(1, Math.max(0, (y - clamped.y) / span));
    return tipX + (wallX - tipX) * t;
  }
  const span = Math.max(clamped.y - yMin, 1e-6);
  const t = Math.min(1, Math.max(0, (clamped.y - y) / span));
  return tipX + (wallX - tipX) * t;
}

export function pistonFaceNormal(
  y: number,
  tip: PistonTip,
  boundary: number
): PistonPoint {
  const { yMin, yMax } = pistonHeightRange(boundary);
  const clamped = clampPistonTip(tip, boundary);
  const along =
    y >= clamped.y
      ? { x: -clamped.offsetX, y: yMax - clamped.y }
      : { x: -clamped.offsetX, y: yMin - clamped.y };
  const len = Math.hypot(along.x, along.y) || 1;
  const normal = { x: along.y / len, y: -along.x / len };
  if (normal.x < 0) {
    return { x: -normal.x, y: -normal.y };
  }
  return normal;
}

export function pistonVertices(
  wallX: number,
  tip: PistonTip,
  boundary: number
): { topLeft: PistonPoint; bottomLeft: PistonPoint; tip: PistonPoint } {
  const { yMin, yMax } = pistonHeightRange(boundary);
  const clamped = clampPistonTip(tip, boundary);
  return {
    topLeft: { x: wallX, y: yMax },
    bottomLeft: { x: wallX, y: yMin },
    tip: { x: wallX + clamped.offsetX, y: clamped.y },
  };
}

export function pistonRestWallX(boundary: number): number {
  return leftWallBase(boundary);
}
