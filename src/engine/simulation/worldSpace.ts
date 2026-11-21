import { ndcToWorld, worldToNdc } from './viewProjection';

export function worldToCss(
  worldX: number,
  worldY: number,
  cssWidth: number,
  cssHeight: number
): { x: number; y: number } {
  const ndc = worldToNdc(worldX, worldY, cssWidth, cssHeight);
  return {
    x: (ndc.x + 1) * 0.5 * cssWidth,
    y: (1 - ndc.y) * 0.5 * cssHeight,
  };
}

export function cssToWorld(
  cssX: number,
  cssY: number,
  cssWidth: number,
  cssHeight: number
): { x: number; y: number } {
  const ndcX = (cssX / cssWidth) * 2 - 1;
  const ndcY = 1 - (cssY / cssHeight) * 2;
  return ndcToWorld(ndcX, ndcY, cssWidth, cssHeight);
}
