export const SIM_CONFIG = {
  GRID_WIDTH: 64,
  GRID_HEIGHT: 64,
  PARTICLE_RADIUS: 0.35,  // In grid units
  SUBSTEPS: 8,            // 8 physics substeps per rendered frame
  DT: 0.0025,             // Substep timestep (keeps CFL condition safe)
  FIXED_POINT: 65536.0,   // 2^16 fixed-point multiplier for atomicAdd
  GRAVITY: -25.0,
  STIFFNESS: 80.0,        // Incompressibility resistance
  VISCOSITY: 0.05,        // Subtle damping to keep splashes stable
} as const;