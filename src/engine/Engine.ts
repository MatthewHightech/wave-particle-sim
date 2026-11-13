import { WebGPUContext } from './core/WebGPUContext';
import triangleShaderCode from './shaders/triangle.wgsl?raw';

export class Engine {
  private gpu: WebGPUContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private animationFrameId: number | null = null;
  private isDestroyed = false;

  public async init(
    canvas: HTMLCanvasElement,
    onError?: (msg: string) => void
  ): Promise<void> {
    try {
      const gpu = await WebGPUContext.create(canvas, onError);

      // Guard against React StrictMode unmounting while awaiting GPU initialization
      if (this.isDestroyed) {
        gpu.destroy();
        return;
      }

      this.gpu = gpu;
      this.createPipeline();
      this.startLoop();
    } catch (err) {
      if (!this.isDestroyed) {
        onError?.(err instanceof Error ? err.message : String(err));
      }
    }
  }

  private createPipeline(): void {
    if (!this.gpu) return;
    const { device, format } = this.gpu;

    const shaderModule = device.createShaderModule({
      label: 'Hello Triangle Shader',
      code: triangleShaderCode,
    });

    this.pipeline = device.createRenderPipeline({
      label: 'Hello Triangle Pipeline',
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
    if (!this.gpu || !this.pipeline) return;
    const { device, context } = this.gpu;

    // Skip rendering if canvas is collapsed to 0x0 during layout transitions
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

    renderPass.setPipeline(this.pipeline);
    renderPass.draw(3); // 3 vertices, 1 instance
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.gpu?.destroy();
    this.gpu = null;
  }
}