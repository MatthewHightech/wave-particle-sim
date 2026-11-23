import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Engine } from '../engine/Engine';
import { deriveParticles, SIM_CONFIG } from '../engine/simulation/SimConstants';
import {
  defaultPistonTip,
  type PistonTip,
} from '../engine/simulation/pistonGeometry';
import {
  defaultFloorShape,
  type FloorShape,
} from '../engine/simulation/tankFloor';

const DEFAULT_BOUNDARY = deriveParticles(
  SIM_CONFIG.DEFAULT_PARTICLE_SPACING
).boundary;

export function useSimulationController() {
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
    defaultFloorShape(DEFAULT_BOUNDARY)
  );
  const [pistonTip, setPistonTip] = useState<PistonTip>(() =>
    defaultPistonTip(DEFAULT_BOUNDARY)
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

  const play = useEffectEvent(() => {
    engineRef.current?.play();
    setRunning(true);
  });

  const pause = useEffectEvent(() => {
    engineRef.current?.pause();
    setRunning(false);
  });

  const toggleRunning = useEffectEvent(() => {
    if (running) {
      pause();
    } else {
      play();
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      toggleRunning();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return {
    canvasRef,
    error,
    ready,
    running,
    amplitude,
    periodSeconds,
    particleSpacing,
    floorShape,
    pistonTip,
    play,
    pause,
    reset: () => {
      engineRef.current?.reset();
    },
    setAmplitude: (value: number) => {
      setAmplitude(value);
      engineRef.current?.setWaveAmplitude(value);
    },
    setPeriodSeconds: (value: number) => {
      setPeriodSeconds(value);
      engineRef.current?.setWavePeriod(value);
    },
    setParticleSpacing: (spacing: number) => {
      setParticleSpacing(spacing);
      engineRef.current?.setParticleSpacing(spacing);
      const nextShape = engineRef.current?.getFloorShape();
      if (nextShape) setFloorShape(nextShape);
      const nextTip = engineRef.current?.getPistonTip();
      if (nextTip) setPistonTip(nextTip);
    },
    setFloorShape: (shape: FloorShape) => {
      setFloorShape(shape);
      engineRef.current?.setFloorShape(shape);
    },
    setPistonTip: (value: PistonTip) => {
      setPistonTip(value);
      engineRef.current?.setPistonTip(value);
    },
    getWallX: () => engineRef.current?.getLeftWallX() ?? 0,
  };
}
