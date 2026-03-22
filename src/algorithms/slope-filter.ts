import type { TerrainParams } from "../terrain";
import { sampleTerrainHeight } from "../terrain";

// Random placement filtered by terrain slope
// Only places objects where slope is below threshold (flat-ish areas)
export function slopeFilter(
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

  const maxSlope = 0.4; // max slope threshold (rise/run)
  const sampleDelta = 0.5; // distance to sample for slope calc
  const maxAttempts = count * 5;
  const points: number[] = [];

  for (let attempt = 0; attempt < maxAttempts && points.length / 2 < count; attempt++) {
    const x = (rand() - 0.5) * terrain.size;
    const z = (rand() - 0.5) * terrain.size;

    const h = sampleTerrainHeight(x, z, terrain);
    const hx = sampleTerrainHeight(x + sampleDelta, z, terrain);
    const hz = sampleTerrainHeight(x, z + sampleDelta, terrain);

    const slopeX = Math.abs(hx - h) / sampleDelta;
    const slopeZ = Math.abs(hz - h) / sampleDelta;
    const slope = Math.sqrt(slopeX * slopeX + slopeZ * slopeZ);

    if (slope < maxSlope) {
      points.push(x, z);
    }
  }

  const totalPoints = points.length / 2;
  const positions = new Float32Array(totalPoints * 3);
  for (let i = 0; i < totalPoints; i++) {
    positions[i * 3] = points[i * 2];
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = points[i * 2 + 1];
  }
  return positions;
}
