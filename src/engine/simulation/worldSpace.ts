import { SIM_CONFIG } from './SimConstants';

function domainAspect(): number {
  return SIM_CONFIG.DOMAIN_WIDTH / Math.max(SIM_CONFIG.DOMAIN_HEIGHT, 1e-6);
}

export function worldToCss(
  worldX: number,
  worldY: number,
  cssWidth: number,
  cssHeight: number
): { x: number; y: number } {
  const canvasAspect = cssWidth / Math.max(cssHeight, 1e-6);
  let ndcX = (worldX / SIM_CONFIG.DOMAIN_WIDTH) * 2 - 1;
  let ndcY = (worldY / SIM_CONFIG.DOMAIN_HEIGHT) * 2 - 1;
  ndcY *= canvasAspect / domainAspect();
  return {
    x: (ndcX + 1) * 0.5 * cssWidth,
    y: (1 - ndcY) * 0.5 * cssHeight,
  };
}

export function cssToWorld(
  cssX: number,
  cssY: number,
  cssWidth: number,
  cssHeight: number
): { x: number; y: number } {
  const canvasAspect = cssWidth / Math.max(cssHeight, 1e-6);
  let ndcX = (cssX / cssWidth) * 2 - 1;
  let ndcY = 1 - (cssY / cssHeight) * 2;
  ndcY /= canvasAspect / domainAspect();
  return {
    x: ((ndcX + 1) * 0.5) * SIM_CONFIG.DOMAIN_WIDTH,
    y: ((ndcY + 1) * 0.5) * SIM_CONFIG.DOMAIN_HEIGHT,
  };
}
