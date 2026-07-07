import { useRef, type PointerEvent } from 'react';
import { input } from './input';

const KNOB_RANGE = 40; // px

/** Virtual joystick (bottom-left DOM overlay) writing into the shared input state. */
export function Joystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);

  const apply = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;
    const rect = base.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > KNOB_RANGE) {
      dx *= KNOB_RANGE / len;
      dy *= KNOB_RANGE / len;
    }
    input.move.x = dx / KNOB_RANGE;
    input.move.y = -dy / KNOB_RANGE; // screen up = forward
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const release = () => {
    activePointer.current = null;
    input.move.x = 0;
    input.move.y = 0;
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    activePointer.current = e.pointerId;
    try {
      baseRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort; move events on the element still work
    }
    apply(e.clientX, e.clientY);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current === e.pointerId) apply(e.clientX, e.clientY);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current === e.pointerId) release();
  };

  return (
    <div
      ref={baseRef}
      className="joystick"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={knobRef} className="joystick-knob" />
    </div>
  );
}
