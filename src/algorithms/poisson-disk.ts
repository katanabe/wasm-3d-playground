import type { TerrainParams } from "../terrain";

// Bridson's algorithm for Poisson Disk Sampling in 2D
// Returns evenly-spaced points with minimum distance between them
export function poissonDisk(
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

  const size = terrain.size;
  const half = size / 2;

  // Derive min distance from count (approximate density)
  const area = size * size;
  const minDist = Math.sqrt(area / (count * 2));
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil(size / cellSize);
  const gridH = Math.ceil(size / cellSize);
  const grid: number[] = new Array(gridW * gridH).fill(-1);
  const k = 30; // rejection limit

  const points: number[] = [];
  const active: number[] = [];

  function gridIndex(x: number, z: number): number {
    const gx = Math.floor((x + half) / cellSize);
    const gz = Math.floor((z + half) / cellSize);
    return gz * gridW + gx;
  }

  function inBounds(x: number, z: number): boolean {
    return x >= -half && x < half && z >= -half && z < half;
  }

  function tooClose(x: number, z: number): boolean {
    const gx = Math.floor((x + half) / cellSize);
    const gz = Math.floor((z + half) / cellSize);

    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx;
        const nz = gz + dz;
        if (nx < 0 || nx >= gridW || nz < 0 || nz >= gridH) continue;
        const idx = grid[nz * gridW + nx];
        if (idx === -1) continue;
        const px = points[idx * 2];
        const pz = points[idx * 2 + 1];
        const distSq = (x - px) * (x - px) + (z - pz) * (z - pz);
        if (distSq < minDist * minDist) return true;
      }
    }
    return false;
  }

  function addPoint(x: number, z: number) {
    const i = points.length / 2;
    points.push(x, z);
    active.push(i);
    grid[gridIndex(x, z)] = i;
  }

  // Start with a random point
  addPoint((rand() - 0.5) * size, (rand() - 0.5) * size);

  while (active.length > 0 && points.length / 2 < count) {
    const activeIdx = (rand() * active.length) | 0;
    const pointIdx = active[activeIdx];
    const px = points[pointIdx * 2];
    const pz = points[pointIdx * 2 + 1];

    let found = false;
    for (let attempt = 0; attempt < k; attempt++) {
      const angle = rand() * Math.PI * 2;
      const dist = minDist + rand() * minDist;
      const nx = px + Math.cos(angle) * dist;
      const nz = pz + Math.sin(angle) * dist;

      if (inBounds(nx, nz) && !tooClose(nx, nz)) {
        addPoint(nx, nz);
        found = true;
        break;
      }
    }

    if (!found) {
      active.splice(activeIdx, 1);
    }
  }

  // Convert to Float32Array (x, y=0, z)
  const totalPoints = points.length / 2;
  const positions = new Float32Array(totalPoints * 3);
  for (let i = 0; i < totalPoints; i++) {
    positions[i * 3] = points[i * 2];
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = points[i * 2 + 1];
  }
  return positions;
}
