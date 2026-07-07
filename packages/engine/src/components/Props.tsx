import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  type InstancedMesh,
  Object3D,
  OctahedronGeometry,
} from 'three';
import type { Palette, PropInstance, PropKind } from '../world/blueprint';

const dummy = new Object3D();
const tmpColor = new Color();

/** Geometries authored with their base at y=0 so instances sit on the ground. */
function makeGeometry(kind: Exclude<PropKind, 'lamp'>): BufferGeometry {
  switch (kind) {
    case 'block': {
      const g = new BoxGeometry(1, 0.9, 1);
      g.translate(0, 0.45, 0);
      return g;
    }
    case 'barrel': {
      const g = new CylinderGeometry(0.38, 0.45, 0.95, 6);
      g.translate(0, 0.48, 0);
      return g;
    }
    case 'pillar': {
      const g = new CylinderGeometry(0.3, 0.5, 5, 6);
      g.translate(0, 2.5, 0);
      return g;
    }
    case 'cone': {
      const g = new ConeGeometry(1.1, 3, 6);
      g.translate(0, 1.5, 0);
      return g;
    }
    case 'rock': {
      const g = new IcosahedronGeometry(0.7, 0);
      g.translate(0, 0.45, 0);
      return g;
    }
    case 'plant': {
      const g = new ConeGeometry(0.45, 1.2, 5);
      g.translate(0, 0.6, 0);
      return g;
    }
  }
}

function writeTransforms(mesh: InstancedMesh, instances: PropInstance[]) {
  instances.forEach((p, i) => {
    dummy.position.set(p.position[0], p.position[1], p.position[2]);
    dummy.rotation.set(0, p.rotationY, 0);
    dummy.scale.set(p.scale[0], p.scale[1], p.scale[2]);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function useDisposable<T extends BufferGeometry>(factory: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(factory, deps);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function SolidProps({
  kind,
  instances,
  palette,
}: {
  kind: Exclude<PropKind, 'lamp'>;
  instances: PropInstance[];
  palette: Palette;
}) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useDisposable(() => makeGeometry(kind), [kind]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    writeTransforms(mesh, instances);
    instances.forEach((p, i) => {
      mesh.setColorAt(i, tmpColor.set(palette[p.colorRole]));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [instances, palette]);

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, instances.length]}>
      <meshStandardMaterial flatShading color="#ffffff" />
    </instancedMesh>
  );
}

/** Lamps are two instanced meshes sharing transforms: a post and an emissive glow. */
function LampProps({ instances, palette }: { instances: PropInstance[]; palette: Palette }) {
  const postRef = useRef<InstancedMesh>(null);
  const glowRef = useRef<InstancedMesh>(null);
  const postGeo = useDisposable(() => {
    const g = new BoxGeometry(0.14, 2.1, 0.14);
    g.translate(0, 1.05, 0);
    return g;
  }, []);
  const glowGeo = useDisposable(() => {
    const g = new OctahedronGeometry(0.26, 0);
    g.translate(0, 2.2, 0);
    return g;
  }, []);

  useLayoutEffect(() => {
    if (postRef.current) writeTransforms(postRef.current, instances);
    if (glowRef.current) writeTransforms(glowRef.current, instances);
  }, [instances]);

  return (
    <group>
      <instancedMesh ref={postRef} args={[postGeo, undefined, instances.length]}>
        <meshStandardMaterial flatShading color={palette.secondary} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[glowGeo, undefined, instances.length]}>
        <meshStandardMaterial
          color={palette.emissive}
          emissive={palette.emissive}
          emissiveIntensity={2}
        />
      </instancedMesh>
    </group>
  );
}

export function Props({ props, palette }: { props: PropInstance[]; palette: Palette }) {
  const byKind = useMemo(() => {
    const groups = new Map<PropKind, PropInstance[]>();
    for (const p of props) {
      const list = groups.get(p.kind);
      if (list) list.push(p);
      else groups.set(p.kind, [p]);
    }
    return groups;
  }, [props]);

  return (
    <group>
      {[...byKind.entries()].map(([kind, instances]) =>
        kind === 'lamp' ? (
          <LampProps key={kind} instances={instances} palette={palette} />
        ) : (
          <SolidProps key={kind} kind={kind} instances={instances} palette={palette} />
        ),
      )}
    </group>
  );
}
