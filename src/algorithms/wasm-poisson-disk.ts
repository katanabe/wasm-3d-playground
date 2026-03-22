import type { TerrainParams } from "../terrain";
import { poisson_disk_placement } from "../../crates/terrain-wasm/pkg/terrain_wasm.js";

export function wasmPoissonDisk(
  count: number,
  seed: number,
  terrain: TerrainParams
): Float32Array {
  const result = poisson_disk_placement(count, seed, terrain.size);
  return new Float32Array(result);
}
