import type { TerrainParams } from "../terrain";

// Random xz placement on terrain bounds (y is determined by raycast in scene)
export function surfaceRandom(
  count: number,
  seed: number,
  terrain: TerrainParams
): Float32Array {
  let s = seed | 0;
  function rand(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (rand() - 0.5) * terrain.size;
    positions[i * 3 + 1] = 0; // placeholder, overridden by raycast
    positions[i * 3 + 2] = (rand() - 0.5) * terrain.size;
  }

  return positions;
}
