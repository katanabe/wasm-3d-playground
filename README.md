# wasm-3d-playground

Wasm (Rust) + three.js + TypeScript で作る3D地形生成 & オブジェクト配置の実験場。

![Winter Mountain Scene](https://img.shields.io/badge/three.js-r183-blue) ![Rust](https://img.shields.io/badge/Rust-Wasm-orange) ![Vite](https://img.shields.io/badge/Vite-8-purple)

## 概要

ノイズベースの地形生成と、その表面へのオブジェクト配置を JS / Wasm で比較検証するプロジェクト。

### 検証テーマ

- **Wasm の適用範囲**: どの処理を Wasm に移すべきか
- **配置アルゴリズムの比較**: Surface Random / Poisson Disk / Slope Filter
- **データ転送コスト**: JS ↔ Wasm の境界設計
- **描画手法**: InstancedMesh による大量オブジェクト描画

### 主な発見

| Count | JS (raycast) | Wasm (height baked) |
|-------|-------------|---------------------|
| 1,000 | 1,693ms | 0.2ms |
| 5,000 | 8,347ms | 0.5ms |
| 10,000 | 16,638ms | 0.7ms |

Wasm に地形高さ計算を含めて raycast を排除することで **約24,000倍の高速化** を達成。

## 技術スタック

- **TypeScript** + **Vite**
- **three.js** (WebGL 描画、OrbitControls)
- **Rust** → **wasm-pack** (Perlin ノイズ地形生成、配置アルゴリズム)
- **vite-plugin-wasm**

## セットアップ

```bash
# 依存インストール
npm install

# Wasm ビルド
cd crates/terrain-wasm
wasm-pack build --target web --release
cd ../..

# 開発サーバー
npm run dev
```

### 前提

- Node.js 18+
- Rust + wasm-pack (`cargo install wasm-pack`)

## 機能

### 地形生成
- Perlin ノイズベースの起伏生成
- パラメータ: Height / Noise Scale / Octaves / Seed
- JS / Wasm エンジン切替
- 高度に応じたシェーダーカラー (凍土 → 岩 → 雪)

### 配置アルゴリズム

| アルゴリズム | 特徴 | 実装 |
|------------|------|------|
| Surface Random | 均一ランダム | JS / Wasm |
| Poisson Disk | 均等間隔 (衝突回避) | JS / Wasm |
| Slope Filter | 急斜面を避ける | JS |

### 描画
- InstancedMesh による大量オブジェクト描画
- カラーバリエーション (per-instance color)
- OrbitControls (回転 / パン / ズーム)
- 霧 + 高度ベースシェーダー

## プロジェクト構成

```
src/
├── main.ts              # エントリ、UI接続、計測
├── scene.ts             # three.js シーン、InstancedMesh、シェーダー
├── terrain.ts           # Perlin ノイズ地形生成 (JS / Wasm)
└── algorithms/
    ├── surface-random.ts
    ├── poisson-disk.ts
    ├── slope-filter.ts
    ├── wasm-surface-random.ts
    └── wasm-poisson-disk.ts

crates/terrain-wasm/
└── src/lib.rs           # Rust Wasm: 地形高さ生成、配置アルゴリズム
```

## License

MIT
