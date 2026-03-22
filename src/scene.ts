import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type ObjectShape = "lowpoly_tree" | "none";

type ShapeDef = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  heightOffset: (scale: number) => number;
};

function buildShapes(): Record<ObjectShape, ShapeDef> {
  return {
    lowpoly_tree: {
      geometry: buildTreeGeometry(),
      material: new THREE.MeshStandardMaterial({
        color: 0x2a5540,
        flatShading: true,
      }),
      heightOffset: () => -0.1,
    },
    none: {
      geometry: new THREE.BufferGeometry(),
      material: new THREE.MeshBasicMaterial(),
      heightOffset: () => 0,
    },
  };
}

function mergeGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
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
  for (const g of geoms) g.dispose();
  return merged;
}

function buildTreeGeometry(): THREE.BufferGeometry {
  // Winter conifer: tall trunk + sparse dark canopy layers (snow-dusted)
  const trunk = new THREE.CylinderGeometry(0.03, 0.08, 1.4, 5);
  trunk.translate(0, 0.7, 0);

  // Stacked sparse cone layers (like a fir tree with less foliage)
  const layer1 = new THREE.ConeGeometry(0.45, 0.5, 6);
  layer1.translate(0, 1.1, 0);

  const layer2 = new THREE.ConeGeometry(0.35, 0.45, 6);
  layer2.translate(0, 1.45, 0);

  const layer3 = new THREE.ConeGeometry(0.22, 0.4, 6);
  layer3.translate(0, 1.75, 0);

  const layer4 = new THREE.ConeGeometry(0.12, 0.3, 5);
  layer4.translate(0, 2.0, 0);

  return mergeGeometries([trunk, layer1, layer2, layer3, layer4]);
}


// Height-based terrain color shader
function createTerrainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      minHeight: { value: -5.0 },
      maxHeight: { value: 15.0 },
      fogColor: { value: new THREE.Color(0xc8d0d8) },
      fogNear: { value: 100.0 },
      fogFar: { value: 500.0 },
      lightDir: { value: new THREE.Vector3(0.2, 0.5, 0.3).normalize() },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vFogDepth;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = viewMatrix * worldPos;
        vFogDepth = -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float minHeight;
      uniform float maxHeight;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      uniform vec3 lightDir;

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vFogDepth;

      void main() {
        float h = clamp((vWorldPos.y - minHeight) / (maxHeight - minHeight), 0.0, 1.0);

        // Winter palette: frozen ground -> dark rock -> exposed rock -> snow
        vec3 frozenGround = vec3(0.25, 0.25, 0.28);
        vec3 darkRock = vec3(0.30, 0.28, 0.27);
        vec3 exposedRock = vec3(0.40, 0.38, 0.36);
        vec3 snowLight = vec3(0.85, 0.88, 0.92);
        vec3 snowBright = vec3(0.95, 0.96, 0.98);

        vec3 color;
        if (h < 0.1) {
          color = mix(frozenGround, darkRock, h / 0.1);
        } else if (h < 0.3) {
          color = mix(darkRock, exposedRock, (h - 0.1) / 0.2);
        } else if (h < 0.5) {
          color = mix(exposedRock, snowLight, (h - 0.3) / 0.2);
        } else {
          color = mix(snowLight, snowBright, (h - 0.5) / 0.5);
        }

        // Steep slopes show exposed dark rock (wind-blown)
        float slope = 1.0 - vNormal.y;
        if (slope > 0.2) {
          float rockBlend = clamp((slope - 0.2) / 0.25, 0.0, 1.0);
          color = mix(color, darkRock, rockBlend * 0.8);
        }

        // Flat areas accumulate more snow
        if (slope < 0.15 && h > 0.25) {
          float snowAccum = (1.0 - slope / 0.15) * 0.3;
          color = mix(color, snowBright, snowAccum);
        }

        // Cold blue-ish lighting
        float diffuse = max(dot(vNormal, lightDir), 0.0);
        float ambient = 0.3;
        vec3 lit = color * (ambient + diffuse * 0.7);

        // Subtle blue tint in shadows
        float shadow = 1.0 - diffuse;
        lit += vec3(0.05, 0.07, 0.12) * shadow;

        // Fog
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        lit = mix(lit, fogColor, fogFactor);

        gl_FragColor = vec4(lit, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();

  // Winter overcast sky
  const skyColor = new THREE.Color(0xbcc5d0);
  const fogColor = new THREE.Color(0xc8d0d8);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(fogColor, 100, 500);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 150, 200);
  camera.lookAt(0, 0, 0);

  // OrbitControls
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = 5;
  controls.maxDistance = 600;
  controls.maxPolarAngle = Math.PI * 0.85;

  // Winter lights - bright overcast + low sun
  const ambient = new THREE.AmbientLight(0xccddee, 0.8);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff5e8, 1.0);
  sun.position.set(20, 15, 30);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xaabbdd, 0.4);
  fill.position.set(-20, 10, -10);
  scene.add(fill);

  // Hemisphere: bright sky / snow bounce
  const hemi = new THREE.HemisphereLight(0xd0dae8, 0x8888aa, 0.5);
  scene.add(hemi);

  // Terrain mesh with height-based color
  const terrainMaterial = createTerrainMaterial();
  let terrainMesh: THREE.Mesh | null = null;

  function setTerrain(geometry: THREE.BufferGeometry) {
    if (terrainMesh) {
      scene.remove(terrainMesh);
      terrainMesh.geometry.dispose();
    }

    // Update shader uniforms based on geometry bounds
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    terrainMaterial.uniforms.minHeight.value = box.min.y;
    terrainMaterial.uniforms.maxHeight.value = box.max.y;

    terrainMesh = new THREE.Mesh(geometry, terrainMaterial);
    scene.add(terrainMesh);
  }

  // Raycast
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

  // Color variation for instances
  const treeColors = [0x2a5540, 0x305a45, 0x254a3a, 0x356050, 0x204535];

  function setObjectShape(shape: ObjectShape) {
    currentShape = shape;
  }

  function setInstances(positions: Float32Array, heightBaked = false) {
    if (instancedMesh) {
      scene.remove(instancedMesh);
      instancedMesh.dispose();
      instancedMesh = null;
    }

    if (currentShape === "none") return;

    const count = positions.length / 3;
    const shapeDef = shapes[currentShape];

    instancedMesh = new THREE.InstancedMesh(shapeDef.geometry, shapeDef.material, count);

      const useColorVariation = currentShape === "lowpoly_tree";
    const colorPalette = treeColors;
    const color = new THREE.Color();

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
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(placed, dummy.matrix);

      if (useColorVariation) {
        color.setHex(colorPalette[placed % colorPalette.length]);
        instancedMesh.setColorAt(placed, color);
      }

      placed++;
    }
    instancedMesh.count = placed;
    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) {
      instancedMesh.instanceColor.needsUpdate = true;
    }
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
