export const SIM_CONFIG = {
  GRID_WIDTH: 64,
  GRID_HEIGHT: 64,
  PARTICLE_RADIUS: 0.35,
  SUBSTEPS: 12,
  DT: 0.001,
  FIXED_POINT: 65536.0,
  GRAVITY: -9.8,
  STIFFNESS: 600.0,   // Cuts hydrostatic compression drop from ~10% down to ~3%
  VISCOSITY: 0.4,
} as const;