import { WebGPUContext } from './core/WebGPUContext';
import { ParticleRenderer } from './rendering/ParticleRenderer';

export class Engine {
  private gpu: WebGPUContext | null = null;
  private renderer: ParticleRenderer | null = null;
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
      this.initParticles();
      this.startLoop();
    } catch (err) {
      if (!this.isDestroyed) {
        onError?.(err instanceof Error ? err.message : String(err));
      }
    }
  }

  private initParticles(): void {
    if (!this.gpu) return;
    const { device, format } = this.gpu;

    // Spawn a dam-break block on the left side of the 64x64 grid
    const points: number[] = [];
    const spacing = 0.5; // 4 particles per grid cell

    for (let x = 4; x < 28; x += spacing) {
      for (let y = 4; y < 44; y += spacing) {
        // Tiny jitter prevents unnatural grid-aligned stacking artifacts later
        const jitterX = (Math.random() - 0.5) * 0.1;
        const jitterY = (Math.random() - 0.5) * 0.1;
        points.push(x + jitterX, y + jitterY);
      }
    }

    const numParticles = points.length / 2;
    const posArray = new Float32Array(points);

    // Note: STORAGE | COPY_DST allows compute shaders to read/write later
    this.posBuffer = device.createBuffer({
      label: 'Particle Positions Buffer',
      size: posArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.posBuffer, 0, posArray);

    this.renderer = new ParticleRenderer(
      device,
      format,
      this.posBuffer,
      numParticles
    );
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
    if (!this.gpu || !this.renderer) return;
    const { device, context } = this.gpu;

    const currentTexture = context.getCurrentTexture();
    if (currentTexture.width === 0 || currentTexture.height === 0) return;

    const commandEncoder = device.createCommandEncoder();
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

    this.renderer.render(
      renderPass,
      currentTexture.width,
      currentTexture.height
    );
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.renderer?.destroy();
    this.posBuffer?.destroy();
    this.gpu?.destroy();
    this.gpu = null;
  }
}