import type { TerrainParams } from "../terrain";
import { poisson_disk_with_height } from "../../crates/terrain-wasm/pkg/terrain_wasm.js";

export function wasmPoissonDisk(
  count: number,
  seed: number,
  terrain: TerrainParams
): Float32Array {
  const result = poisson_disk_with_height(
    count,
    seed,
    terrain.size,
    terrain.height,
    terrain.noiseScale,
    terrain.octaves,
    terrain.seed
  );
  return new Float32Array(result);
}
