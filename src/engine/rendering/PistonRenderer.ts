import pistonShaderCode from '../shaders/piston.wgsl?raw';
import {
  pistonHeightRange,
  pistonMaxWallX,
  SIM_CONFIG,
} from '../simulation/SimConstants';
import {
  clampPistonTip,
  type PistonTip,
} from '../simulation/pistonGeometry';

export class PistonRenderer {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private uniformBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;
  private beamWidth: number;
  private housingRight: number;
  private rodHeight: number;
  private yMin: number;
  private yMax: number;
  private boundary: number;

  constructor(device: GPUDevice, format: GPUTextureFormat, boundary: number) {
    this.device = device;
    this.boundary = boundary;
    this.beamWidth = SIM_CONFIG.PISTON_BEAM_WIDTH;
    this.rodHeight = SIM_CONFIG.PISTON_ROD_HEIGHT;
    this.housingRight = pistonMaxWallX(boundary);
    const height = pistonHeightRange(boundary);
    this.yMin = height.yMin;
    this.yMax = height.yMax;

    this.uniformBuffer = device.createBuffer({
      label: 'Piston Uniform Buffer',
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({
      label: 'Piston Shader',
      code: pistonShaderCode,
    });

    this.pipeline = device.createRenderPipeline({
      label: 'Piston Pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    this.bindGroup = device.createBindGroup({
      label: 'Piston BindGroup',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });
  }

  public render(
    renderPass: GPURenderPassEncoder,
    width: number,
    height: number,
    wallX: number,
    tip: PistonTip
  ): void {
    const clamped = clampPistonTip(tip, this.boundary);
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      new Float32Array([
        SIM_CONFIG.DOMAIN_WIDTH,
        SIM_CONFIG.DOMAIN_HEIGHT,
        width / height,
        wallX,
        this.beamWidth,
        this.housingRight,
        this.yMin,
        this.yMax,
        clamped.y,
        clamped.offsetX,
        this.rodHeight,
        0,
      ])
    );

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(21);
  }

  public destroy(): void {
    this.uniformBuffer.destroy();
  }
}
