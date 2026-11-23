import { FloorAngleHandle } from './FloorAngleHandle';
import { PistonTipHandle } from './PistonTipHandle';
import { SimControls } from './SimControls';
import { useSimulationController } from '../hooks/useSimulationController';

export function SimulationCanvas() {
  const sim = useSimulationController();

  if (sim.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 p-8 font-mono text-[#ff6b6b]">
        <div>
          <h3 className="text-lg font-semibold">WebGPU Initialization Failed</h3>
          <p className="mt-2">{sim.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-stone-950 text-stone-100">
      <canvas
        ref={sim.canvasRef}
        className="absolute inset-0 block h-full w-full"
      />
      {sim.ready && (
        <>
          <FloorAngleHandle
            canvas={sim.canvasRef.current}
            particleSpacing={sim.particleSpacing}
            floorShape={sim.floorShape}
            onFloorShapeChange={sim.setFloorShape}
          />
          <PistonTipHandle
            canvas={sim.canvasRef.current}
            particleSpacing={sim.particleSpacing}
            tip={sim.pistonTip}
            getWallX={sim.getWallX}
            onTipChange={sim.setPistonTip}
          />
        </>
      )}
      <p className="pointer-events-auto absolute top-5 left-5 z-10 text-xs text-stone-400">
        Built by{' '}
        <a
          href="https://mattsmith.sh/"
          target="_blank"
          rel="noreferrer"
          className="cursor-pointer text-stone-200 underline-offset-2 transition hover:text-white hover:underline"
        >
          Matt Smith
        </a>
      </p>
      <SimControls
        running={sim.running}
        amplitude={sim.amplitude}
        periodSeconds={sim.periodSeconds}
        particleSpacing={sim.particleSpacing}
        onPlay={sim.play}
        onPause={sim.pause}
        onReset={sim.reset}
        onAmplitudeChange={sim.setAmplitude}
        onPeriodChange={sim.setPeriodSeconds}
        onParticleCountChange={sim.setParticleSpacing}
      />
      {!sim.ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-stone-400">
          Starting simulation…
        </div>
      )}
    </div>
  );
}
