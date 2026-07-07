import type { Environment, Location, Scale, Setting } from '../spec/worldSpec';
import { MOOD_STYLES, TIME_STYLES, hslToHex } from './palettes';
import { hashString, mulberry32 } from './random';
import { estimateTriangles } from './triangles';

/**
 * Pure procedural generation: Environment -> LocationBlueprint.
 * No three.js, no React — everything here is plain data, deterministic from
 * the spec, and unit-testable in node. Components map blueprints to meshes.
 */

export type PropKind =
  | 'block'
  | 'barrel'
  | 'pillar'
  | 'cone'
  | 'rock'
  | 'lamp'
  | 'plant';

export type ColorRole = 'primary' | 'secondary' | 'accent';

export interface PropInstance {
  kind: PropKind;
  /** y is the base of the prop (props sit on the ground plane). */
  position: [number, number, number];
  rotationY: number;
  scale: [number, number, number];
  colorRole: ColorRole;
}

export interface Palette {
  ground: string;
  sky: string;
  fog: string;
  primary: string;
  secondary: string;
  accent: string;
  emissive: string;
  /** Portal glow — NOT dimmed by time of day, so travel points stay visible at night. */
  portal: string;
}

export interface LightingParams {
  ambientIntensity: number;
  sunIntensity: number;
  sunColor: string;
  sunPosition: [number, number, number];
  fogColor: string;
  fogNear: number;
  fogFar: number;
  background: string;
  /** Warm point light for enclosed settings (hearth/lantern feel); null outdoors. */
  interior: { intensity: number; color: string; position: [number, number, number] } | null;
}

export interface GroundParams {
  kind: 'floor' | 'terrain' | 'water' | 'cave' | 'deck';
  /** Side length of the ground plane (or deck length). */
  size: number;
  /** Plane subdivisions per side. 1 for flat kinds. */
  segments: number;
  /** Max vertex height for terrain/cave kinds; 0 for flat. */
  heightAmplitude: number;
}

export interface EnclosureParams {
  kind: 'room' | 'cave-dome' | 'hull';
  height: number;
}

export interface LocationBlueprint {
  seed: number;
  /** Walkable clamp radius; portals sit just inside it. */
  boundsRadius: number;
  palette: Palette;
  lighting: LightingParams;
  ground: GroundParams;
  enclosure: EnclosureParams | null;
  props: PropInstance[];
  triangleEstimate: number;
}

interface ScaleInfo {
  radius: number;
  propMin: number;
  propMax: number;
}

const SCALE_INFO: Record<Scale, ScaleInfo> = {
  intimate: { radius: 8, propMin: 12, propMax: 20 },
  medium: { radius: 18, propMin: 30, propMax: 60 },
  vast: { radius: 40, propMin: 80, propMax: 140 },
};

/** Prop mix per setting; picked from with seeded randomness. */
const SETTING_PROPS: Record<Setting, PropKind[]> = {
  indoor: ['block', 'barrel', 'lamp', 'block'],
  'outdoor-land': ['cone', 'rock', 'plant', 'block', 'cone'],
  'outdoor-water': ['barrel', 'rock', 'block'],
  underground: ['pillar', 'rock', 'cone', 'lamp'],
  vehicle: ['barrel', 'block', 'lamp', 'barrel'],
};

/** Keep the area around the spawn point (world origin) clear. */
const SPAWN_CLEARANCE = 2.5;
/** Keep the portal ring at the perimeter clear. */
const PORTAL_RING_CLEARANCE = 2.5;

function walkableRadius(env: Environment): number {
  const base = SCALE_INFO[env.scale].radius;
  // On water the walkable area is a small island/raft; the water plane
  // itself extends far beyond it.
  if (env.setting === 'outdoor-water') {
    return Math.min(12, Math.max(6, base * 0.4));
  }
  return base;
}

function makePalette(env: Environment, rand: () => number): Palette {
  const mood = MOOD_STYLES[env.mood];
  const time = TIME_STYLES[env.timeOfDay ?? 'day'];
  // era influences the palette only through a small deterministic hue nudge
  const hueNudge = rand() * 24 - 12;
  const hue = mood.baseHue + hueNudge;
  const sat = mood.saturation;
  const gl = time.groundLightness;
  return {
    ground: hslToHex(hue, sat * 0.8, 0.3 * gl),
    sky: hslToHex(hue + 15, sat * 0.7, 0.65 * time.skyLightness),
    fog: hslToHex(hue + 10, sat * 0.5, 0.55 * time.skyLightness),
    primary: hslToHex(hue, sat, 0.45 * gl),
    secondary: hslToHex(hue + 30, sat * 0.85, 0.38 * gl),
    accent: hslToHex(mood.accentHue, Math.min(1, sat * 1.5), 0.55 * gl),
    emissive: hslToHex(40, 0.9, 0.62),
    portal: hslToHex(mood.accentHue, Math.min(1, sat * 1.6), 0.6),
  };
}

function makeGround(env: Environment, boundsRadius: number): GroundParams {
  switch (env.setting) {
    case 'indoor':
      return { kind: 'floor', size: boundsRadius * 2 + 1, segments: 1, heightAmplitude: 0 };
    case 'outdoor-land':
      return {
        kind: 'terrain',
        size: boundsRadius * 4,
        segments: 28,
        heightAmplitude: boundsRadius * 0.18,
      };
    case 'outdoor-water':
      return { kind: 'water', size: boundsRadius * 10, segments: 8, heightAmplitude: 0 };
    case 'underground':
      return {
        kind: 'cave',
        size: boundsRadius * 2.4,
        segments: 16,
        heightAmplitude: boundsRadius * 0.06,
      };
    case 'vehicle':
      return { kind: 'deck', size: boundsRadius * 2 + 1, segments: 1, heightAmplitude: 0 };
  }
}

function makeEnclosure(env: Environment, boundsRadius: number): EnclosureParams | null {
  switch (env.setting) {
    case 'indoor':
      return { kind: 'room', height: Math.max(3.5, boundsRadius * 0.45) };
    case 'underground':
      return { kind: 'cave-dome', height: Math.max(5, boundsRadius * 0.8) };
    case 'vehicle':
      return { kind: 'hull', height: 1.1 };
    case 'outdoor-land':
    case 'outdoor-water':
      return null;
  }
}

function makeLighting(env: Environment, palette: Palette, boundsRadius: number): LightingParams {
  const mood = MOOD_STYLES[env.mood];
  const time = TIME_STYLES[env.timeOfDay ?? 'day'];
  const underground = env.setting === 'underground';
  const indoor = env.setting === 'indoor';
  // indoor room, cave, or ship deck: all get a warm fill light (hearth/lanterns)
  const enclosed = underground || indoor || env.setting === 'vehicle';
  // Interiors mute the sun; caves nearly kill it (the interior light carries them).
  const sunScale = underground ? 0.05 : indoor ? 0.45 : 1;
  const ambientBoost = enclosed ? 0.3 : 0;
  const horizontal = boundsRadius * 1.5;
  const fogNear = Math.max(2, boundsRadius * 0.6 * mood.fogFactor);
  const fogFar = Math.max(fogNear + boundsRadius, boundsRadius * (1.8 + mood.fogFactor));
  const dim = time.sunIntensity < 1; // night/dusk: interior light dominates
  return {
    ambientIntensity: time.ambientIntensity + ambientBoost,
    sunIntensity: time.sunIntensity * sunScale,
    sunColor: time.sunColor,
    sunPosition: [horizontal * 0.7, horizontal * time.sunElevation, horizontal * 0.4],
    fogColor: palette.fog,
    fogNear,
    fogFar,
    background: palette.sky,
    interior: enclosed
      ? {
          // point-light intensity scales with area (three uses physical falloff)
          intensity: boundsRadius * boundsRadius * (dim ? 0.6 : 0.3),
          color: palette.emissive,
          position: [0, Math.max(2.5, boundsRadius * 0.35), 0],
        }
      : null,
  };
}

interface PropShape {
  /** Base dimensions [x, y, z] before per-instance scale jitter. */
  base: [number, number, number];
  jitter: number;
  colorRole: ColorRole;
}

const PROP_SHAPES: Record<PropKind, PropShape> = {
  block: { base: [1, 0.9, 1], jitter: 0.5, colorRole: 'secondary' },
  barrel: { base: [1, 1, 1], jitter: 0.25, colorRole: 'primary' },
  pillar: { base: [1, 1, 1], jitter: 0.4, colorRole: 'secondary' },
  cone: { base: [1, 1, 1], jitter: 0.6, colorRole: 'accent' },
  rock: { base: [1, 0.8, 1], jitter: 0.7, colorRole: 'secondary' },
  lamp: { base: [1, 1, 1], jitter: 0.1, colorRole: 'primary' },
  plant: { base: [0.8, 0.8, 0.8], jitter: 0.5, colorRole: 'accent' },
};

function makeProps(
  env: Environment,
  boundsRadius: number,
  rand: () => number,
): PropInstance[] {
  const { propMin, propMax } = SCALE_INFO[env.scale];
  const kinds = SETTING_PROPS[env.setting];
  const count = propMin + Math.floor(rand() * (propMax - propMin + 1));
  const inner = SPAWN_CLEARANCE;
  const outer = Math.max(inner + 0.5, boundsRadius - PORTAL_RING_CLEARANCE);
  const props: PropInstance[] = [];
  for (let i = 0; i < count; i++) {
    const kind = kinds[Math.floor(rand() * kinds.length)] ?? 'block';
    const shape = PROP_SHAPES[kind];
    const angle = rand() * Math.PI * 2;
    // sqrt for even area distribution across the ring
    const t = rand();
    const radius = Math.sqrt(inner * inner + t * (outer * outer - inner * inner));
    const s = 1 + (rand() * 2 - 1) * shape.jitter;
    props.push({
      kind,
      position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
      rotationY: rand() * Math.PI * 2,
      scale: [shape.base[0] * s, shape.base[1] * (1 + (rand() * 2 - 1) * shape.jitter), shape.base[2] * s],
      colorRole: shape.colorRole,
    });
  }
  return props;
}

export function generateBlueprint(bookSlug: string, location: Location): LocationBlueprint {
  const env = location.environment;
  const seed = hashString(`${bookSlug}:${location.id}:${env.era ?? ''}`);
  const rand = mulberry32(seed);
  const boundsRadius = walkableRadius(env);
  const palette = makePalette(env, rand);
  const ground = makeGround(env, boundsRadius);
  const enclosure = makeEnclosure(env, boundsRadius);
  const lighting = makeLighting(env, palette, boundsRadius);
  const props = makeProps(env, boundsRadius, rand);
  const partial = { seed, boundsRadius, palette, lighting, ground, enclosure, props };
  return { ...partial, triangleEstimate: estimateTriangles(partial) };
}
