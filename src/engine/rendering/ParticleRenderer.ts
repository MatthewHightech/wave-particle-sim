import particleShaderCode from '../shaders/particle.wgsl?raw';
import { SIM_CONFIG } from '../simulation/SimConstants';
import {
  computeViewTransform,
  viewProjectionWgsl,
} from '../simulation/viewProjection';

export class ParticleRenderer {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private uniformBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;
  private numParticles: number;
  private particleRadius: number;

  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    posBuffer: GPUBuffer,
    foamBuffer: GPUBuffer,
    numParticles: number,
    particleRadius: number
  ) {
    this.device = device;
    this.numParticles = numParticles;
    this.particleRadius = particleRadius;

    this.uniformBuffer = device.createBuffer({
      label: 'Render Uniform Buffer',
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({
      label: 'Particle Render Shader',
      code: `${viewProjectionWgsl()}\n${particleShaderCode}`,
    });

    this.pipeline = device.createRenderPipeline({
      label: 'Particle Render Pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    this.bindGroup = device.createBindGroup({
      label: 'Particle Render BindGroup',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: posBuffer } },
        { binding: 2, resource: { buffer: foamBuffer } },
      ],
    });
  }

  public render(
    renderPass: GPURenderPassEncoder,
    cssWidth: number,
    cssHeight: number
  ): void {
    const view = computeViewTransform(cssWidth, cssHeight);
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      new Float32Array([
        SIM_CONFIG.DOMAIN_WIDTH,
        SIM_CONFIG.DOMAIN_HEIGHT,
        this.particleRadius,
        0,
        view.scaleX,
        view.scaleY,
        view.offsetX,
        view.offsetY,
      ])
    );

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(6, this.numParticles);
  }

  public destroy(): void {
    this.uniformBuffer.destroy();
  }
}
