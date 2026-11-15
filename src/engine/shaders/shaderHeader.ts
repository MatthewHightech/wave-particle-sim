import { SIM_CONFIG } from '../simulation/SimConstants';

export const COMPUTE_HEADER = /* wgsl */ `
const GRID_WIDTH: i32 = ${SIM_CONFIG.GRID_WIDTH};
const GRID_HEIGHT: i32 = ${SIM_CONFIG.GRID_HEIGHT};
const FIXED_POINT: f32 = ${SIM_CONFIG.FIXED_POINT.toFixed(1)};

struct GridNode {
  vx: atomic<i32>,
  vy: atomic<i32>,
  mass: atomic<i32>,
};

struct PhysicsUniforms {
  dt: f32,
  gravity: f32,
  stiffness: f32,
  viscosity: f32,
};
`;