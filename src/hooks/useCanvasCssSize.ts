import { useEffect, useState } from 'react';

export function useCanvasCssSize(canvas: HTMLCanvasElement | null) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!canvas) return;

    const update = () => {
      const rect = canvas.getBoundingClientRect();
      setLayout({ width: rect.width, height: rect.height });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvas]);

  return layout;
}
