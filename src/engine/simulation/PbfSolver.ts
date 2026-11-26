import { createGpuBuffer } from '../core/gpuBuffers';
import { buildPbfHeader } from '../shaders/pbfHeader';
import clearHashCode from '../shaders/pbfClearHash.wgsl?raw';
import countHashCode from '../shaders/pbfCountHash.wgsl?raw';
import prefixSumCode from '../shaders/pbfPrefixSum.wgsl?raw';
import scatterHashCode from '../shaders/pbfScatterHash.wgsl?raw';
import integrateCode from '../shaders/pbfIntegrate.wgsl?raw';
import computeLambdaCode from '../shaders/pbfComputeLambda.wgsl?raw';
import computeDeltaCode from '../shaders/pbfComputeDelta.wgsl?raw';
import applyDeltaCode from '../shaders/pbfApplyDelta.wgsl?raw';
import finalizeCode from '../shaders/pbfFinalize.wgsl?raw';
import resolveSolidsCode from '../shaders/pbfResolveSolids.wgsl?raw';
import commitResolveCode from '../shaders/pbfCommitResolve.wgsl?raw';
import {
  leftWallState,
  SIM_CONFIG,
  wavePhaseForWallX,
  type ParticleDerived,
  type WaveParams,
} from './SimConstants';
import {
  spawnBoundary,
  updateLeftWallMotion,
  writeFloorBoundary,
  writeLeftWallBoundary,
  type BoundaryParticles,
} from './spawnBoundary';
import {
  clampPistonTip,
  defaultPistonTip,
  leftWallBase,
  type PistonTip,
} from './pistonGeometry';
import {
  clampFloorShape,
  defaultFloorShape,
  type FloorShape,
} from './tankFloor';

type WallState = { x: number; vx: number };

export class PbfSolver {
  private device: GPUDevice;
  private numParticles: number;
  private numTotal: number;
  private numHashCells: number;
  private derived: ParticleDerived;
  private wave: WaveParams;
  private wavePhaseOffset = 0;
  private simTime = 0;
  private floorShape: FloorShape;
  private pistonTip: PistonTip;
  private boundary: BoundaryParticles;

  private predictedBuffer: GPUBuffer;
  private sortedPredictedBuffer: GPUBuffer;
  private velBuffer: GPUBuffer;
  private foamBuffer: GPUBuffer;
  private lambdaBuffer: GPUBuffer;
  private deltaBuffer: GPUBuffer;
  private cellCountBuffer: GPUBuffer;
  private cellStartBuffer: GPUBuffer;
  private cellParticleBuffer: GPUBuffer;
  private boundaryVelBuffer: GPUBuffer;
  private uniformBuffer: GPUBuffer;
  private uniformData: ArrayBuffer;
  private uniformF32: Float32Array;
  private uniformU32: Uint32Array;

  private clearHashPipeline: GPUComputePipeline;
  private countHashPipeline: GPUComputePipeline;
  private prefixSumPipeline: GPUComputePipeline;
  private scatterHashPipeline: GPUComputePipeline;
  private integratePipeline: GPUComputePipeline;
  private lambdaPipeline: GPUComputePipeline;
  private deltaPipeline: GPUComputePipeline;
  private applyDeltaPipeline: GPUComputePipeline;
  private finalizePipeline: GPUComputePipeline;
  private resolveSolidsPipeline: GPUComputePipeline;
  private commitResolvePipeline: GPUComputePipeline;

  private clearHashBindGroup: GPUBindGroup;
  private countHashBindGroup: GPUBindGroup;
  private prefixSumBindGroup: GPUBindGroup;
  private scatterHashBindGroup: GPUBindGroup;
  private integrateBindGroup: GPUBindGroup;
  private lambdaBindGroup: GPUBindGroup;
  private deltaBindGroup: GPUBindGroup;
  private applyDeltaBindGroup: GPUBindGroup;
  private finalizeBindGroup: GPUBindGroup;
  private resolveSolidsBindGroup: GPUBindGroup;
  private commitResolveBindGroup: GPUBindGroup;

  private header: string;

  constructor(
    device: GPUDevice,
    posBuffer: GPUBuffer,
    numParticles: number,
    derived: ParticleDerived,
    wave: WaveParams,
    floorShape = defaultFloorShape(derived.boundary),
    pistonTip = defaultPistonTip(derived.boundary)
  ) {
    this.device = device;
    this.numParticles = numParticles;
    this.derived = derived;
    this.wave = { ...wave };
    this.floorShape = clampFloorShape(floorShape, derived.boundary);
    this.pistonTip = clampPistonTip(pistonTip, derived.boundary);
    this.boundary = spawnBoundary(
      derived.spacing,
      this.floorShape,
      this.pistonTip
    );
    this.numTotal = numParticles + this.boundary.positions.length / 2;
    this.numHashCells = derived.hashWidth * derived.hashHeight;
    this.header = buildPbfHeader(derived);
    this.uniformData = new ArrayBuffer(64);
    this.uniformF32 = new Float32Array(this.uniformData);
    this.uniformU32 = new Uint32Array(this.uniformData);

    const storage = GPUBufferUsage.STORAGE;
    const storageDst = storage | GPUBufferUsage.COPY_DST;

    this.velBuffer = createGpuBuffer(
      device,
      'PBF Velocity',
      numParticles * 8,
      storageDst,
      new Float32Array(numParticles * 2)
    );
    this.foamBuffer = createGpuBuffer(
      device,
      'PBF Foam',
      Math.max(numParticles * 4, 4),
      storageDst,
      new Float32Array(numParticles)
    );
    this.predictedBuffer = createGpuBuffer(
      device,
      'PBF Predicted Position',
      this.numTotal * 8,
      storageDst
    );
    device.queue.writeBuffer(
      this.predictedBuffer,
      numParticles * 8,
      this.boundary.positions
    );
    this.sortedPredictedBuffer = createGpuBuffer(
      device,
      'PBF Sorted Predicted',
      Math.max(this.numTotal, 1) * 8,
      storage
    );
    this.lambdaBuffer = createGpuBuffer(
      device,
      'PBF Lambda',
      numParticles * 4,
      storage
    );
    this.deltaBuffer = createGpuBuffer(
      device,
      'PBF Delta Position',
      numParticles * 8,
      storage
    );
    this.cellCountBuffer = createGpuBuffer(
      device,
      'PBF Cell Counts',
      this.numHashCells * 4,
      storage
    );
    this.cellStartBuffer = createGpuBuffer(
      device,
      'PBF Cell Starts',
      (this.numHashCells + 1) * 4,
      storage
    );
    this.cellParticleBuffer = createGpuBuffer(
      device,
      'PBF Cell Particles',
      Math.max(this.numTotal, 1) * 4,
      storage
    );
    this.boundaryVelBuffer = createGpuBuffer(
      device,
      'PBF Boundary Velocity',
      Math.max(this.boundary.velocities.byteLength, 8),
      storageDst,
      this.boundary.velocities
    );
    this.uniformBuffer = createGpuBuffer(
      device,
      'PBF Uniforms',
      64,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );
    this.writeUniforms(0);

    this.clearHashPipeline = this.makePipeline('PbfClearHash', clearHashCode);
    this.countHashPipeline = this.makePipeline('PbfCountHash', countHashCode);
    this.prefixSumPipeline = this.makePipeline('PbfPrefixSum', prefixSumCode);
    this.scatterHashPipeline = this.makePipeline('PbfScatterHash', scatterHashCode);
    this.integratePipeline = this.makePipeline('PbfIntegrate', integrateCode);
    this.lambdaPipeline = this.makePipeline('PbfLambda', computeLambdaCode);
    this.deltaPipeline = this.makePipeline('PbfDelta', computeDeltaCode);
    this.applyDeltaPipeline = this.makePipeline('PbfApplyDelta', applyDeltaCode);
    this.finalizePipeline = this.makePipeline('PbfFinalize', finalizeCode);
    this.resolveSolidsPipeline = this.makePipeline(
      'PbfResolveSolids',
      resolveSolidsCode
    );
    this.commitResolvePipeline = this.makePipeline(
      'PbfCommitResolve',
      commitResolveCode
    );

    this.clearHashBindGroup = this.bindGroup(this.clearHashPipeline, [
      this.cellCountBuffer,
    ]);
    this.countHashBindGroup = this.bindGroup(this.countHashPipeline, [
      this.uniformBuffer,
      this.predictedBuffer,
      this.cellCountBuffer,
    ]);
    this.prefixSumBindGroup = this.bindGroup(this.prefixSumPipeline, [
      this.cellCountBuffer,
      this.cellStartBuffer,
    ]);
    this.scatterHashBindGroup = this.bindGroup(this.scatterHashPipeline, [
      this.uniformBuffer,
      this.predictedBuffer,
      this.cellCountBuffer,
      this.cellStartBuffer,
      this.cellParticleBuffer,
      this.sortedPredictedBuffer,
    ]);
    this.integrateBindGroup = this.bindGroup(this.integratePipeline, [
      this.uniformBuffer,
      posBuffer,
      this.velBuffer,
      this.predictedBuffer,
    ]);
    this.lambdaBindGroup = this.bindGroup(this.lambdaPipeline, [
      this.uniformBuffer,
      this.predictedBuffer,
      this.cellStartBuffer,
      this.cellParticleBuffer,
      this.sortedPredictedBuffer,
      this.lambdaBuffer,
    ]);
    this.deltaBindGroup = this.bindGroup(this.deltaPipeline, [
      this.uniformBuffer,
      this.predictedBuffer,
      this.lambdaBuffer,
      this.cellStartBuffer,
      this.cellParticleBuffer,
      this.sortedPredictedBuffer,
      this.deltaBuffer,
    ]);
    this.applyDeltaBindGroup = this.bindGroup(this.applyDeltaPipeline, [
      this.uniformBuffer,
      this.predictedBuffer,
      this.deltaBuffer,
    ]);
    this.finalizeBindGroup = this.bindGroup(this.finalizePipeline, [
      this.uniformBuffer,
      posBuffer,
      this.velBuffer,
      this.predictedBuffer,
      this.cellStartBuffer,
      this.cellParticleBuffer,
      this.sortedPredictedBuffer,
      this.boundaryVelBuffer,
      this.foamBuffer,
    ]);
    this.resolveSolidsBindGroup = this.bindGroup(this.resolveSolidsPipeline, [
      this.uniformBuffer,
      posBuffer,
      this.velBuffer,
      this.predictedBuffer,
    ]);
    this.commitResolveBindGroup = this.bindGroup(this.commitResolvePipeline, [
      this.uniformBuffer,
      posBuffer,
      this.velBuffer,
      this.predictedBuffer,
    ]);
  }

  public setWaveParams(wave: WaveParams): void {
    const wallBase = leftWallBase(this.derived.boundary);
    const before = this.currentWall();
    this.wavePhaseOffset = wavePhaseForWallX(
      before.x,
      before.vx,
      wave.amplitude,
      wave.periodSeconds,
      wallBase,
      this.simTime
    );
    this.wave = { ...wave };
  }

  public getFoamBuffer(): GPUBuffer {
    return this.foamBuffer;
  }

  public getLeftWallX(): number {
    return this.currentWall().x;
  }

  public setPistonTip(tip: PistonTip, clearVelocities = false): void {
    this.pistonTip = clampPistonTip(tip, this.derived.boundary);
    const wall = this.currentWall();
    writeLeftWallBoundary(
      this.boundary,
      wall.x,
      wall.vx,
      this.pistonTip,
      this.derived.boundary
    );
    this.uploadBoundaryGpu();
    if (clearVelocities) {
      this.resolveSolidEdit(true);
    } else {
      this.writeUniforms(this.simTime);
    }
  }

  public setFloorShape(floorShape: FloorShape, clearVelocities = false): void {
    this.floorShape = clampFloorShape(floorShape, this.derived.boundary);
    writeFloorBoundary(
      this.boundary,
      this.derived.spacing,
      this.derived.boundary,
      this.floorShape
    );
    this.uploadBoundaryGpu();
    if (clearVelocities) {
      this.resolveSolidEdit(true);
    } else {
      this.writeUniforms(this.simTime);
    }
  }

  private makePipeline(label: string, body: string): GPUComputePipeline {
    const module = this.device.createShaderModule({
      label: `${label} Shader`,
      code: `${this.header}\n${body}`,
    });
    return this.device.createComputePipeline({
      label: `${label} Pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });
  }

  private bindGroup(
    pipeline: GPUComputePipeline,
    buffers: GPUBuffer[]
  ): GPUBindGroup {
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: buffers.map((buffer, binding) => ({
        binding,
        resource: { buffer },
      })),
    });
  }

  private currentWall(timeSeconds = this.simTime): WallState {
    return leftWallState(
      timeSeconds,
      this.wave.amplitude,
      this.wave.periodSeconds,
      leftWallBase(this.derived.boundary),
      this.wavePhaseOffset
    );
  }

  private uploadBoundaryGpu(): void {
    this.device.queue.writeBuffer(
      this.predictedBuffer,
      this.numParticles * 8,
      this.boundary.positions
    );
    this.device.queue.writeBuffer(
      this.boundaryVelBuffer,
      0,
      this.boundary.velocities
    );
  }

  private uploadLeftWallGpu(): void {
    const byteOffset = this.boundary.numStatic * 8;
    const wallFloats = this.boundary.numLeftWall * 2;
    this.device.queue.writeBuffer(
      this.predictedBuffer,
      this.numParticles * 8 + byteOffset,
      this.boundary.positions,
      this.boundary.numStatic * 2,
      wallFloats
    );
    this.device.queue.writeBuffer(
      this.boundaryVelBuffer,
      byteOffset,
      this.boundary.velocities,
      this.boundary.numStatic * 2,
      wallFloats
    );
  }

  private syncLeftWall(timeSeconds: number): void {
    const wall = this.currentWall(timeSeconds);
    updateLeftWallMotion(this.boundary, wall.x, wall.vx);
    this.uploadLeftWallGpu();
  }

  private writeUniforms(timeSeconds: number, dt = SIM_CONFIG.DT): void {
    const wall = this.currentWall(timeSeconds);
    const f32 = this.uniformF32;
    const u32 = this.uniformU32;
    f32[0] = dt;
    f32[1] = SIM_CONFIG.GRAVITY;
    u32[2] = this.numParticles;
    u32[3] = this.numTotal;
    f32[4] = wall.x;
    f32[5] = wall.vx;
    f32[6] = this.floorShape.rightY;
    f32[7] = this.floorShape.midX;
    f32[8] = this.floorShape.midY;
    f32[9] = this.floorShape.pivotX;
    const peakSpeed =
      this.wave.amplitude *
      ((2 * Math.PI) / Math.max(this.wave.periodSeconds, 0.05));
    f32[10] = Math.max(6, peakSpeed * 0.4);
    f32[11] = Math.max(f32[10] + 6, peakSpeed * 0.95);
    f32[12] = Math.max(10, peakSpeed * 0.8);
    f32[13] = Math.max(f32[12] + 8, peakSpeed * 1.45);
    f32[14] = this.pistonTip.y;
    f32[15] = this.pistonTip.offsetX;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
  }

  private dispatchConstraintIterations(
    pass: GPUComputePassEncoder,
    particleGroups: number
  ): void {
    for (let iter = 0; iter < SIM_CONFIG.SOLVER_ITERATIONS; iter++) {
      pass.setPipeline(this.lambdaPipeline);
      pass.setBindGroup(0, this.lambdaBindGroup);
      pass.dispatchWorkgroups(particleGroups);

      pass.setPipeline(this.deltaPipeline);
      pass.setBindGroup(0, this.deltaBindGroup);
      pass.dispatchWorkgroups(particleGroups);

      pass.setPipeline(this.applyDeltaPipeline);
      pass.setBindGroup(0, this.applyDeltaBindGroup);
      pass.dispatchWorkgroups(particleGroups);

      this.dispatchHash(pass);
    }
  }

  public resolveSolidEdit(clearVelocities: boolean): void {
    this.writeUniforms(this.simTime, clearVelocities ? 0 : SIM_CONFIG.DT);

    const particleGroups = Math.ceil(this.numParticles / 64);
    const commandEncoder = this.device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();

    for (let round = 0; round < 2; round++) {
      pass.setPipeline(this.resolveSolidsPipeline);
      pass.setBindGroup(0, this.resolveSolidsBindGroup);
      pass.dispatchWorkgroups(particleGroups);

      this.dispatchHash(pass);
      this.dispatchConstraintIterations(pass, particleGroups);
    }

    pass.setPipeline(this.commitResolvePipeline);
    pass.setBindGroup(0, this.commitResolveBindGroup);
    pass.dispatchWorkgroups(particleGroups);
    pass.end();

    this.device.queue.submit([commandEncoder.finish()]);
    this.writeUniforms(this.simTime);
  }

  private dispatchHash(pass: GPUComputePassEncoder): void {
    const hashGroups = Math.ceil(this.numHashCells / 64);
    const totalGroups = Math.ceil(this.numTotal / 64);

    pass.setPipeline(this.clearHashPipeline);
    pass.setBindGroup(0, this.clearHashBindGroup);
    pass.dispatchWorkgroups(hashGroups);

    pass.setPipeline(this.countHashPipeline);
    pass.setBindGroup(0, this.countHashBindGroup);
    pass.dispatchWorkgroups(totalGroups);

    pass.setPipeline(this.prefixSumPipeline);
    pass.setBindGroup(0, this.prefixSumBindGroup);
    pass.dispatchWorkgroups(1);

    pass.setPipeline(this.scatterHashPipeline);
    pass.setBindGroup(0, this.scatterHashBindGroup);
    pass.dispatchWorkgroups(totalGroups);
  }

  public step(commandEncoder: GPUCommandEncoder): void {
    const particleGroups = Math.ceil(this.numParticles / 64);
    const uniformTime =
      this.simTime + (SIM_CONFIG.SUBSTEPS - 1) * SIM_CONFIG.DT;
    this.syncLeftWall(uniformTime);
    this.writeUniforms(uniformTime);

    for (let s = 0; s < SIM_CONFIG.SUBSTEPS; s++) {
      this.simTime += SIM_CONFIG.DT;

      const pass = commandEncoder.beginComputePass();

      pass.setPipeline(this.integratePipeline);
      pass.setBindGroup(0, this.integrateBindGroup);
      pass.dispatchWorkgroups(particleGroups);

      this.dispatchHash(pass);
      this.dispatchConstraintIterations(pass, particleGroups);

      pass.setPipeline(this.finalizePipeline);
      pass.setBindGroup(0, this.finalizeBindGroup);
      pass.dispatchWorkgroups(particleGroups);

      pass.end();
    }
  }

  public destroy(): void {
    this.velBuffer.destroy();
    this.foamBuffer.destroy();
    this.predictedBuffer.destroy();
    this.sortedPredictedBuffer.destroy();
    this.lambdaBuffer.destroy();
    this.deltaBuffer.destroy();
    this.cellCountBuffer.destroy();
    this.cellStartBuffer.destroy();
    this.cellParticleBuffer.destroy();
    this.boundaryVelBuffer.destroy();
    this.uniformBuffer.destroy();
  }
}
