import { SIM_CONFIG } from './SimConstants';

const VIEW_BOTTOM_PAD = SIM_CONFIG.DOMAIN_HEIGHT * 0.2;
const VIEW_EDGE_INSET_PX = 30;

export type ViewTransform = {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
};

function viewSize(): { width: number; height: number } {
  return {
    width: SIM_CONFIG.DOMAIN_WIDTH,
    height: SIM_CONFIG.DOMAIN_HEIGHT + VIEW_BOTTOM_PAD,
  };
}

export function computeViewTransform(
  cssWidth: number,
  cssHeight: number
): ViewTransform {
  const size = viewSize();
  const width = Math.max(cssWidth, 1);
  const height = Math.max(cssHeight, 1);
  const insetL = 0;
  const insetR = VIEW_EDGE_INSET_PX;
  const insetT = VIEW_EDGE_INSET_PX;
  const insetB = VIEW_EDGE_INSET_PX;
  const contentW = Math.max(width - insetL - insetR, 1);
  const contentH = Math.max(height - insetT - insetB, 1);
  const scalePx = Math.min(contentW / size.width, contentH / size.height);
  const usedH = size.height * scalePx;
  const originCssX = insetL;
  const originCssY = insetT + (contentH - usedH);

  const scaleX = (2 * scalePx) / width;
  const scaleY = (2 * scalePx) / height;

  return {
    scaleX,
    scaleY,
    offsetX: (2 * originCssX) / width - 1,
    offsetY:
      1 -
      (2 * (originCssY + usedH)) / height +
      scaleY * VIEW_BOTTOM_PAD,
  };
}

function worldToNdc(
  worldX: number,
  worldY: number,
  cssWidth: number,
  cssHeight: number
): { x: number; y: number } {
  const view = computeViewTransform(cssWidth, cssHeight);
  return {
    x: worldX * view.scaleX + view.offsetX,
    y: worldY * view.scaleY + view.offsetY,
  };
}

function ndcToWorld(
  ndcX: number,
  ndcY: number,
  cssWidth: number,
  cssHeight: number
): { x: number; y: number } {
  const view = computeViewTransform(cssWidth, cssHeight);
  return {
    x: (ndcX - view.offsetX) / view.scaleX,
    y: (ndcY - view.offsetY) / view.scaleY,
  };
}

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

export function viewProjectionWgsl(): string {
  return `
fn world_to_ndc(worldPos: vec2f, viewScale: vec2f, viewOffset: vec2f) -> vec2f {
  return worldPos * viewScale + viewOffset;
}

fn ndc_to_world(ndc: vec2f, viewScale: vec2f, viewOffset: vec2f) -> vec2f {
  return (ndc - viewOffset) / viewScale;
}
`;
}
