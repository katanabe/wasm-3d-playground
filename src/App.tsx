import { useState, useEffect, useCallback } from "react";
import { ControlPanel } from "./components/ControlPanel";
import { useScene } from "./hooks/useScene";
import { ensureWasmInit } from "./algorithms/wasm-surface-random";
import type { GenerateParams, Metrics } from "./types";

const initialMetrics: Metrics = {
  terrainTime: "-",
  placementTime: "-",
  count: 0,
  fps: 0,
};

export function App() {
  const [ready, setReady] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const { canvasRef, generate } = useScene(setMetrics);

  useEffect(() => {
    ensureWasmInit().then(() => setReady(true));
  }, []);

  const handleGenerate = useCallback((params: GenerateParams) => {
    generate(params);
  }, [generate]);

  // Auto-generate on ready
  useEffect(() => {
    if (!ready) return;
    handleGenerate({
      terrainEngine: "wasm",
      terrainParams: {
        size: 250,
        segments: 256,
        height: 30,
        noiseScale: 4,
        octaves: 5,
        seed: 42,
      },
      algorithm: "wasm_surface_random",
      objectShape: "conifer",
      count: 3000,
      seed: 42,
    });
  }, [ready, handleGenerate]);

  return (
    <>
      <ControlPanel onGenerate={handleGenerate} metrics={metrics} />
      <canvas ref={canvasRef} id="canvas" />
    </>
  );
}
