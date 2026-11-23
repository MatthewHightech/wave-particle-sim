import {
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
import { worldToCss } from '../engine/simulation/viewProjection';
import { useCanvasCssSize } from '../hooks/useCanvasCssSize';
import { useWindowPointerDrag } from '../hooks/useWindowPointerDrag';
import { OverlayDragHandle } from './OverlayDragHandle';

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
  const layout = useCanvasCssSize(canvas);
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

  const onDragMove = useEffectEvent((worldX: number, worldY: number) => {
    if (!dragTarget) return;
    applyDrag(dragTarget, worldX, worldY);
  });

  const onDragEnd = useEffectEvent(() => setDragTarget(null));

  useWindowPointerDrag({
    enabled: dragTarget !== null,
    canvas,
    onMove: onDragMove,
    onEnd: onDragEnd,
  });

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

      <OverlayDragHandle
        ariaLabel="Drag to move the floor hinge along the tank bottom"
        colorClass="bg-stone-300"
        idleCursorClass="cursor-ew-resize"
        active={dragTarget === 'pivot'}
        transition
        style={{ left: pivot.x, top: pivot.y }}
        onPointerDown={startDrag('pivot')}
      />
      <OverlayDragHandle
        ariaLabel="Drag to reshape the tank floor"
        colorClass="bg-sky-400"
        idleCursorClass="cursor-grab"
        active={dragTarget === 'mid'}
        transition
        style={{ left: midScreen.x, top: midScreen.y }}
        onPointerDown={startDrag('mid')}
      />
      <OverlayDragHandle
        ariaLabel="Drag to angle the tank floor"
        colorClass="bg-amber-400"
        idleCursorClass="cursor-grab"
        active={dragTarget === 'right'}
        transition
        style={{ left: corner.x, top: corner.y }}
        onPointerDown={startDrag('right')}
      />
    </div>
  );
}
