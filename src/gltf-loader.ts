import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

export type GLTFModel = {
  scene: THREE.Group;
  geometry: THREE.BufferGeometry | null;
  material: THREE.Material | null;
};

export async function loadGLTF(url: string): Promise<GLTFModel> {
  const gltf = await loader.loadAsync(url);
  const scene = gltf.scene;

  // Find first mesh in the scene
  let geometry: THREE.BufferGeometry | null = null;
  let material: THREE.Material | null = null;

  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && !geometry) {
      geometry = child.geometry;
      material = child.material as THREE.Material;
    }
  });

  return { scene, geometry, material };
}

// For InstancedMesh we need to merge all meshes in the glTF into one geometry
export async function loadGLTFForInstancing(url: string): Promise<{
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}> {
  const gltf = await loader.loadAsync(url);
  const meshes: THREE.Mesh[] = [];

  gltf.scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshes.push(child);
    }
  });

  if (meshes.length === 0) {
    throw new Error("No meshes found in glTF");
  }

  if (meshes.length === 1) {
    return {
      geometry: meshes[0].geometry,
      material: meshes[0].material as THREE.Material,
    };
  }

  // Merge multiple meshes into one
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const mesh of meshes) {
    // Apply mesh's world transform to vertices
    mesh.updateWorldMatrix(true, false);
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);

    const pos = geo.getAttribute("position");
    const norm = geo.getAttribute("normal");
    const idx = geo.getIndex();

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (norm) {
        normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      }
    }
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vertexOffset);
      }
    }
    vertexOffset += pos.count;
    geo.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length > 0) {
    merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  }
  if (indices.length > 0) {
    merged.setIndex(indices);
  }
  merged.computeVertexNormals();

  return {
    geometry: merged,
    material: meshes[0].material as THREE.Material,
  };
}
