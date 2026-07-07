import type { Mood, TimeOfDay } from '../spec/worldSpec';

/**
 * Style lookup tables: mood picks the color family and atmosphere density,
 * timeOfDay picks brightness and light temperature. These are the ONLY inputs
 * to the art direction besides the seed — one system for every book.
 */

export interface MoodStyle {
  /** Base hue in degrees for ground/walls/primary props. */
  baseHue: number;
  /** Contrasting hue for accent props and portal glow. */
  accentHue: number;
  /** 0..1 saturation of the whole palette. */
  saturation: number;
  /** Fog density multiplier: < 1 = denser (fog closes in), > 1 = clearer. */
  fogFactor: number;
}

export const MOOD_STYLES: Record<Mood, MoodStyle> = {
  serene: { baseHue: 160, accentHue: 200, saturation: 0.35, fogFactor: 1.0 },
  tense: { baseHue: 215, accentHue: 10, saturation: 0.18, fogFactor: 0.65 },
  mysterious: { baseHue: 275, accentHue: 300, saturation: 0.3, fogFactor: 0.5 },
  joyful: { baseHue: 45, accentHue: 105, saturation: 0.55, fogFactor: 1.4 },
  desolate: { baseHue: 30, accentHue: 210, saturation: 0.12, fogFactor: 0.8 },
  grand: { baseHue: 225, accentHue: 45, saturation: 0.45, fogFactor: 1.2 },
};

export interface TimeStyle {
  sunIntensity: number;
  ambientIntensity: number;
  /** Hex color of the directional light. */
  sunColor: string;
  /** Sun elevation as a fraction of horizontal distance (higher = noon). */
  sunElevation: number;
  /** Multiplier on sky lightness. */
  skyLightness: number;
  /** Multiplier on ground/prop lightness. */
  groundLightness: number;
}

export const TIME_STYLES: Record<TimeOfDay, TimeStyle> = {
  dawn: {
    sunIntensity: 1.6,
    ambientIntensity: 0.45,
    sunColor: '#ffc9a3',
    sunElevation: 0.35,
    skyLightness: 0.75,
    groundLightness: 0.85,
  },
  day: {
    sunIntensity: 2.4,
    ambientIntensity: 0.6,
    sunColor: '#fff4e0',
    sunElevation: 1.2,
    skyLightness: 1.0,
    groundLightness: 1.0,
  },
  dusk: {
    sunIntensity: 1.2,
    ambientIntensity: 0.4,
    sunColor: '#ff9d6b',
    sunElevation: 0.25,
    skyLightness: 0.55,
    groundLightness: 0.7,
  },
  night: {
    sunIntensity: 0.35,
    ambientIntensity: 0.4,
    sunColor: '#a3b8e0',
    sunElevation: 0.8,
    skyLightness: 0.22,
    groundLightness: 0.6,
  },
};

/** h in degrees (any range), s and l in [0, 1]. Returns "#rrggbb". */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.min(1, Math.max(0, s));
  const light = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
