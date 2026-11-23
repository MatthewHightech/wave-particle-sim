import floorShaderCode from '../shaders/tankFloor.wgsl?raw';
import { createSimpleRenderPass } from '../core/gpuBuffers';
import { SIM_CONFIG } from '../simulation/SimConstants';
import { pistonHeightRange } from '../simulation/pistonGeometry';
import {
  clampFloorShape,
  floorBaseY,
  floorMaxX,
  type FloorShape,
} from '../simulation/tankFloor';
import {
  computeViewTransform,
  viewProjectionWgsl,
} from '../simulation/viewProjection';

export class FloorRenderer {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private uniformBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;
  private boundary: number;

  constructor(device: GPUDevice, format: GPUTextureFormat, boundary: number) {
    this.device = device;
    this.boundary = boundary;

    const pass = createSimpleRenderPass(
      device,
      'Floor',
      format,
      `${viewProjectionWgsl()}\n${floorShaderCode}`,
      64
    );
    this.pipeline = pass.pipeline;
    this.uniformBuffer = pass.uniformBuffer;
    this.bindGroup = pass.bindGroup;
  }

  public render(
    renderPass: GPURenderPassEncoder,
    cssWidth: number,
    cssHeight: number,
    floorShape: FloorShape
  ): void {
    const shape = clampFloorShape(floorShape, this.boundary);
    const view = computeViewTransform(cssWidth, cssHeight);
    const wallTop = pistonHeightRange(this.boundary).yMax;
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
        floorBaseY(this.boundary),
        shape.pivotX,
        shape.midX,
        shape.midY,
        floorMaxX(this.boundary),
        shape.rightY,
        wallTop,
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
