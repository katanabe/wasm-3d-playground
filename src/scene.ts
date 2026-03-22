import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const TERRAIN_COLOR = new THREE.Color(0x3a5f3a);
const INSTANCE_COLOR = new THREE.Color(0x44aa88);

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

  // InstancedMesh for placed objects
  const instanceGeometry = new THREE.ConeGeometry(0.3, 1.0, 6);
  const instanceMaterial = new THREE.MeshStandardMaterial({ color: INSTANCE_COLOR });
  let instancedMesh: THREE.InstancedMesh | null = null;
  const dummy = new THREE.Object3D();

  function setInstances(positions: Float32Array) {
    const count = positions.length / 3;

    if (instancedMesh) {
      scene.remove(instancedMesh);
      instancedMesh.dispose();
    }

    instancedMesh = new THREE.InstancedMesh(instanceGeometry, instanceMaterial, count);
    let placed = 0;
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const z = positions[i * 3 + 2];
      const terrainY = getTerrainHeight(x, z);
      if (terrainY === null) continue;

      const scale = 0.5 + Math.random() * 1.0;
      const coneHalfHeight = (1.0 * scale) / 2;
      dummy.position.set(x, terrainY + coneHalfHeight, z);
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
    setInstances,
    getFps: () => currentFps,
  };
}
