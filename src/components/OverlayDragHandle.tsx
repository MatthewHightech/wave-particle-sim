import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';

const BASE_CLASS =
  'pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-stone-950 shadow-md';

type OverlayDragHandleProps = {
  ariaLabel: string;
  colorClass: string;
  idleCursorClass: string;
  active: boolean;
  transition?: boolean;
  style?: CSSProperties;
  buttonRef?: Ref<HTMLButtonElement>;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

export function OverlayDragHandle({
  ariaLabel,
  colorClass,
  idleCursorClass,
  active,
  transition = false,
  style,
  buttonRef,
  onPointerDown,
}: OverlayDragHandleProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={ariaLabel}
      className={`${BASE_CLASS} ${colorClass} ${transition ? 'transition ' : ''}${
        active
          ? 'scale-125 cursor-grabbing'
          : `${idleCursorClass} hover:scale-110`
      }`}
      style={style}
      onPointerDown={onPointerDown}
    />
  );
}
