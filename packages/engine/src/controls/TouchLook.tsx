import { useRef, type PointerEvent } from 'react';
import { input } from './input';

const TOUCH_LOOK_GAIN = 2.2;

/**
 * Transparent drag surface over the right side of the screen: drag deltas
 * feed the same look accumulator the desktop mouse writes to.
 */
export function TouchLook() {
  const activePointer = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    activePointer.current = e.pointerId;
    last.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort; move events on the element still work
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== e.pointerId) return;
    input.lookDelta.x += (e.clientX - last.current.x) * TOUCH_LOOK_GAIN;
    input.lookDelta.y += (e.clientY - last.current.y) * TOUCH_LOOK_GAIN;
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current === e.pointerId) activePointer.current = null;
  };

  return (
    <div
      className="touch-look"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
