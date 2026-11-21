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
import { cssToWorld, worldToCss } from '../engine/simulation/worldSpace';

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
  const [layout, setLayout] = useState({ width: 0, height: 0 });
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

  useEffect(() => {
    if (!dragging || !canvas) return;

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const world = cssToWorld(
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height
      );
      applyDrag(world.x, world.y);
    };

    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, canvas]);

  if (!canvas || layout.width <= 0 || layout.height <= 0) {
    return null;
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Drag to flex the piston tip"
      className={`pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-stone-950 bg-emerald-400 shadow-md ${
        dragging ? 'scale-125 cursor-grabbing' : 'cursor-move hover:scale-110'
      }`}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setDragging(true);
      }}
    />
  );
}
