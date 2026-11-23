import { useEffect } from 'react';
import { cssToWorld } from '../engine/simulation/viewProjection';

type UseWindowPointerDragOptions = {
  enabled: boolean;
  canvas: HTMLCanvasElement | null;
  onMove: (worldX: number, worldY: number) => void;
  onEnd: () => void;
};

export function useWindowPointerDrag({
  enabled,
  canvas,
  onMove,
  onEnd,
}: UseWindowPointerDragOptions): void {
  useEffect(() => {
    if (!enabled || !canvas) return;

    const handleMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const world = cssToWorld(
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height
      );
      onMove(world.x, world.y);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [enabled, canvas, onMove, onEnd]);
}
