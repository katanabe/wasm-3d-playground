import { useEffect, useRef, useCallback } from "react";
import { createScene } from "../scene";
import { generateTerrainGeometry, generateTerrainGeometryWasm } from "../terrain";
import { surfaceRandom } from "../algorithms/surface-random";
import { poissonDisk } from "../algorithms/poisson-disk";
import { wasmSurfaceRandom } from "../algorithms/wasm-surface-random";
import { wasmPoissonDisk } from "../algorithms/wasm-poisson-disk";
import type { GenerateParams, AlgorithmType, Metrics } from "../types";
import type { TerrainParams } from "../terrain";

const algorithms: Record<AlgorithmType, (count: number, seed: number, terrain: TerrainParams) => Float32Array> = {
  surface_random: surfaceRandom,
  poisson_disk: poissonDisk,
  wasm_surface_random: wasmSurfaceRandom,
  wasm_poisson_disk: wasmPoissonDisk,
};

type SceneHandle = ReturnType<typeof createScene>;

export function useScene(setMetrics: React.Dispatch<React.SetStateAction<Metrics>>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);

  useEffect(() => {
    if (!canvasRef.current || sceneRef.current) return;
    sceneRef.current = createScene(canvasRef.current);

    const interval = setInterval(() => {
      if (sceneRef.current) {
        setMetrics((prev) => ({ ...prev, fps: sceneRef.current!.getFps() }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [setMetrics]);

  const generate = useCallback((params: GenerateParams) => {
    const scene = sceneRef.current;
    if (!scene) return;

    scene.setObjectShape(params.objectShape);

    const t0 = performance.now();
    const terrainGeometry = params.terrainEngine === "wasm"
      ? generateTerrainGeometryWasm(params.terrainParams)
      : generateTerrainGeometry(params.terrainParams);
    const t1 = performance.now();
    scene.setTerrain(terrainGeometry);

    const isWasm = params.algorithm.startsWith("wasm");
    const t2 = performance.now();
    const positions = algorithms[params.algorithm](params.count, params.seed, params.terrainParams);
    const t3 = performance.now();
    scene.setInstances(positions, isWasm);
    const t4 = performance.now();

    const engine = isWasm ? "wasm" : "js";
    setMetrics({
      terrainTime: `${(t1 - t0).toFixed(2)} (${params.terrainEngine})`,
      placementTime: `${(t3 - t2).toFixed(2)} + render ${(t4 - t3).toFixed(2)} (${engine})`,
      count: positions.length / 3,
      fps: scene.getFps(),
    });
  }, [setMetrics]);

  return { canvasRef, generate };
}
