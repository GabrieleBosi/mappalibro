import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { attachKeyboard, consumeLookDelta, input, isCoarsePointer } from '../controls/input';
import { useWorldStore } from '../state/worldStore';
import type { LocationBlueprint } from '../world/blueprint';

const EYE_HEIGHT = 1.6;
const WALK_SPEED = 4; // m/s
const LOOK_SENSITIVITY = 0.0024; // rad per px
const PITCH_LIMIT = 1.4;
/** Keep the player this far inside the walkable bounds. */
const BODY_MARGIN = 0.6;

/**
 * First-person camera rig. Remounted (via key) on every arrival, which
 * resets the player to the spawn point at the location's center, facing
 * the first portal (-Z).
 */
export function Player({ blueprint }: { blueprint: LocationBlueprint }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const setPointerLocked = useWorldStore((s) => s.setPointerLocked);

  const yaw = useRef(0);
  const pitch = useRef(0);
  const pos = useRef({ x: 0, z: 0 });

  useEffect(() => attachKeyboard(), []);

  // Desktop pointer lock. Requested only from the click gesture; mousemove
  // feeds the shared look-delta accumulator that touch look also writes to.
  useEffect(() => {
    if (isCoarsePointer()) return;
    const canvas = gl.domElement;
    const onClick = () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        input.lookDelta.x += e.movementX;
        input.lookDelta.y += e.movementY;
      }
    };
    const onLockChange = () => {
      setPointerLocked(document.pointerLockElement === canvas);
    };
    canvas.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }, [gl, setPointerLocked]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    const look = consumeLookDelta();
    yaw.current -= look.x * LOOK_SENSITIVITY;
    pitch.current = Math.max(
      -PITCH_LIMIT,
      Math.min(PITCH_LIMIT, pitch.current - look.y * LOOK_SENSITIVITY),
    );

    const { x: mx, y: my } = input.move;
    if (mx !== 0 || my !== 0) {
      // normalize so diagonals aren't faster
      const len = Math.hypot(mx, my);
      const nx = mx / Math.max(1, len);
      const ny = my / Math.max(1, len);
      // camera faces -Z at yaw 0
      const fx = -Math.sin(yaw.current);
      const fz = -Math.cos(yaw.current);
      const rx = Math.cos(yaw.current);
      const rz = -Math.sin(yaw.current);
      pos.current.x += (fx * ny + rx * nx) * WALK_SPEED * dt;
      pos.current.z += (fz * ny + rz * nx) * WALK_SPEED * dt;

      // collision: clamp to the walkable circle
      const maxR = blueprint.boundsRadius - BODY_MARGIN;
      const r = Math.hypot(pos.current.x, pos.current.z);
      if (r > maxR) {
        pos.current.x *= maxR / r;
        pos.current.z *= maxR / r;
      }
    }

    camera.position.set(pos.current.x, EYE_HEIGHT, pos.current.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch.current, yaw.current, 0);
  });

  return null;
}
