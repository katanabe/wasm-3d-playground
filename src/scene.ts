import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const TERRAIN_COLOR = new THREE.Color(0x3a5f3a);

export type ObjectShape = "cone" | "sphere" | "box" | "lowpoly_tree" | "rock";

type ShapeDef = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  heightOffset: (scale: number) => number; // how much to lift above terrain
};

function buildShapes(): Record<ObjectShape, ShapeDef> {
  return {
    cone: {
      geometry: new THREE.ConeGeometry(0.3, 1.0, 6),
      material: new THREE.MeshStandardMaterial({ color: 0x44aa88 }),
      heightOffset: (s) => (1.0 * s) / 2,
    },
    sphere: {
      geometry: new THREE.SphereGeometry(0.4, 8, 6),
      material: new THREE.MeshStandardMaterial({ color: 0x66bb66 }),
      heightOffset: (s) => 0.4 * s,
    },
    box: {
      geometry: new THREE.BoxGeometry(0.6, 0.6, 0.6),
      material: new THREE.MeshStandardMaterial({ color: 0x88aa44 }),
      heightOffset: (s) => (0.6 * s) / 2,
    },
    lowpoly_tree: {
      geometry: buildTreeGeometry(),
      material: new THREE.MeshStandardMaterial({ color: 0x2d8a4e, flatShading: true }),
      heightOffset: (s) => 0.05 * s,
    },
    rock: {
      geometry: buildRockGeometry(),
      material: new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true }),
      heightOffset: (s) => 0.15 * s,
    },
  };
}

function buildTreeGeometry(): THREE.BufferGeometry {
  // Trunk (thin cylinder) + canopy (wide cone)
  const trunk = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 5);
  trunk.translate(0, 0.25, 0);
  const canopy = new THREE.ConeGeometry(0.5, 0.8, 6);
  canopy.translate(0, 0.9, 0);

  const merged = new THREE.BufferGeometry();
  // Merge by combining position/normal/index buffers
  const geoms = [trunk, canopy];
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const g of geoms) {
    const pos = g.getAttribute("position");
    const norm = g.getAttribute("normal");
    const idx = g.getIndex();

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
    }
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vertexOffset);
      }
    }
    vertexOffset += pos.count;
  }

  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);

  trunk.dispose();
  canopy.dispose();
  return merged;
}

function buildRockGeometry(): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(0.35, 0);
  // Squash Y a bit for rock-like shape
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) * 0.6);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 100, 60);
  camera.lookAt(0, 0, 0);

  // OrbitControls
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = 5;
  controls.maxDistance = 300;
  controls.maxPolarAngle = Math.PI * 0.85;

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(10, 30, 10);
  scene.add(directional);

  // Terrain mesh
  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: TERRAIN_COLOR,
    wireframe: false,
    flatShading: false,
    side: THREE.DoubleSide,
  });
  let terrainMesh: THREE.Mesh | null = null;

  function setTerrain(geometry: THREE.BufferGeometry) {
    if (terrainMesh) {
      scene.remove(terrainMesh);
      terrainMesh.geometry.dispose();
    }
    terrainMesh = new THREE.Mesh(geometry, terrainMaterial);
    scene.add(terrainMesh);
  }

  // Raycast to get actual terrain height at (x, z)
  const raycaster = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const rayDir = new THREE.Vector3(0, -1, 0);

  function getTerrainHeight(x: number, z: number): number | null {
    if (!terrainMesh) return null;
    rayOrigin.set(x, 500, z);
    raycaster.set(rayOrigin, rayDir);
    const hits = raycaster.intersectObject(terrainMesh);
    if (hits.length > 0) return hits[0].point.y;
    return null;
  }

  // Object shapes
  const shapes = buildShapes();
  let currentShape: ObjectShape = "lowpoly_tree";
  let instancedMesh: THREE.InstancedMesh | null = null;
  const dummy = new THREE.Object3D();

  function setObjectShape(shape: ObjectShape) {
    currentShape = shape;
  }

  function setInstances(positions: Float32Array, heightBaked = false) {
    const count = positions.length / 3;
    const shapeDef = shapes[currentShape];

    if (instancedMesh) {
      scene.remove(instancedMesh);
      instancedMesh.dispose();
    }

    instancedMesh = new THREE.InstancedMesh(shapeDef.geometry, shapeDef.material, count);
    let placed = 0;
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      let terrainY: number;
      if (heightBaked) {
        terrainY = y;
      } else {
        const sampled = getTerrainHeight(x, z);
        if (sampled === null) continue;
        terrainY = sampled;
      }

      const scale = 0.5 + Math.random() * 1.0;
      dummy.position.set(x, terrainY + shapeDef.heightOffset(scale), z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    instancedMesh.count = placed;
    instancedMesh.instanceMatrix.needsUpdate = true;
    scene.add(instancedMesh);
  }

  // FPS counter
  let frameCount = 0;
  let lastTime = performance.now();
  let currentFps = 0;

  function resize() {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);

    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      currentFps = frameCount;
      frameCount = 0;
      lastTime = now;
    }
  }

  window.addEventListener("resize", resize);
  resize();
  animate();

  return {
    setTerrain,
    setObjectShape,
    setInstances,
    getFps: () => currentFps,
  };
}
