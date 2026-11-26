import { WebGPUContext } from './core/WebGPUContext';
import { createGpuBuffer } from './core/gpuBuffers';
import { FloorRenderer } from './rendering/FloorRenderer';
import { ParticleRenderer } from './rendering/ParticleRenderer';
import { PistonRenderer } from './rendering/PistonRenderer';
import { PbfSolver } from './simulation/PbfSolver';
import {
  deriveParticles,
  SIM_CONFIG,
  type WaveParams,
} from './simulation/SimConstants';
import { defaultParticleSpacing, spawnFluid } from './simulation/fluidSpawn';
import {
  clampPistonTip,
  defaultPistonTip,
  type PistonTip,
} from './simulation/pistonGeometry';
import {
  clampFloorShape,
  defaultFloorShape,
  type FloorShape,
} from './simulation/tankFloor';

type EngineSettings = WaveParams & {
  particleSpacing: number;
  floorShape: FloorShape;
  pistonTip: PistonTip;
};

function defaultBoundary(
  spacing = defaultParticleSpacing()
): number {
  return deriveParticles(spacing).boundary;
}

export class Engine {
  private gpu: WebGPUContext | null = null;
  private renderer: ParticleRenderer | null = null;
  private floorRenderer: FloorRenderer | null = null;
  private pistonRenderer: PistonRenderer | null = null;
  private solver: PbfSolver | null = null;
  private posBuffer: GPUBuffer | null = null;
  private animationFrameId: number | null = null;
  private isDestroyed = false;
  private paused = false;
  private settings: EngineSettings = (() => {
    const boundary = defaultBoundary();
    return {
      amplitude: SIM_CONFIG.DEFAULT_WAVE_AMPLITUDE,
      periodSeconds: SIM_CONFIG.DEFAULT_WAVE_PERIOD,
      particleSpacing: defaultParticleSpacing(),
      floorShape: defaultFloorShape(boundary),
      pistonTip: defaultPistonTip(boundary),
    };
  })();

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
    if (this.paused) {
      this.syncWaveParams();
    }
    this.paused = false;
  }

  public pause(): void {
    this.paused = true;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public getFloorShape(): FloorShape {
    return { ...this.settings.floorShape };
  }

  public setFloorShape(floorShape: FloorShape): void {
    const boundary = deriveParticles(this.settings.particleSpacing).boundary;
    this.settings.floorShape = clampFloorShape(floorShape, boundary);
    this.solver?.setFloorShape(this.settings.floorShape, this.paused);
  }

  public getPistonTip(): PistonTip {
    return { ...this.settings.pistonTip };
  }

  public setPistonTip(tip: PistonTip): void {
    const boundary = deriveParticles(this.settings.particleSpacing).boundary;
    this.settings.pistonTip = clampPistonTip(tip, boundary);
    this.solver?.setPistonTip(this.settings.pistonTip, this.paused);
  }

  public getLeftWallX(): number {
    return this.solver?.getLeftWallX() ?? 0;
  }

  public setWaveAmplitude(amplitude: number): void {
    this.settings.amplitude = amplitude;
    if (!this.paused) {
      this.syncWaveParams();
    }
  }

  public setWavePeriod(periodSeconds: number): void {
    this.settings.periodSeconds = periodSeconds;
    if (!this.paused) {
      this.syncWaveParams();
    }
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

  private syncWaveParams(): void {
    this.solver?.setWaveParams({
      amplitude: this.settings.amplitude,
      periodSeconds: this.settings.periodSeconds,
    });
  }

  private bootstrapSimulation(): void {
    if (!this.gpu) return;
    const { device, format } = this.gpu;
    const derived = deriveParticles(this.settings.particleSpacing);
    this.settings.floorShape = clampFloorShape(
      this.settings.floorShape,
      derived.boundary
    );
    this.settings.pistonTip = clampPistonTip(
      this.settings.pistonTip,
      derived.boundary
    );
    const positions = spawnFluid(
      this.settings.particleSpacing,
      this.settings.amplitude,
      this.settings.floorShape
    );
    const numParticles = positions.length / 2;

    this.posBuffer = createGpuBuffer(
      device,
      'Particle Positions',
      positions.byteLength,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      positions
    );

    this.solver = new PbfSolver(
      device,
      this.posBuffer,
      numParticles,
      derived,
      {
        amplitude: this.settings.amplitude,
        periodSeconds: this.settings.periodSeconds,
      },
      this.settings.floorShape,
      this.settings.pistonTip
    );
    this.renderer = new ParticleRenderer(
      device,
      format,
      this.posBuffer,
      this.solver.getFoamBuffer(),
      numParticles,
      derived.particleRadius
    );
    this.floorRenderer = new FloorRenderer(device, format, derived.boundary);
    this.pistonRenderer = new PistonRenderer(
      device,
      format,
      derived.boundary,
      derived.particleRadius
    );
  }

  private teardownSimulation(): void {
    this.renderer?.destroy();
    this.floorRenderer?.destroy();
    this.pistonRenderer?.destroy();
    this.solver?.destroy();
    this.posBuffer?.destroy();
    this.renderer = null;
    this.floorRenderer = null;
    this.pistonRenderer = null;
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
    if (
      !this.gpu ||
      !this.renderer ||
      !this.floorRenderer ||
      !this.pistonRenderer ||
      !this.solver
    ) {
      return;
    }
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
          clearValue: { r: 0.04, g: 0.08, b: 0.12, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    const canvas = this.gpu.context.canvas as HTMLCanvasElement;
    const cssWidth = Math.max(canvas.clientWidth, 1);
    const cssHeight = Math.max(canvas.clientHeight, 1);

    this.floorRenderer.render(
      renderPass,
      cssWidth,
      cssHeight,
      this.settings.floorShape
    );
    this.renderer.render(renderPass, cssWidth, cssHeight);
    this.pistonRenderer.render(
      renderPass,
      cssWidth,
      cssHeight,
      this.solver.getLeftWallX(),
      this.settings.pistonTip
    );
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
