import { COMPUTE_HEADER } from '../shaders/shaderHeader';
import clearGridCode from '../shaders/clearGrid.wgsl?raw';
import p2gCode from '../shaders/p2g.wgsl?raw';
import updateGridCode from '../shaders/updateGrid.wgsl?raw';
import g2pCode from '../shaders/g2p.wgsl?raw';
import { SIM_CONFIG } from './SimConstants';

export class MlsMpmSolver {
  private device: GPUDevice;
  private numParticles: number;
  private numGridCells: number;

  private velBuffer: GPUBuffer;
  private cMatrixBuffer: GPUBuffer;
  private jBuffer: GPUBuffer;
  private gridBuffer: GPUBuffer;
  private uniformBuffer: GPUBuffer;

  private clearPipeline: GPUComputePipeline;
  private p2gPipeline: GPUComputePipeline;
  private updateGridPipeline: GPUComputePipeline;
  private g2pPipeline: GPUComputePipeline;

  private clearBindGroup: GPUBindGroup;
  private p2gBindGroup: GPUBindGroup;
  private updateGridBindGroup: GPUBindGroup;
  private g2pBindGroup: GPUBindGroup;

  constructor(device: GPUDevice, posBuffer: GPUBuffer, jArray: Float32Array, numParticles: number) {
    this.device = device;
    this.numParticles = numParticles;
    this.numGridCells = SIM_CONFIG.GRID_WIDTH * SIM_CONFIG.GRID_HEIGHT;

    // 1. Allocate SoA particle buffers
    this.velBuffer = device.createBuffer({
      label: 'Velocity Buffer',
      size: numParticles * 2 * 4, // vec2f
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.cMatrixBuffer = device.createBuffer({
      label: 'Affine C Matrix Buffer',
      size: numParticles * 4 * 4, // mat2x2f (4 floats)
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.jBuffer = device.createBuffer({
        label: 'Volume Ratio J Buffer',
        size: jArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    device.queue.writeBuffer(this.jBuffer, 0, jArray);

    // 2. Grid buffer: 3 x i32 (12 bytes) per cell
    this.gridBuffer = device.createBuffer({
      label: 'Simulation Grid Buffer',
      size: this.numGridCells * 3 * 4,
      usage: GPUBufferUsage.STORAGE,
    });

    // 3. Uniform buffer (dt, gravity, stiffness, viscosity = 16 bytes)
    this.uniformBuffer = device.createBuffer({
      label: 'Physics Uniform Buffer',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.writeUniforms();

    // 4. Create compute pipelines
    this.clearPipeline = this.makePipeline('ClearGrid', clearGridCode);
    this.p2gPipeline = this.makePipeline('P2G', p2gCode);
    this.updateGridPipeline = this.makePipeline('UpdateGrid', updateGridCode);
    this.g2pPipeline = this.makePipeline('G2P', g2pCode);

    // 5. Create bind groups
    this.clearBindGroup = device.createBindGroup({
      layout: this.clearPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.gridBuffer } }],
    });

    this.p2gBindGroup = device.createBindGroup({
      layout: this.p2gPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: posBuffer } },
        { binding: 2, resource: { buffer: this.velBuffer } },
        { binding: 3, resource: { buffer: this.cMatrixBuffer } },
        { binding: 4, resource: { buffer: this.jBuffer } },
        { binding: 5, resource: { buffer: this.gridBuffer } },
      ],
    });

    this.updateGridBindGroup = device.createBindGroup({
      layout: this.updateGridPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.gridBuffer } },
      ],
    });

    this.g2pBindGroup = device.createBindGroup({
      layout: this.g2pPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: posBuffer } },
        { binding: 2, resource: { buffer: this.velBuffer } },
        { binding: 3, resource: { buffer: this.cMatrixBuffer } },
        { binding: 4, resource: { buffer: this.jBuffer } },
        { binding: 5, resource: { buffer: this.gridBuffer } },
      ],
    });
  }

  private makePipeline(label: string, rawWgsl: string): GPUComputePipeline {
    const module = this.device.createShaderModule({
      label: `${label} Shader`,
      code: `${COMPUTE_HEADER}\n${rawWgsl}`,
    });
    return this.device.createComputePipeline({
      label: `${label} Pipeline`,
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });
  }

  private writeUniforms(): void {
    const data = new Float32Array([
      SIM_CONFIG.DT,
      SIM_CONFIG.GRAVITY,
      SIM_CONFIG.STIFFNESS,
      SIM_CONFIG.VISCOSITY,
    ]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  public step(commandEncoder: GPUCommandEncoder): void {
    const gridGroups = Math.ceil(this.numGridCells / 64);
    const particleGroups = Math.ceil(this.numParticles / 64);

    for (let s = 0; s < SIM_CONFIG.SUBSTEPS; s++) {
      const pass = commandEncoder.beginComputePass();

      pass.setPipeline(this.clearPipeline);
      pass.setBindGroup(0, this.clearBindGroup);
      pass.dispatchWorkgroups(gridGroups);

      pass.setPipeline(this.p2gPipeline);
      pass.setBindGroup(0, this.p2gBindGroup);
      pass.dispatchWorkgroups(particleGroups);

      pass.setPipeline(this.updateGridPipeline);
      pass.setBindGroup(0, this.updateGridBindGroup);
      pass.dispatchWorkgroups(gridGroups);

      pass.setPipeline(this.g2pPipeline);
      pass.setBindGroup(0, this.g2pBindGroup);
      pass.dispatchWorkgroups(particleGroups);

      pass.end();
    }
  }

  public destroy(): void {
    this.velBuffer.destroy();
    this.cMatrixBuffer.destroy();
    this.jBuffer.destroy();
    this.gridBuffer.destroy();
    this.uniformBuffer.destroy();
  }
}