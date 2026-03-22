import * as THREE from "three";
import { generate_terrain_heights } from "../crates/terrain-wasm/pkg/terrain_wasm.js";

// Simple 2D value noise with seeded PRNG
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPermutation(seed: number): Uint8Array {
  const rand = mulberry32(seed);
  const p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 256; i++) p[256 + i] = p[i];
  return p;
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : -x;
  const v = h === 0 || h === 3 ? y : -y;
  return u + v;
}

function perlin2D(x: number, y: number, perm: Uint8Array): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const aa = perm[perm[xi] + yi];
  const ab = perm[perm[xi] + yi + 1];
  const ba = perm[perm[xi + 1] + yi];
  const bb = perm[perm[xi + 1] + yi + 1];

  const x1 = grad(aa, xf, yf) * (1 - u) + grad(ba, xf - 1, yf) * u;
  const x2 = grad(ab, xf, yf - 1) * (1 - u) + grad(bb, xf - 1, yf - 1) * u;

  return x1 * (1 - v) + x2 * v;
}

export type TerrainParams = {
  size: number;
  segments: number;
  height: number;
  noiseScale: number;
  octaves: number;
  seed: number;
};

export const DEFAULT_TERRAIN: TerrainParams = {
  size: 80,
  segments: 128,
  height: 15,
  noiseScale: 3,
  octaves: 4,
  seed: 42,
};

export function generateTerrainGeometry(params: TerrainParams): THREE.BufferGeometry {
  const { size, segments, height, noiseScale, octaves, seed } = params;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const posAttr = geometry.getAttribute("position");
  const perm = buildPermutation(seed);

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);

    let h = 0;
    let amp = 1;
    let freq = noiseScale / size;
    for (let o = 0; o < octaves; o++) {
      h += perlin2D(x * freq, z * freq, perm) * amp;
      freq *= 2;
      amp *= 0.5;
    }

    posAttr.setY(i, h * height);
  }

  geometry.computeVertexNormals();
  return geometry;
}

export function generateTerrainGeometryWasm(params: TerrainParams): THREE.BufferGeometry {
  const { size, segments, height, noiseScale, octaves, seed } = params;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const posAttr = geometry.getAttribute("position");
  const heights = generate_terrain_heights(size, segments, height, noiseScale, octaves, seed);

  for (let i = 0; i < posAttr.count; i++) {
    posAttr.setY(i, heights[i]);
  }

  geometry.computeVertexNormals();
  return geometry;
}

// Sample height at arbitrary (x, z) by finding the terrain triangle
export function sampleTerrainHeight(
  x: number,
  z: number,
  params: TerrainParams
): number {
  const { size, noiseScale, octaves, seed, height } = params;
  const perm = buildPermutation(seed);

  let h = 0;
  let amp = 1;
  let freq = noiseScale / size;
  for (let o = 0; o < octaves; o++) {
    h += perlin2D(x * freq, z * freq, perm) * amp;
    freq *= 2;
    amp *= 0.5;
  }
  return h * height;
}
