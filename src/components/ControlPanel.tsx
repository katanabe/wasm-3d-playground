import { useState } from "react";
import { DEFAULT_TERRAIN } from "../terrain";
import type { AlgorithmType, ObjectShape, GenerateParams, Metrics } from "../types";

type Props = {
  onGenerate: (params: GenerateParams) => void;
  metrics: Metrics;
};

export function ControlPanel({ onGenerate, metrics }: Props) {
  const [terrainEngine, setTerrainEngine] = useState<"js" | "wasm">("wasm");
  const [height, setHeight] = useState(DEFAULT_TERRAIN.height);
  const [noiseScale, setNoiseScale] = useState(DEFAULT_TERRAIN.noiseScale);
  const [octaves, setOctaves] = useState(DEFAULT_TERRAIN.octaves);
  const [objectShape, setObjectShape] = useState<ObjectShape>("conifer");
  const [algorithm, setAlgorithm] = useState<AlgorithmType>("wasm_surface_random");
  const [count, setCount] = useState(3000);
  const [seed, setSeed] = useState(42);

  const handleGenerate = () => {
    onGenerate({
      terrainEngine,
      terrainParams: {
        ...DEFAULT_TERRAIN,
        height,
        noiseScale,
        octaves,
        seed,
      },
      algorithm,
      objectShape,
      count,
      seed,
    });
  };

  return (
    <div id="control-panel">
      <h2>Terrain</h2>
      <label>
        Engine
        <select value={terrainEngine} onChange={(e) => setTerrainEngine(e.target.value as "js" | "wasm")}>
          <option value="wasm">Wasm (Rust)</option>
          <option value="js">JS</option>
        </select>
      </label>
      <label>
        Height
        <input type="range" min={1} max={60} step={1} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
        <span>{height}</span>
      </label>
      <label>
        Noise Scale
        <input type="range" min={1} max={10} step={0.5} value={noiseScale} onChange={(e) => setNoiseScale(Number(e.target.value))} />
        <span>{noiseScale}</span>
      </label>
      <label>
        Octaves
        <input type="range" min={1} max={8} step={1} value={octaves} onChange={(e) => setOctaves(Number(e.target.value))} />
        <span>{octaves}</span>
      </label>

      <h2>Placement</h2>
      <label>
        Object
        <select value={objectShape} onChange={(e) => setObjectShape(e.target.value as ObjectShape)}>
          <option value="conifer">Conifer</option>
          <option value="none">None</option>
        </select>
      </label>
      <label>
        Algorithm
        <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}>
          <option value="wasm_surface_random">Wasm Surface Random</option>
          <option value="wasm_poisson_disk">Wasm Poisson Disk</option>
          <option value="surface_random">JS Surface Random</option>
          <option value="poisson_disk">JS Poisson Disk</option>
        </select>
      </label>
      <label>
        Count
        <input type="range" min={100} max={50000} step={100} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        <span>{count}</span>
      </label>
      <label>
        Seed
        <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
      </label>

      <button onClick={handleGenerate}>Generate</button>

      <div id="metrics">
        <p>Terrain: {metrics.terrainTime} ms</p>
        <p>Placement: {metrics.placementTime} ms</p>
        <p>Count: {metrics.count}</p>
        <p>FPS: {metrics.fps}</p>
      </div>
    </div>
  );
}
