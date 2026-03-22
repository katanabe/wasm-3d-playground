import type { TerrainParams } from "./terrain";

export type AlgorithmType = "surface_random" | "poisson_disk" | "wasm_surface_random" | "wasm_poisson_disk";

export type ObjectShape = "conifer" | "none";

export type Metrics = {
  terrainTime: string;
  placementTime: string;
  count: number;
  fps: number;
};

export type GenerateParams = {
  terrainEngine: "js" | "wasm";
  terrainParams: TerrainParams;
  algorithm: AlgorithmType;
  objectShape: ObjectShape;
  count: number;
  seed: number;
};
