import { SIM_CONFIG } from './SimConstants';

export type PistonPoint = { x: number; y: number };

export type PistonTip = {
  offsetX: number;
  y: number;
};

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
  const yMin = boundary;
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
  return boundary - particleRadius;
}

function clampPistonTipY(tipY: number, boundary: number): number {
  const { yMin, yMax } = pistonHeightRange(boundary);
  return Math.min(yMax, Math.max(yMin, tipY));
}

function clampPistonTipOffsetX(offsetX: number): number {
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

export function remapPistonTip(
  tip: PistonTip,
  oldBoundary: number,
  newBoundary: number
): PistonTip {
  if (oldBoundary === newBoundary) {
    return clampPistonTip(tip, newBoundary);
  }

  const oldRange = pistonHeightRange(oldBoundary);
  const newRange = pistonHeightRange(newBoundary);
  const oldSpan = Math.max(oldRange.yMax - oldRange.yMin, 1e-6);
  const t = (tip.y - oldRange.yMin) / oldSpan;
  return clampPistonTip(
    {
      offsetX: tip.offsetX,
      y: newRange.yMin + t * (newRange.yMax - newRange.yMin),
    },
    newBoundary
  );
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

function pistonFaceXClamped(
  y: number,
  wallX: number,
  tip: PistonTip,
  boundary: number
): number {
  const { yMin, yMax } = pistonHeightRange(boundary);
  const tipX = wallX + tip.offsetX;
  if (y >= tip.y) {
    const span = Math.max(yMax - tip.y, 1e-6);
    const t = Math.min(1, Math.max(0, (y - tip.y) / span));
    return tipX + (wallX - tipX) * t;
  }
  const span = Math.max(tip.y - yMin, 1e-6);
  const t = Math.min(1, Math.max(0, (tip.y - y) / span));
  return tipX + (wallX - tipX) * t;
}

function pistonFaceNormalClamped(
  y: number,
  tip: PistonTip,
  boundary: number
): PistonPoint {
  const { yMin, yMax } = pistonHeightRange(boundary);
  const along =
    y >= tip.y
      ? { x: -tip.offsetX, y: yMax - tip.y }
      : { x: -tip.offsetX, y: yMin - tip.y };
  const len = Math.hypot(along.x, along.y) || 1;
  const normal = { x: along.y / len, y: -along.x / len };
  if (normal.x < 0) {
    return { x: -normal.x, y: -normal.y };
  }
  return normal;
}

export function pistonFaceX(
  y: number,
  wallX: number,
  tip: PistonTip,
  boundary: number
): number {
  return pistonFaceXClamped(y, wallX, clampPistonTip(tip, boundary), boundary);
}

export function pistonFaceNormal(
  y: number,
  tip: PistonTip,
  boundary: number
): PistonPoint {
  return pistonFaceNormalClamped(y, clampPistonTip(tip, boundary), boundary);
}

export function pistonFaceXTrusted(
  y: number,
  wallX: number,
  tip: PistonTip,
  boundary: number
): number {
  return pistonFaceXClamped(y, wallX, tip, boundary);
}

export function pistonFaceNormalTrusted(
  y: number,
  tip: PistonTip,
  boundary: number
): PistonPoint {
  return pistonFaceNormalClamped(y, tip, boundary);
}
