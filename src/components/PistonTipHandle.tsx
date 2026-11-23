import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { deriveParticles } from '../engine/simulation/SimConstants';
import {
  clampPistonTip,
  type PistonTip,
} from '../engine/simulation/pistonGeometry';
import { worldToCss } from '../engine/simulation/viewProjection';
import { useCanvasCssSize } from '../hooks/useCanvasCssSize';
import { useWindowPointerDrag } from '../hooks/useWindowPointerDrag';
import { OverlayDragHandle } from './OverlayDragHandle';

type PistonTipHandleProps = {
  canvas: HTMLCanvasElement | null;
  particleSpacing: number;
  tip: PistonTip;
  getWallX: () => number;
  onTipChange: (value: PistonTip) => void;
};

export function PistonTipHandle({
  canvas,
  particleSpacing,
  tip,
  getWallX,
  onTipChange,
}: PistonTipHandleProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tipRef = useRef(tip);
  const getWallXRef = useRef(getWallX);
  tipRef.current = tip;
  getWallXRef.current = getWallX;
  const layout = useCanvasCssSize(canvas);
  const [dragging, setDragging] = useState(false);
  const applyDrag = useEffectEvent((worldX: number, worldY: number) => {
    const boundary = deriveParticles(particleSpacing).boundary;
    onTipChange(
      clampPistonTip(
        {
          offsetX: worldX - getWallXRef.current(),
          y: worldY,
        },
        boundary
      )
    );
  });

  useEffect(() => {
    if (!canvas || layout.width <= 0 || layout.height <= 0) return;

    let frame = 0;
    const tick = () => {
      const button = buttonRef.current;
      if (button) {
        const boundary = deriveParticles(particleSpacing).boundary;
        const clamped = clampPistonTip(tipRef.current, boundary);
        const screen = worldToCss(
          getWallXRef.current() + clamped.offsetX,
          clamped.y,
          layout.width,
          layout.height
        );
        button.style.left = `${screen.x}px`;
        button.style.top = `${screen.y}px`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [canvas, layout, particleSpacing]);

  const onDragEnd = useEffectEvent(() => setDragging(false));

  useWindowPointerDrag({
    enabled: dragging,
    canvas,
    onMove: applyDrag,
    onEnd: onDragEnd,
  });

  if (!canvas || layout.width <= 0 || layout.height <= 0) {
    return null;
  }

  return (
    <OverlayDragHandle
      buttonRef={buttonRef}
      ariaLabel="Drag to flex the piston tip"
      colorClass="bg-emerald-400"
      idleCursorClass="cursor-move"
      active={dragging}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setDragging(true);
      }}
    />
  );
}
