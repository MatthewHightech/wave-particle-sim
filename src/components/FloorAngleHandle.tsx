import {
  useEffect,
  useEffectEvent,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { deriveParticles } from '../engine/simulation/SimConstants';
import {
  clampFloorMid,
  clampFloorPivotX,
  clampFloorShape,
  clampRightFloorY,
  floorBaseY,
  floorMaxX,
  type FloorShape,
} from '../engine/simulation/tankFloor';
import { cssToWorld, worldToCss } from '../engine/simulation/worldSpace';

type DragTarget = 'pivot' | 'mid' | 'right' | null;

type FloorAngleHandleProps = {
  canvas: HTMLCanvasElement | null;
  particleSpacing: number;
  floorShape: FloorShape;
  onFloorShapeChange: (shape: FloorShape) => void;
};

export function FloorAngleHandle({
  canvas,
  particleSpacing,
  floorShape,
  onFloorShapeChange,
}: FloorAngleHandleProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const applyDrag = useEffectEvent(
    (target: Exclude<DragTarget, null>, worldX: number, worldY: number) => {
      const boundary = deriveParticles(particleSpacing).boundary;

      if (target === 'right') {
        onFloorShapeChange(
          clampFloorShape(
            {
              ...floorShape,
              rightY: clampRightFloorY(worldY, boundary),
            },
            boundary
          )
        );
        return;
      }

      if (target === 'pivot') {
        onFloorShapeChange(
          clampFloorShape(
            {
              ...floorShape,
              pivotX: clampFloorPivotX(worldX, boundary),
            },
            boundary
          )
        );
        return;
      }

      const mid = clampFloorMid(
        { x: worldX, y: worldY },
        boundary,
        floorShape.pivotX
      );
      onFloorShapeChange(
        clampFloorShape(
          {
            ...floorShape,
            midX: mid.x,
            midY: mid.y,
          },
          boundary
        )
      );
    }
  );

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

  useEffect(() => {
    if (!dragTarget || !canvas) return;

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const world = cssToWorld(
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height
      );
      applyDrag(dragTarget, world.x, world.y);
    };

    const onUp = () => setDragTarget(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragTarget, canvas]);

  if (!canvas || layout.width <= 0 || layout.height <= 0) {
    return null;
  }

  const boundary = deriveParticles(particleSpacing).boundary;
  const shape = clampFloorShape(floorShape, boundary);
  const baseY = floorBaseY(boundary);
  const maxX = floorMaxX(boundary);

  const pivot = worldToCss(shape.pivotX, baseY, layout.width, layout.height);
  const midScreen = worldToCss(shape.midX, shape.midY, layout.width, layout.height);
  const corner = worldToCss(maxX, shape.rightY, layout.width, layout.height);

  const startDrag =
    (target: DragTarget) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setDragTarget(target);
    };

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <polyline
          points={`${pivot.x},${pivot.y} ${midScreen.x},${midScreen.y} ${corner.x},${corner.y}`}
          className="fill-none stroke-amber-400/70"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <button
        type="button"
        aria-label="Drag to move the floor hinge along the tank bottom"
        className={`pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-stone-950 bg-stone-300 shadow-md transition ${
          dragTarget === 'pivot'
            ? 'scale-125 cursor-grabbing'
            : 'cursor-ew-resize hover:scale-110'
        }`}
        style={{ left: pivot.x, top: pivot.y }}
        onPointerDown={startDrag('pivot')}
      />

      <button
        type="button"
        aria-label="Drag to reshape the tank floor"
        className={`pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-stone-950 bg-sky-400 shadow-md transition ${
          dragTarget === 'mid'
            ? 'scale-125 cursor-grabbing'
            : 'cursor-grab hover:scale-110'
        }`}
        style={{ left: midScreen.x, top: midScreen.y }}
        onPointerDown={startDrag('mid')}
      />

      <button
        type="button"
        aria-label="Drag to angle the tank floor"
        className={`pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-stone-950 bg-amber-400 shadow-md transition ${
          dragTarget === 'right'
            ? 'scale-125 cursor-grabbing'
            : 'cursor-grab hover:scale-110'
        }`}
        style={{ left: corner.x, top: corner.y }}
        onPointerDown={startDrag('right')}
      />
    </div>
  );
}
