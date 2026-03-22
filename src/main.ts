import "./style.css";
import { createScene } from "./scene";
import { generateTerrainGeometry, DEFAULT_TERRAIN, type TerrainParams } from "./terrain";
import { surfaceRandom } from "./algorithms/surface-random";

type AlgorithmType = "surface_random";

const algorithms: Record<AlgorithmType, (count: number, seed: number, terrain: TerrainParams) => Float32Array> = {
  surface_random: surfaceRandom,
};

// DOM elements
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const terrainHeightInput = document.getElementById("terrain-height") as HTMLInputElement;
const terrainHeightValue = document.getElementById("terrain-height-value") as HTMLSpanElement;
const noiseScaleInput = document.getElementById("noise-scale") as HTMLInputElement;
const noiseScaleValue = document.getElementById("noise-scale-value") as HTMLSpanElement;
const octavesInput = document.getElementById("octaves") as HTMLInputElement;
const octavesValue = document.getElementById("octaves-value") as HTMLSpanElement;
const algorithmSelect = document.getElementById("algorithm") as HTMLSelectElement;
const densityInput = document.getElementById("density") as HTMLInputElement;
const densityValue = document.getElementById("density-value") as HTMLSpanElement;
const seedInput = document.getElementById("seed") as HTMLInputElement;
const generateBtn = document.getElementById("generate") as HTMLButtonElement;
const terrainTimeEl = document.getElementById("terrain-time") as HTMLSpanElement;
const computeTimeEl = document.getElementById("compute-time") as HTMLSpanElement;
const instanceCountEl = document.getElementById("instance-count") as HTMLSpanElement;
const fpsEl = document.getElementById("fps") as HTMLSpanElement;

const scene = createScene(canvas);

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

generateBtn.addEventListener("click", () => {
  const terrainParams = getTerrainParams();

  // Generate terrain
  const t0 = performance.now();
  const terrainGeometry = generateTerrainGeometry(terrainParams);
  const t1 = performance.now();
  scene.setTerrain(terrainGeometry);

  // Place objects
  const algo = algorithmSelect.value as AlgorithmType;
  const count = parseInt(densityInput.value, 10);
  const seed = parseInt(seedInput.value, 10);

  const t2 = performance.now();
  const positions = algorithms[algo](count, seed, terrainParams);
  const t3 = performance.now();
  scene.setInstances(positions);

  // Update metrics
  terrainTimeEl.textContent = (t1 - t0).toFixed(2);
  computeTimeEl.textContent = (t3 - t2).toFixed(2);
  instanceCountEl.textContent = String(count);
});

// Initial generate
generateBtn.click();

// FPS display loop
setInterval(() => {
  fpsEl.textContent = String(scene.getFps());
}, 1000);
