import "./style.css";
import { createScene, type ObjectShape } from "./scene";
import { generateTerrainGeometry, generateTerrainGeometryWasm, DEFAULT_TERRAIN, type TerrainParams } from "./terrain";
import { surfaceRandom } from "./algorithms/surface-random";
import { poissonDisk } from "./algorithms/poisson-disk";
import { slopeFilter } from "./algorithms/slope-filter";
import { ensureWasmInit, wasmSurfaceRandom } from "./algorithms/wasm-surface-random";
import { wasmPoissonDisk } from "./algorithms/wasm-poisson-disk";

type AlgorithmType = "surface_random" | "poisson_disk" | "slope_filter" | "wasm_surface_random" | "wasm_poisson_disk";

const algorithms: Record<AlgorithmType, (count: number, seed: number, terrain: TerrainParams) => Float32Array> = {
  surface_random: surfaceRandom,
  poisson_disk: poissonDisk,
  slope_filter: slopeFilter,
  wasm_surface_random: wasmSurfaceRandom,
  wasm_poisson_disk: wasmPoissonDisk,
};

// DOM elements
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const terrainModeSelect = document.getElementById("terrain-mode") as HTMLSelectElement;
const terrainHeightInput = document.getElementById("terrain-height") as HTMLInputElement;
const terrainHeightValue = document.getElementById("terrain-height-value") as HTMLSpanElement;
const noiseScaleInput = document.getElementById("noise-scale") as HTMLInputElement;
const noiseScaleValue = document.getElementById("noise-scale-value") as HTMLSpanElement;
const octavesInput = document.getElementById("octaves") as HTMLInputElement;
const octavesValue = document.getElementById("octaves-value") as HTMLSpanElement;
const objectShapeSelect = document.getElementById("object-shape") as HTMLSelectElement;
const algorithmSelect = document.getElementById("algorithm") as HTMLSelectElement;
const densityInput = document.getElementById("density") as HTMLInputElement;
const densityValue = document.getElementById("density-value") as HTMLSpanElement;
const seedInput = document.getElementById("seed") as HTMLInputElement;
const generateBtn = document.getElementById("generate") as HTMLButtonElement;
const terrainTimeEl = document.getElementById("terrain-time") as HTMLSpanElement;
const computeTimeEl = document.getElementById("compute-time") as HTMLSpanElement;
const instanceCountEl = document.getElementById("instance-count") as HTMLSpanElement;
const fpsEl = document.getElementById("fps") as HTMLSpanElement;

function getTerrainParams(): TerrainParams {
  return {
    ...DEFAULT_TERRAIN,
    height: parseFloat(terrainHeightInput.value),
    noiseScale: parseFloat(noiseScaleInput.value),
    octaves: parseInt(octavesInput.value, 10),
    seed: parseInt(seedInput.value, 10),
  };
}

// Sync slider labels
for (const [input, label] of [
  [terrainHeightInput, terrainHeightValue],
  [noiseScaleInput, noiseScaleValue],
  [octavesInput, octavesValue],
  [densityInput, densityValue],
] as [HTMLInputElement, HTMLSpanElement][]) {
  input.addEventListener("input", () => {
    label.textContent = input.value;
  });
}

async function main() {
  await ensureWasmInit();
  const scene = createScene(canvas);

  generateBtn.addEventListener("click", () => {
    const terrainParams = getTerrainParams();
    const useWasmTerrain = terrainModeSelect.value === "wasm";

    scene.setObjectShape(objectShapeSelect.value as ObjectShape);

    const t0 = performance.now();
    const terrainGeometry = useWasmTerrain
      ? generateTerrainGeometryWasm(terrainParams)
      : generateTerrainGeometry(terrainParams);
    const t1 = performance.now();
    scene.setTerrain(terrainGeometry);

    const algo = algorithmSelect.value as AlgorithmType;
    const count = parseInt(densityInput.value, 10);
    const seed = parseInt(seedInput.value, 10);

    const isWasmAlgo = algo.startsWith("wasm");
    const t2 = performance.now();
    const positions = algorithms[algo](count, seed, terrainParams);
    const t3 = performance.now();
    scene.setInstances(positions, isWasmAlgo);
    const t4 = performance.now();

    const engine = isWasmAlgo ? "wasm" : "js";
    terrainTimeEl.textContent = `${(t1 - t0).toFixed(2)} (${useWasmTerrain ? "wasm" : "js"})`;
    computeTimeEl.textContent = `${(t3 - t2).toFixed(2)} + render ${(t4 - t3).toFixed(2)} (${engine})`;
    instanceCountEl.textContent = String(positions.length / 3);
  });

  generateBtn.click();

  setInterval(() => {
    fpsEl.textContent = String(scene.getFps());
  }, 1000);
}

main();
