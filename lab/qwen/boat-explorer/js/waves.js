// js/waves.js — shared Gerstner wave field. CPU + GPU(boilerplate in ocean.js) stay in sync.
import * as THREE from 'three';

export const WIND_DIR = new THREE.Vector2(0.82, 0.57).normalize(); // world wind
export const WIND_STRENGTH = 1.0;

// Gerstner waves: [dirX, dirZ, steepness(0..1 of wl), wavelength, speed]
export const WAVES = [
  [ 0.82,  0.57, 0.10, 34.0, 1.00],
  [ 0.55, -0.70, 0.08, 19.0, 1.15],
  [-0.35,  0.88, 0.06, 11.0, 1.35],
  [ 0.95,  0.10, 0.045, 6.5, 1.60],
  [-0.70, -0.40, 0.03,  4.2, 1.90],
];

// CPU height sampler (matches oceanVert in ocean.js). ishelter = 0..1 wave-shelter (1 = flat water).
export function waveHeight(x, z, t, ishelter = 0) {
  let y = 0;
  const amp = 0.05 + 0.95 * ishelter;
  for (let i = 0; i < WAVES.length; i++) {
    const w = WAVES[i];
    const k = (Math.PI * 2) / w[3];
    const c = Math.sqrt(9.81 / k) * w[4];
    const f = k * (w[0] * x + w[1] * z - c * t);
    y += (w[2] / k) * Math.sin(f) * amp;
  }
  return y;
}

// full CPU Gerstner for the boat: vertical + horizontal displacement & derivatives
export function waveSample(x, z, t, ishelter = 0) {
  let y = 0, dx = 0, dz = 0, sx = 0, sz = 0;
  const amp = 0.05 + 0.95 * ishelter;
  for (let i = 0; i < WAVES.length; i++) {
    const w = WAVES[i];
    const k = (Math.PI * 2) / w[3];
    const c = Math.sqrt(9.81 / k) * w[4];
    const f = k * (w[0] * x + w[1] * z - c * t);
    const sf = Math.sin(f), cf = Math.cos(f);
    const a = (w[2] / k) * amp;
    y += a * sf;
    // Gerstner horizontal push
    dx += w[2] * w[0] * cf * amp;
    dz += w[2] * w[1] * cf * amp;
    // slope derivatives
    sx += a * k * cf * w[0];
    sz += a * k * cf * w[1];
  }
  return { y, dx, dz, slopeX: sx, slopeZ: sz };
}
