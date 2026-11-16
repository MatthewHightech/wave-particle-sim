import { WebGPUContext } from './core/WebGPUContext';
import { ParticleRenderer } from './rendering/ParticleRenderer';
import { MlsMpmSolver } from './simulation/MlsMpmSolver';
import { SIM_CONFIG } from './simulation/SimConstants';

export class Engine {
  private gpu: WebGPUContext | null = null;
  private renderer: ParticleRenderer | null = null;
  private posBuffer: GPUBuffer | null = null;
  private animationFrameId: number | null = null;
  private isDestroyed = false;
  private solver: MlsMpmSolver | null = null;

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
  
    const points: number[] = [];
    const jValues: number[] = [];
  
    // Match the 2-cell boundary padding used in updateGrid.wgsl and g2p.wgsl
    const minX = 3.5;
    const maxX = SIM_CONFIG.GRID_WIDTH - 4.5;
    const minY = 3.5;
    const waterSurfaceY = SIM_CONFIG.GRID_HEIGHT * 0.5;
    const spacing = 0.5;
  
    // Pre-calculate hydrostatic compression factor so water starts calm instead of bouncing
    // At rest: pressure = stiffness * (1 - J) balances weight of water column above y
    const gravityMag = Math.abs(SIM_CONFIG.GRAVITY); // 9.8

    for (let x = minX; x < maxX; x += spacing) {
      for (let y = minY; y < waterSurfaceY; y += spacing) {
        const jitterX = (Math.random() - 0.5) * 0.08;
        const jitterY = (Math.random() - 0.5) * 0.08;
        points.push(x + jitterX, y + jitterY);
    

        const depth = waterSurfaceY - y;
        const hydrostaticPressure = 1.0 * gravityMag * depth;
        // Inverse of P = k * (1 / J^7 - 1)
        const initialJ = Math.pow(1.0 + hydrostaticPressure / SIM_CONFIG.STIFFNESS, -1.0 / 7.0);
        jValues.push(initialJ);
      }
    }
  
    const numParticles = points.length / 2;
    const posArray = new Float32Array(points);
    const jArray = new Float32Array(jValues);
  
    this.posBuffer = device.createBuffer({
      label: 'Particle Positions Buffer',
      size: posArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.posBuffer, 0, posArray);
  
    this.solver = new MlsMpmSolver(device, this.posBuffer, jArray, numParticles);
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
    this.solver?.destroy();
    this.gpu?.destroy();
    this.gpu = null;
  }
}