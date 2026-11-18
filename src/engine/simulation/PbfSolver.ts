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
import {
  leftWallState,
  SIM_CONFIG,
  type ParticleDerived,
  type WaveParams,
} from './SimConstants';
import {
  spawnBoundary,
  writeFloorBoundary,
  writeLeftWallBoundary,
  type BoundaryParticles,
} from './spawnBoundary';
import {
  clampFloorShape,
  defaultFloorShape,
  type FloorShape,
} from './tankFloor';

export class PbfSolver {
  private device: GPUDevice;
  private numParticles: number;
  private numTotal: number;
  private numHashCells: number;
  private derived: ParticleDerived;
  private wave: WaveParams;
  private simTime = 0;
  private floorShape: FloorShape;
  private boundary: BoundaryParticles;

  private predictedBuffer: GPUBuffer;
  private velBuffer: GPUBuffer;
  private lambdaBuffer: GPUBuffer;
  private deltaBuffer: GPUBuffer;
  private cellCountBuffer: GPUBuffer;
  private cellStartBuffer: GPUBuffer;
  private cellParticleBuffer: GPUBuffer;
  private boundaryVelBuffer: GPUBuffer;
  private uniformBuffer: GPUBuffer;

  private clearHashPipeline: GPUComputePipeline;
  private countHashPipeline: GPUComputePipeline;
  private prefixSumPipeline: GPUComputePipeline;
  private scatterHashPipeline: GPUComputePipeline;
  private integratePipeline: GPUComputePipeline;
  private lambdaPipeline: GPUComputePipeline;
  private deltaPipeline: GPUComputePipeline;
  private applyDeltaPipeline: GPUComputePipeline;
  private finalizePipeline: GPUComputePipeline;

  private clearHashBindGroup: GPUBindGroup;
  private countHashBindGroup: GPUBindGroup;
  private prefixSumBindGroup: GPUBindGroup;
  private scatterHashBindGroup: GPUBindGroup;
  private integrateBindGroup: GPUBindGroup;
  private lambdaBindGroup: GPUBindGroup;
  private deltaBindGroup: GPUBindGroup;
  private applyDeltaBindGroup: GPUBindGroup;
  private finalizeBindGroup: GPUBindGroup;

  private header: string;

  constructor(
    device: GPUDevice,
    posBuffer: GPUBuffer,
    numParticles: number,
    derived: ParticleDerived,
    wave: WaveParams,
    floorShape = defaultFloorShape(derived.boundary)
  ) {
    this.device = device;
    this.numParticles = numParticles;
    this.derived = derived;
    this.wave = { ...wave };
    this.floorShape = clampFloorShape(floorShape, derived.boundary);
    this.boundary = spawnBoundary(derived.spacing, this.floorShape);
    this.numTotal = numParticles + this.boundary.positions.length / 2;
    this.numHashCells = derived.hashWidth * derived.hashHeight;
    this.header = buildPbfHeader(derived);

    this.velBuffer = device.createBuffer({
      label: 'PBF Velocity',
      size: numParticles * 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.velBuffer, 0, new Float32Array(numParticles * 2));

    this.predictedBuffer = device.createBuffer({
      label: 'PBF Predicted Position',
      size: this.numTotal * 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      this.predictedBuffer,
      numParticles * 8,
      this.boundary.positions
    );

    this.lambdaBuffer = device.createBuffer({
      label: 'PBF Lambda',
      size: numParticles * 4,
      usage: GPUBufferUsage.STORAGE,
    });

    this.deltaBuffer = device.createBuffer({
      label: 'PBF Delta Position',
      size: numParticles * 8,
      usage: GPUBufferUsage.STORAGE,
    });

    this.cellCountBuffer = device.createBuffer({
      label: 'PBF Cell Counts',
      size: this.numHashCells * 4,
      usage: GPUBufferUsage.STORAGE,
    });

    this.cellStartBuffer = device.createBuffer({
      label: 'PBF Cell Starts',
      size: this.numHashCells * 4,
      usage: GPUBufferUsage.STORAGE,
    });

    this.cellParticleBuffer = device.createBuffer({
      label: 'PBF Cell Particles',
      size: Math.max(this.numTotal, 1) * 4,
      usage: GPUBufferUsage.STORAGE,
    });

    this.boundaryVelBuffer = device.createBuffer({
      label: 'PBF Boundary Velocity',
      size: Math.max(this.boundary.velocities.byteLength, 8),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      this.boundaryVelBuffer,
      0,
      this.boundary.velocities
    );

    this.uniformBuffer = device.createBuffer({
      label: 'PBF Uniforms',
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
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

    this.clearHashBindGroup = device.createBindGroup({
      layout: this.clearHashPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.cellCountBuffer } }],
    });

    this.countHashBindGroup = device.createBindGroup({
      layout: this.countHashPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.predictedBuffer } },
        { binding: 2, resource: { buffer: this.cellCountBuffer } },
      ],
    });

    this.prefixSumBindGroup = device.createBindGroup({
      layout: this.prefixSumPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cellCountBuffer } },
        { binding: 1, resource: { buffer: this.cellStartBuffer } },
      ],
    });

    this.scatterHashBindGroup = device.createBindGroup({
      layout: this.scatterHashPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.predictedBuffer } },
        { binding: 2, resource: { buffer: this.cellCountBuffer } },
        { binding: 3, resource: { buffer: this.cellStartBuffer } },
        { binding: 4, resource: { buffer: this.cellParticleBuffer } },
      ],
    });

    this.integrateBindGroup = device.createBindGroup({
      layout: this.integratePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: posBuffer } },
        { binding: 2, resource: { buffer: this.velBuffer } },
        { binding: 3, resource: { buffer: this.predictedBuffer } },
      ],
    });

    this.lambdaBindGroup = device.createBindGroup({
      layout: this.lambdaPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.predictedBuffer } },
        { binding: 2, resource: { buffer: this.cellCountBuffer } },
        { binding: 3, resource: { buffer: this.cellStartBuffer } },
        { binding: 4, resource: { buffer: this.cellParticleBuffer } },
        { binding: 5, resource: { buffer: this.lambdaBuffer } },
      ],
    });

    this.deltaBindGroup = device.createBindGroup({
      layout: this.deltaPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.predictedBuffer } },
        { binding: 2, resource: { buffer: this.lambdaBuffer } },
        { binding: 3, resource: { buffer: this.cellCountBuffer } },
        { binding: 4, resource: { buffer: this.cellStartBuffer } },
        { binding: 5, resource: { buffer: this.cellParticleBuffer } },
        { binding: 6, resource: { buffer: this.deltaBuffer } },
      ],
    });

    this.applyDeltaBindGroup = device.createBindGroup({
      layout: this.applyDeltaPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.predictedBuffer } },
        { binding: 2, resource: { buffer: this.deltaBuffer } },
      ],
    });

    this.finalizeBindGroup = device.createBindGroup({
      layout: this.finalizePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: posBuffer } },
        { binding: 2, resource: { buffer: this.velBuffer } },
        { binding: 3, resource: { buffer: this.predictedBuffer } },
        { binding: 4, resource: { buffer: this.cellCountBuffer } },
        { binding: 5, resource: { buffer: this.cellStartBuffer } },
        { binding: 6, resource: { buffer: this.cellParticleBuffer } },
        { binding: 7, resource: { buffer: this.boundaryVelBuffer } },
      ],
    });
  }

  public setWaveParams(wave: WaveParams): void {
    this.wave = { ...wave };
  }

  public getFloorShape(): FloorShape {
    return { ...this.floorShape };
  }

  public setFloorShape(floorShape: FloorShape): void {
    this.floorShape = clampFloorShape(floorShape, this.derived.boundary);
    writeFloorBoundary(
      this.boundary,
      this.derived.spacing,
      this.derived.boundary,
      this.floorShape
    );
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
    this.writeUniforms(this.simTime);
  }

  public resetTime(): void {
    this.simTime = 0;
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

  private syncBoundary(timeSeconds: number): void {
    const wall = leftWallState(
      timeSeconds,
      this.wave.amplitude,
      this.wave.periodSeconds,
      this.derived.boundary
    );
    writeFloorBoundary(
      this.boundary,
      this.derived.spacing,
      this.derived.boundary,
      this.floorShape
    );
    writeLeftWallBoundary(this.boundary, wall.x, wall.vx);
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

  private writeUniforms(timeSeconds: number): void {
    const wall = leftWallState(
      timeSeconds,
      this.wave.amplitude,
      this.wave.periodSeconds,
      this.derived.boundary
    );
    const data = new ArrayBuffer(48);
    const f32 = new Float32Array(data);
    const u32 = new Uint32Array(data);
    f32[0] = SIM_CONFIG.DT;
    f32[1] = SIM_CONFIG.GRAVITY;
    u32[2] = this.numParticles;
    u32[3] = this.numTotal;
    f32[4] = wall.x;
    f32[5] = wall.vx;
    f32[6] = this.floorShape.rightY;
    f32[7] = this.floorShape.midX;
    f32[8] = this.floorShape.midY;
    f32[9] = this.floorShape.pivotX;
    f32[10] = 0;
    f32[11] = 0;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
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

    for (let s = 0; s < SIM_CONFIG.SUBSTEPS; s++) {
      this.syncBoundary(this.simTime);
      this.writeUniforms(this.simTime);
      this.simTime += SIM_CONFIG.DT;

      const pass = commandEncoder.beginComputePass();

      pass.setPipeline(this.integratePipeline);
      pass.setBindGroup(0, this.integrateBindGroup);
      pass.dispatchWorkgroups(particleGroups);

      this.dispatchHash(pass);

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

      pass.setPipeline(this.finalizePipeline);
      pass.setBindGroup(0, this.finalizeBindGroup);
      pass.dispatchWorkgroups(particleGroups);

      pass.end();
    }
  }

  public destroy(): void {
    this.velBuffer.destroy();
    this.predictedBuffer.destroy();
    this.lambdaBuffer.destroy();
    this.deltaBuffer.destroy();
    this.cellCountBuffer.destroy();
    this.cellStartBuffer.destroy();
    this.cellParticleBuffer.destroy();
    this.boundaryVelBuffer.destroy();
    this.uniformBuffer.destroy();
  }
}
