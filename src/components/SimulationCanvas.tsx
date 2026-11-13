import { useEffect, useRef, useState } from 'react';
import { Engine } from '../engine/Engine';

export function SimulationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine();
    engine.init(canvas, (errMsg) => setError(errMsg));

    // Keep backing buffer resolution sharp on Retina/HiDPI displays
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(entry.contentRect.width * dpr));
        const height = Math.max(1, Math.floor(entry.contentRect.height * dpr));
        canvas.width = width;
        canvas.height = height;
      }
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
      engine.destroy();
    };
  }, []);

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#ff6b6b', fontFamily: 'monospace' }}>
        <h3>WebGPU Initialization Failed</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'block',
      }}
    />
  );
}