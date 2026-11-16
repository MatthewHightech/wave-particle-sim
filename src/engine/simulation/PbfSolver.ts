import { PBF_HEADER } from '../shaders/pbfHeader';
import clearHashCode from '../shaders/pbfClearHash.wgsl?raw';
import buildHashCode from '../shaders/pbfBuildHash.wgsl?raw';
import integrateCode from '../shaders/pbfIntegrate.wgsl?raw';
import computeLambdaCode from '../shaders/pbfComputeLambda.wgsl?raw';
import computeDeltaCode from '../shaders/pbfComputeDelta.wgsl?raw';
import applyDeltaCode from '../shaders/pbfApplyDelta.wgsl?raw';
import finalizeCode from '../shaders/pbfFinalize.wgsl?raw';
import { SIM_CONFIG } from './SimConstants';

export class PbfSolver {
  private device: GPUDevice;
  private numParticles: number;
  private numHashCells: number;

  private velBuffer: GPUBuffer;
  private predictedBuffer: GPUBuffer;
  private lambdaBuffer: GPUBuffer;
  private deltaBuffer: GPUBuffer;
  private cellCountBuffer: GPUBuffer;
  private cellParticleBuffer: GPUBuffer;
  private uniformBuffer: GPUBuffer;

  private clearHashPipeline: GPUComputePipeline;
  private buildHashPipeline: GPUComputePipeline;
  private integratePipeline: GPUComputePipeline;
  private lambdaPipeline: GPUComputePipeline;
  private deltaPipeline: GPUComputePipeline;
  private applyDeltaPipeline: GPUComputePipeline;
  private finalizePipeline: GPUComputePipeline;

  private clearHashBindGroup: GPUBindGroup;
  private buildHashBindGroup: GPUBindGroup;
  private integrateBindGroup: GPUBindGroup;
  private lambdaBindGroup: GPUBindGroup;
  private deltaBindGroup: GPUBindGroup;
  private applyDeltaBindGroup: GPUBindGroup;
  private finalizeBindGroup: GPUBindGroup;

  constructor(device: GPUDevice, posBuffer: GPUBuffer, numParticles: number) {
    this.device = device;
    this.numParticles = numParticles;
    this.numHashCells = SIM_CONFIG.HASH_WIDTH * SIM_CONFIG.HASH_HEIGHT;

    this.velBuffer = device.createBuffer({
      label: 'PBF Velocity',
      size: numParticles * 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.velBuffer, 0, new Float32Array(numParticles * 2));

    this.predictedBuffer = device.createBuffer({
      label: 'PBF Predicted Position',
      size: numParticles * 8,
      usage: GPUBufferUsage.STORAGE,
    });

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

    this.cellParticleBuffer = device.createBuffer({
      label: 'PBF Cell Particles',
      size: this.numHashCells * SIM_CONFIG.MAX_PER_CELL * 4,
      usage: GPUBufferUsage.STORAGE,
    });

    this.uniformBuffer = device.createBuffer({
      label: 'PBF Uniforms',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.writeUniforms();

    this.clearHashPipeline = this.makePipeline('PbfClearHash', clearHashCode);
    this.buildHashPipeline = this.makePipeline('PbfBuildHash', buildHashCode);
    this.integratePipeline = this.makePipeline('PbfIntegrate', integrateCode);
    this.lambdaPipeline = this.makePipeline('PbfLambda', computeLambdaCode);
    this.deltaPipeline = this.makePipeline('PbfDelta', computeDeltaCode);
    this.applyDeltaPipeline = this.makePipeline('PbfApplyDelta', applyDeltaCode);
    this.finalizePipeline = this.makePipeline('PbfFinalize', finalizeCode);

    this.clearHashBindGroup = device.createBindGroup({
      layout: this.clearHashPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.cellCountBuffer } }],
    });

    this.buildHashBindGroup = device.createBindGroup({
      layout: this.buildHashPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.predictedBuffer } },
        { binding: 2, resource: { buffer: this.cellCountBuffer } },
        { binding: 3, resource: { buffer: this.cellParticleBuffer } },
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
        { binding: 3, resource: { buffer: this.cellParticleBuffer } },
        { binding: 4, resource: { buffer: this.lambdaBuffer } },
      ],
    });

    this.deltaBindGroup = device.createBindGroup({
      layout: this.deltaPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.predictedBuffer } },
        { binding: 2, resource: { buffer: this.lambdaBuffer } },
        { binding: 3, resource: { buffer: this.cellCountBuffer } },
        { binding: 4, resource: { buffer: this.cellParticleBuffer } },
        { binding: 5, resource: { buffer: this.deltaBuffer } },
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
        { binding: 5, resource: { buffer: this.cellParticleBuffer } },
      ],
    });
  }

  private makePipeline(label: string, body: string): GPUComputePipeline {
    const module = this.device.createShaderModule({
      label: `${label} Shader`,
      code: `${PBF_HEADER}\n${body}`,
    });
    return this.device.createComputePipeline({
      label: `${label} Pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });
  }

  private writeUniforms(): void {
    const data = new ArrayBuffer(16);
    const f32 = new Float32Array(data);
    const u32 = new Uint32Array(data);
    f32[0] = SIM_CONFIG.DT;
    f32[1] = SIM_CONFIG.GRAVITY;
    u32[2] = this.numParticles;
    u32[3] = 0;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  private dispatchHash(pass: GPUComputePassEncoder): void {
    const hashGroups = Math.ceil(this.numHashCells / 64);
    const particleGroups = Math.ceil(this.numParticles / 64);

    pass.setPipeline(this.clearHashPipeline);
    pass.setBindGroup(0, this.clearHashBindGroup);
    pass.dispatchWorkgroups(hashGroups);

    pass.setPipeline(this.buildHashPipeline);
    pass.setBindGroup(0, this.buildHashBindGroup);
    pass.dispatchWorkgroups(particleGroups);
  }

  public step(commandEncoder: GPUCommandEncoder): void {
    const particleGroups = Math.ceil(this.numParticles / 64);

    for (let s = 0; s < SIM_CONFIG.SUBSTEPS; s++) {
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
    this.cellParticleBuffer.destroy();
    this.uniformBuffer.destroy();
  }
}
