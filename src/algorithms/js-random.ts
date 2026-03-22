export function jsRandom(count: number, seed: number, spread: number): Float32Array {
  // Simple seeded PRNG (mulberry32)
  let s = seed | 0;
  function rand(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // x, y, z per instance
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    positions[idx] = (rand() - 0.5) * spread;
    positions[idx + 1] = rand() * spread * 0.1; // height
    positions[idx + 2] = (rand() - 0.5) * spread;
  }
  return positions;
}
