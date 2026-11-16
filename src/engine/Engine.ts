import { WebGPUContext } from './core/WebGPUContext';
import { ParticleRenderer } from './rendering/ParticleRenderer';
import { PbfSolver } from './simulation/PbfSolver';
import { spawnDamBreak } from './simulation/spawnDamBreak';

export class Engine {
  private gpu: WebGPUContext | null = null;
  private renderer: ParticleRenderer | null = null;
  private solver: PbfSolver | null = null;
  private posBuffer: GPUBuffer | null = null;
  private animationFrameId: number | null = null;
  private isDestroyed = false;

  public async init(
    canvas: HTMLCanvasElement,
    onError?: (msg: string) => void
  ): Promise<void> {
    try {
      const gpu = await WebGPUContext.create(canvas, onError);

      if (this.isDestroyed) {
        gpu.destroy();
        return;
      }

      this.gpu = gpu;
      this.bootstrapSimulation();
      this.startLoop();
    } catch (err) {
      if (!this.isDestroyed) {
        onError?.(err instanceof Error ? err.message : String(err));
      }
    }
  }

  private bootstrapSimulation(): void {
    if (!this.gpu) return;
    const { device, format } = this.gpu;

    const positions = spawnDamBreak();
    const numParticles = positions.length / 2;

    this.posBuffer = device.createBuffer({
      label: 'Particle Positions',
      size: positions.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.posBuffer, 0, positions);

    this.solver = new PbfSolver(device, this.posBuffer, numParticles);
    this.renderer = new ParticleRenderer(device, format, this.posBuffer, numParticles);
  }

  private startLoop(): void {
    const frame = () => {
      if (this.isDestroyed) return;
      this.render();
      this.animationFrameId = requestAnimationFrame(frame);
    };
    this.animationFrameId = requestAnimationFrame(frame);
  }

  private render(): void {
    if (!this.gpu || !this.renderer || !this.solver) return;
    const { device, context } = this.gpu;

    const currentTexture = context.getCurrentTexture();
    if (currentTexture.width === 0 || currentTexture.height === 0) return;

    const commandEncoder = device.createCommandEncoder();
    this.solver.step(commandEncoder);

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: currentTexture.createView(),
          clearValue: { r: 0.06, g: 0.07, b: 0.1, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    this.renderer.render(renderPass, currentTexture.width, currentTexture.height);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.renderer?.destroy();
    this.solver?.destroy();
    this.posBuffer?.destroy();
    this.gpu?.destroy();
    this.gpu = null;
  }
}
