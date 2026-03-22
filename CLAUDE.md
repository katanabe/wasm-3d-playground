# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
# Dev server
npm run dev

# Wasm build (必須: TS側から参照される)
cd crates/terrain-wasm && wasm-pack build --target web --release && cd ../..

# Type check
npx tsc --noEmit

# Production build
npm run build
```

Wasm変更時は `wasm-pack build` → ブラウザリロードが必要。TSのみの変更はHMRで即反映。

## Architecture

```
main.ts          UI接続、計測、Generate実行のオーケストレーション
  ↓
terrain.ts       Perlinノイズ地形生成 (JS版 / Wasm版の2実装)
  ↓
scene.ts         three.jsシーン管理、カスタムシェーダー、InstancedMesh配置
  ↓
algorithms/      配置アルゴリズム (JS版はxz座標のみ返す、Wasm版は高さ込み)
```

### JS vs Wasm の境界設計

**核心**: Wasm版は配置座標と地形高さを一括計算して返す (`heightBaked=true`)。JS版はxz座標のみ返し、scene.ts内でraycastで高さを取る（遅い）。

- `wasm-surface-random.ts` → Rust `surface_random_with_height()` を呼ぶ
- `wasm-poisson-disk.ts` → Rust `poisson_disk_with_height()` を呼ぶ
- JS版はraycastのため `setInstances(positions, false)` で呼ばれる

### Wasm クレート (crates/terrain-wasm/)

Rust → `wasm-pack build --target web` → `pkg/` にJS bindingsが生成される。`pkg/`はgitignore。TS側は `../../crates/terrain-wasm/pkg/terrain_wasm.js` を直接importする。

### シェーダー (scene.ts内)

地形は `ShaderMaterial` で高度ベースの色分け（凍土→岩→雪）+ 斜面ブレンド + 霧。MeshStandardMaterialではない。

### InstancedMesh

配置オブジェクトは全て `InstancedMesh` で描画。per-instance colorで色バリエーション。`dummy Object3D` でmatrix計算してsetMatrixAt。

## 注意点

- `renderer.setSize()` がcanvasのCSS幅を上書きしてflex layoutを壊すため、resize時に `canvas.style.width = "100%"` をリセットしてからgetBoundingClientRectする。
- Perlinノイズの `mulberry32` PRNGはJS/Rust間で同一実装。seed値が同じなら同じ出力。
- 地形サイズ250、segments 256。DEFAULT_TERRAINは `terrain.ts` に定義。
