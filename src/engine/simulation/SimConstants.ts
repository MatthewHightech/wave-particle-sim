export const SIM_CONFIG = {
  GRID_WIDTH: 64,
  GRID_HEIGHT: 64,
  PARTICLE_RADIUS: 0.35,
  SUBSTEPS: 10,           // More substeps allows higher stiffness safely
  DT: 0.0015,             // Smaller dt keeps wave speed within CFL limit
  FIXED_POINT: 65536.0,
  GRAVITY: -9.8,          // Standard gravity (instead of -25)
  STIFFNESS: 400.0,       // 5x stiffer so the water column supports its own weight
  VISCOSITY: 0.1,         // Slight damping helps the tank settle quickly
} as const;