import { useEffect, useRef, useState } from 'react';
import { Engine } from '../engine/Engine';
import {
  deriveParticles,
  SIM_CONFIG,
} from '../engine/simulation/SimConstants';
import {
  defaultPistonTip,
  type PistonTip,
} from '../engine/simulation/pistonGeometry';
import {
  defaultFloorShape,
  type FloorShape,
} from '../engine/simulation/tankFloor';
import { FloorAngleHandle } from './FloorAngleHandle';
import { PistonTipHandle } from './PistonTipHandle';
import { SimControls } from './SimControls';

export function SimulationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(true);
  const [amplitude, setAmplitude] = useState<number>(
    SIM_CONFIG.DEFAULT_WAVE_AMPLITUDE
  );
  const [periodSeconds, setPeriodSeconds] = useState<number>(
    SIM_CONFIG.DEFAULT_WAVE_PERIOD
  );
  const [particleSpacing, setParticleSpacing] = useState<number>(
    SIM_CONFIG.DEFAULT_PARTICLE_SPACING
  );
  const [floorShape, setFloorShape] = useState<FloorShape>(() =>
    defaultFloorShape(
      deriveParticles(SIM_CONFIG.DEFAULT_PARTICLE_SPACING).boundary
    )
  );
  const [pistonTip, setPistonTip] = useState<PistonTip>(() =>
    defaultPistonTip(
      deriveParticles(SIM_CONFIG.DEFAULT_PARTICLE_SPACING).boundary
    )
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine();
    engineRef.current = engine;
    engine
      .init(canvas, (errMsg) => setError(errMsg))
      .then(() => setReady(true));

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.floor(entry.contentRect.width * dpr));
        canvas.height = Math.max(1, Math.floor(entry.contentRect.height * dpr));
      }
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 p-8 font-mono text-[#ff6b6b]">
        <div>
          <h3 className="text-lg font-semibold">WebGPU Initialization Failed</h3>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-stone-950 text-stone-100">
      <div className="relative min-w-0 flex-1">
        <canvas ref={canvasRef} className="block h-screen w-full" />
        {ready && (
          <>
            <FloorAngleHandle
              canvas={canvasRef.current}
              particleSpacing={particleSpacing}
              floorShape={floorShape}
              onFloorShapeChange={(shape) => {
                setFloorShape(shape);
                engineRef.current?.setFloorShape(shape);
              }}
            />
            <PistonTipHandle
              canvas={canvasRef.current}
              particleSpacing={particleSpacing}
              tip={pistonTip}
              getWallX={() => engineRef.current?.getLeftWallX() ?? 0}
              onTipChange={(value) => {
                setPistonTip(value);
                engineRef.current?.setPistonTip(value);
              }}
            />
          </>
        )}
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-stone-400">
            Starting simulation…
          </div>
        )}
      </div>

      <SimControls
        running={running}
        amplitude={amplitude}
        periodSeconds={periodSeconds}
        particleSpacing={particleSpacing}
        onPlay={() => {
          engineRef.current?.play();
          setRunning(true);
        }}
        onPause={() => {
          engineRef.current?.pause();
          setRunning(false);
        }}
        onReset={() => {
          engineRef.current?.reset();
        }}
        onAmplitudeChange={(value) => {
          setAmplitude(value);
          engineRef.current?.setWaveAmplitude(value);
        }}
        onPeriodChange={(value) => {
          setPeriodSeconds(value);
          engineRef.current?.setWavePeriod(value);
        }}
        onParticleCountChange={(spacing) => {
          setParticleSpacing(spacing);
          engineRef.current?.setParticleSpacing(spacing);
          const nextShape = engineRef.current?.getFloorShape();
          if (nextShape) {
            setFloorShape(nextShape);
          }
          const nextTip = engineRef.current?.getPistonTip();
          if (nextTip) {
            setPistonTip(nextTip);
          }
        }}
      />
    </div>
  );
}
