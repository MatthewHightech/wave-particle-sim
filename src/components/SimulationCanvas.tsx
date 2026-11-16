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
    };
  }, []);

  if (error) {
    return (
      <div className="p-8 font-mono text-[#ff6b6b]">
        <h3 className="text-lg font-semibold">WebGPU Initialization Failed</h3>
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  return <canvas ref={canvasRef} className="block h-screen w-screen" />;
}
