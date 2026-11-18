import floorShaderCode from '../shaders/tankFloor.wgsl?raw';
import { SIM_CONFIG } from '../simulation/SimConstants';
import {
  clampFloorShape,
  floorBaseY,
  floorMaxX,
  type FloorShape,
} from '../simulation/tankFloor';

export class FloorRenderer {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private uniformBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;
  private boundary: number;

  constructor(device: GPUDevice, format: GPUTextureFormat, boundary: number) {
    this.device = device;
    this.boundary = boundary;

    this.uniformBuffer = device.createBuffer({
      label: 'Floor Uniform Buffer',
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({
      label: 'Floor Shader',
      code: floorShaderCode,
    });

    this.pipeline = device.createRenderPipeline({
      label: 'Floor Pipeline',
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
      label: 'Floor BindGroup',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });
  }

  public render(
    renderPass: GPURenderPassEncoder,
    width: number,
    height: number,
    floorShape: FloorShape
  ): void {
    const shape = clampFloorShape(floorShape, this.boundary);
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      new Float32Array([
        SIM_CONFIG.DOMAIN_WIDTH,
        SIM_CONFIG.DOMAIN_HEIGHT,
        width / height,
        floorBaseY(this.boundary),
        shape.pivotX,
        shape.midX,
        shape.midY,
        floorMaxX(this.boundary),
        shape.rightY,
        0,
        0,
        0,
      ])
    );

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(6);
  }

  public destroy(): void {
    this.uniformBuffer.destroy();
  }
}
