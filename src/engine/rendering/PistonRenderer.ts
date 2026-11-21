import pistonShaderCode from '../shaders/piston.wgsl?raw';
import {
  pistonHeightRange,
  pistonSealBottomY,
  SIM_CONFIG,
} from '../simulation/SimConstants';
import {
  clampPistonTip,
  type PistonTip,
} from '../simulation/pistonGeometry';
import {
  computeViewTransform,
  viewProjectionWgsl,
} from '../simulation/viewProjection';

export class PistonRenderer {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private uniformBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;
  private beamWidth: number;
  private rodHeight: number;
  private yBottom: number;
  private yMin: number;
  private yMax: number;
  private boundary: number;

  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    boundary: number,
    particleRadius: number
  ) {
    this.device = device;
    this.boundary = boundary;
    this.beamWidth = SIM_CONFIG.PISTON_BEAM_WIDTH;
    this.rodHeight = SIM_CONFIG.PISTON_ROD_HEIGHT;
    this.yBottom = pistonSealBottomY(boundary, particleRadius);
    const height = pistonHeightRange(boundary);
    this.yMin = height.yMin;
    this.yMax = height.yMax;

    this.uniformBuffer = device.createBuffer({
      label: 'Piston Uniform Buffer',
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({
      label: 'Piston Shader',
      code: `${viewProjectionWgsl()}\n${pistonShaderCode}`,
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

  private writeUniforms(
    cssWidth: number,
    cssHeight: number,
    wallX: number,
    tip: PistonTip
  ): void {
    const clamped = clampPistonTip(tip, this.boundary);
    const view = computeViewTransform(cssWidth, cssHeight);
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      new Float32Array([
        SIM_CONFIG.DOMAIN_WIDTH,
        SIM_CONFIG.DOMAIN_HEIGHT,
        view.scaleX,
        view.scaleY,
        view.offsetX,
        view.offsetY,
        wallX,
        this.beamWidth,
        this.yBottom,
        this.yMin,
        this.yMax,
        clamped.y,
        clamped.offsetX,
        this.rodHeight,
        0,
        0,
      ])
    );
  }

  public render(
    renderPass: GPURenderPassEncoder,
    cssWidth: number,
    cssHeight: number,
    wallX: number,
    tip: PistonTip
  ): void {
    this.writeUniforms(cssWidth, cssHeight, wallX, tip);
    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(21);
  }

  public destroy(): void {
    this.uniformBuffer.destroy();
  }
}
