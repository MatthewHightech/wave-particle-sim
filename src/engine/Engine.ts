import { WebGPUContext } from './core/WebGPUContext';
import { ParticleRenderer } from './rendering/ParticleRenderer';
import { PbfSolver } from './simulation/PbfSolver';
import {
  deriveParticles,
  estimateParticleCount,
  SIM_CONFIG,
  type WaveParams,
} from './simulation/SimConstants';
import { spawnFluid } from './simulation/spawnFluid';
import {
  clampFloorShape,
  defaultFloorShape,
  type FloorShape,
} from './simulation/tankFloor';

export type EngineSettings = WaveParams & {
  particleSpacing: number;
  floorShape: FloorShape;
};

export class Engine {
  private gpu: WebGPUContext | null = null;
  private renderer: ParticleRenderer | null = null;
  private solver: PbfSolver | null = null;
  private posBuffer: GPUBuffer | null = null;
  private animationFrameId: number | null = null;
  private isDestroyed = false;
  private paused = false;
  private settings: EngineSettings = {
    amplitude: SIM_CONFIG.DEFAULT_WAVE_AMPLITUDE,
    periodSeconds: SIM_CONFIG.DEFAULT_WAVE_PERIOD,
    particleSpacing: SIM_CONFIG.DEFAULT_PARTICLE_SPACING,
    floorShape: defaultFloorShape(
      deriveParticles(SIM_CONFIG.DEFAULT_PARTICLE_SPACING).boundary
    ),
  };

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

  public play(): void {
    this.paused = false;
  }

  public pause(): void {
    this.paused = true;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public getSettings(): EngineSettings {
    return {
      ...this.settings,
      floorShape: { ...this.settings.floorShape },
    };
  }

  public getParticleCount(): number {
    return estimateParticleCount(
      this.settings.particleSpacing,
      this.settings.amplitude,
      this.settings.floorShape
    );
  }

  public getFloorShape(): FloorShape {
    return { ...this.settings.floorShape };
  }

  public setFloorShape(floorShape: FloorShape): void {
    const boundary = deriveParticles(this.settings.particleSpacing).boundary;
    this.settings.floorShape = clampFloorShape(floorShape, boundary);
    this.solver?.setFloorShape(this.settings.floorShape);
  }

  public setWaveAmplitude(amplitude: number): void {
    this.settings.amplitude = amplitude;
    this.solver?.setWaveParams({
      amplitude: this.settings.amplitude,
      periodSeconds: this.settings.periodSeconds,
    });
  }

  public setWavePeriod(periodSeconds: number): void {
    this.settings.periodSeconds = periodSeconds;
    this.solver?.setWaveParams({
      amplitude: this.settings.amplitude,
      periodSeconds: this.settings.periodSeconds,
    });
  }

  public setParticleSpacing(spacing: number): void {
    this.settings.particleSpacing = spacing;
    this.reset();
  }

  public reset(): void {
    if (!this.gpu) return;
    this.teardownSimulation();
    this.bootstrapSimulation();
  }

  private bootstrapSimulation(): void {
    if (!this.gpu) return;
    const { device, format } = this.gpu;
    const derived = deriveParticles(this.settings.particleSpacing);
    this.settings.floorShape = clampFloorShape(
      this.settings.floorShape,
      derived.boundary
    );
    const positions = spawnFluid(
      this.settings.particleSpacing,
      this.settings.amplitude,
      this.settings.floorShape
    );
    const numParticles = positions.length / 2;

    this.posBuffer = device.createBuffer({
      label: 'Particle Positions',
      size: positions.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.posBuffer, 0, positions);

    this.solver = new PbfSolver(
      device,
      this.posBuffer,
      numParticles,
      derived,
      {
        amplitude: this.settings.amplitude,
        periodSeconds: this.settings.periodSeconds,
      },
      this.settings.floorShape
    );
    this.renderer = new ParticleRenderer(
      device,
      format,
      this.posBuffer,
      numParticles,
      derived.particleRadius
    );
  }

  private teardownSimulation(): void {
    this.renderer?.destroy();
    this.solver?.destroy();
    this.posBuffer?.destroy();
    this.renderer = null;
    this.solver = null;
    this.posBuffer = null;
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
    if (!this.paused) {
      this.solver.step(commandEncoder);
    }

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
    this.teardownSimulation();
    this.gpu?.destroy();
    this.gpu = null;
  }
}
