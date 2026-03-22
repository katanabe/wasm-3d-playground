import type { TerrainParams } from "../terrain";
import init, {
  surface_random_placement,
} from "../../crates/terrain-wasm/pkg/terrain_wasm.js";

let initialized = false;

export async function ensureWasmInit() {
  if (!initialized) {
    await init();
    initialized = true;
  }
}

export function wasmSurfaceRandom(
  count: number,
  seed: number,
  terrain: TerrainParams
): Float32Array {
  const result = surface_random_placement(count, seed, terrain.size);
  return new Float32Array(result);
}
