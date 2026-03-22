use wasm_bindgen::prelude::*;

fn mulberry32(seed: u32) -> impl FnMut() -> f64 {
    let mut s = seed;
    move || {
        s = s.wrapping_add(0x6d2b79f5);
        let mut t = s ^ (s >> 15);
        t = t.wrapping_mul(1 | s);
        t = (t.wrapping_add(
            (t ^ (t >> 7)).wrapping_mul(61 | t),
        )) ^ t;
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }
}

fn build_permutation(seed: u32) -> Vec<u8> {
    let mut rand = mulberry32(seed);
    let mut p = vec![0u8; 512];
    for i in 0..=255u8 {
        p[i as usize] = i;
    }
    // Fisher-Yates shuffle
    for i in (1..=255usize).rev() {
        let j = (rand() * (i as f64 + 1.0)) as usize;
        p.swap(i, j);
    }
    for i in 0..256 {
        p[256 + i] = p[i];
    }
    p
}

fn grad(hash: u8, x: f64, y: f64) -> f64 {
    let h = hash & 3;
    let u = if h < 2 { x } else { -x };
    let v = if h == 0 || h == 3 { y } else { -y };
    u + v
}

fn perlin_2d(x: f64, y: f64, perm: &[u8]) -> f64 {
    let xi = (x.floor() as i32 & 255) as usize;
    let yi = (y.floor() as i32 & 255) as usize;
    let xf = x - x.floor();
    let yf = y - y.floor();

    let u = xf * xf * (3.0 - 2.0 * xf);
    let v = yf * yf * (3.0 - 2.0 * yf);

    let aa = perm[perm[xi] as usize + yi];
    let ab = perm[perm[xi] as usize + yi + 1];
    let ba = perm[perm[xi + 1] as usize + yi];
    let bb = perm[perm[xi + 1] as usize + yi + 1];

    let x1 = grad(aa, xf, yf) * (1.0 - u) + grad(ba, xf - 1.0, yf) * u;
    let x2 = grad(ab, xf, yf - 1.0) * (1.0 - u) + grad(bb, xf - 1.0, yf - 1.0) * u;

    x1 * (1.0 - v) + x2 * v
}

/// Generate terrain vertex Y values.
/// Returns a Float32Array of Y heights for a (segments+1)^2 grid.
#[wasm_bindgen]
pub fn generate_terrain_heights(
    size: f64,
    segments: u32,
    height: f64,
    noise_scale: f64,
    octaves: u32,
    seed: u32,
) -> Vec<f32> {
    let count = (segments + 1) as usize;
    let perm = build_permutation(seed);
    let mut heights = Vec::with_capacity(count * count);

    let step = size / segments as f64;
    let half = size / 2.0;

    for iz in 0..count {
        for ix in 0..count {
            let x = ix as f64 * step - half;
            let z = iz as f64 * step - half;

            let mut h = 0.0;
            let mut amp = 1.0;
            let mut freq = noise_scale / size;

            for _ in 0..octaves {
                h += perlin_2d(x * freq, z * freq, &perm) * amp;
                freq *= 2.0;
                amp *= 0.5;
            }

            heights.push((h * height) as f32);
        }
    }

    heights
}

// Internal: sample terrain height at (x, z) using same noise as terrain generation
fn sample_height(x: f64, z: f64, size: f64, height: f64, noise_scale: f64, octaves: u32, perm: &[u8]) -> f64 {
    let mut h = 0.0;
    let mut amp = 1.0;
    let mut freq = noise_scale / size;
    for _ in 0..octaves {
        h += perlin_2d(x * freq, z * freq, perm) * amp;
        freq *= 2.0;
        amp *= 0.5;
    }
    h * height
}

/// Surface random placement. Returns flat array [x, 0, z, x, 0, z, ...]
#[wasm_bindgen]
pub fn surface_random_placement(
    count: u32,
    seed: u32,
    terrain_size: f64,
) -> Vec<f32> {
    let mut rand = mulberry32(seed);
    let mut positions = Vec::with_capacity(count as usize * 3);

    for _ in 0..count {
        let x = (rand() - 0.5) * terrain_size;
        let z = (rand() - 0.5) * terrain_size;
        positions.push(x as f32);
        positions.push(0.0); // y placeholder
        positions.push(z as f32);
    }

    positions
}

/// Surface random with height baked in. Returns [x, y, z, x, y, z, ...]
/// No raycast needed on JS side.
#[wasm_bindgen]
pub fn surface_random_with_height(
    count: u32,
    placement_seed: u32,
    terrain_size: f64,
    terrain_height: f64,
    noise_scale: f64,
    octaves: u32,
    terrain_seed: u32,
) -> Vec<f32> {
    let mut rand = mulberry32(placement_seed);
    let perm = build_permutation(terrain_seed);
    let mut positions = Vec::with_capacity(count as usize * 3);

    for _ in 0..count {
        let x = (rand() - 0.5) * terrain_size;
        let z = (rand() - 0.5) * terrain_size;
        let y = sample_height(x, z, terrain_size, terrain_height, noise_scale, octaves, &perm);
        positions.push(x as f32);
        positions.push(y as f32);
        positions.push(z as f32);
    }

    positions
}

/// Poisson Disk with height baked in. Returns [x, y, z, ...]
#[wasm_bindgen]
pub fn poisson_disk_with_height(
    count: u32,
    placement_seed: u32,
    terrain_size: f64,
    terrain_height: f64,
    noise_scale: f64,
    octaves: u32,
    terrain_seed: u32,
) -> Vec<f32> {
    let mut rand = mulberry32(placement_seed);
    let perm = build_permutation(terrain_seed);
    let half = terrain_size / 2.0;
    let area = terrain_size * terrain_size;
    let min_dist = (area / (count as f64 * 2.0)).sqrt();
    let cell_size = min_dist / std::f64::consts::SQRT_2;
    let grid_w = (terrain_size / cell_size).ceil() as usize;
    let grid_h = grid_w;
    let k = 30u32;

    let mut grid: Vec<i32> = vec![-1; grid_w * grid_h];
    let mut points: Vec<(f64, f64)> = Vec::new();
    let mut active: Vec<usize> = Vec::new();

    let grid_index = |x: f64, z: f64| -> usize {
        let gx = ((x + half) / cell_size) as usize;
        let gz = ((z + half) / cell_size) as usize;
        gz.min(grid_h - 1) * grid_w + gx.min(grid_w - 1)
    };

    let in_bounds = |x: f64, z: f64| -> bool {
        x >= -half && x < half && z >= -half && z < half
    };

    let start_x = (rand() - 0.5) * terrain_size;
    let start_z = (rand() - 0.5) * terrain_size;
    points.push((start_x, start_z));
    active.push(0);
    grid[grid_index(start_x, start_z)] = 0;

    while !active.is_empty() && points.len() < count as usize {
        let active_idx = (rand() * active.len() as f64) as usize;
        let point_idx = active[active_idx];
        let (px, pz) = points[point_idx];

        let mut found = false;
        for _ in 0..k {
            let angle = rand() * std::f64::consts::TAU;
            let dist = min_dist + rand() * min_dist;
            let nx = px + angle.cos() * dist;
            let nz = pz + angle.sin() * dist;

            if !in_bounds(nx, nz) {
                continue;
            }

            let gx = ((nx + half) / cell_size) as i32;
            let gz = ((nz + half) / cell_size) as i32;
            let mut too_close = false;

            'outer: for dz in -2..=2i32 {
                for dx in -2..=2i32 {
                    let ngx = gx + dx;
                    let ngz = gz + dz;
                    if ngx < 0 || ngx >= grid_w as i32 || ngz < 0 || ngz >= grid_h as i32 {
                        continue;
                    }
                    let idx = grid[ngz as usize * grid_w + ngx as usize];
                    if idx == -1 {
                        continue;
                    }
                    let (qx, qz) = points[idx as usize];
                    let dsq = (nx - qx) * (nx - qx) + (nz - qz) * (nz - qz);
                    if dsq < min_dist * min_dist {
                        too_close = true;
                        break 'outer;
                    }
                }
            }

            if !too_close {
                let new_idx = points.len();
                points.push((nx, nz));
                active.push(new_idx);
                grid[grid_index(nx, nz)] = new_idx as i32;
                found = true;
                break;
            }
        }

        if !found {
            active.swap_remove(active_idx);
        }
    }

    let mut positions = Vec::with_capacity(points.len() * 3);
    for (x, z) in &points {
        let y = sample_height(*x, *z, terrain_size, terrain_height, noise_scale, octaves, &perm);
        positions.push(*x as f32);
        positions.push(y as f32);
        positions.push(*z as f32);
    }
    positions
}

/// Poisson Disk Sampling (Bridson's algorithm)
#[wasm_bindgen]
pub fn poisson_disk_placement(
    count: u32,
    seed: u32,
    terrain_size: f64,
) -> Vec<f32> {
    let mut rand = mulberry32(seed);
    let half = terrain_size / 2.0;
    let area = terrain_size * terrain_size;
    let min_dist = (area / (count as f64 * 2.0)).sqrt();
    let cell_size = min_dist / std::f64::consts::SQRT_2;
    let grid_w = (terrain_size / cell_size).ceil() as usize;
    let grid_h = grid_w;
    let k = 30u32;

    let mut grid: Vec<i32> = vec![-1; grid_w * grid_h];
    let mut points: Vec<(f64, f64)> = Vec::new();
    let mut active: Vec<usize> = Vec::new();

    let grid_index = |x: f64, z: f64| -> usize {
        let gx = ((x + half) / cell_size) as usize;
        let gz = ((z + half) / cell_size) as usize;
        gz.min(grid_h - 1) * grid_w + gx.min(grid_w - 1)
    };

    let in_bounds = |x: f64, z: f64| -> bool {
        x >= -half && x < half && z >= -half && z < half
    };

    // Start with a random point
    let start_x = (rand() - 0.5) * terrain_size;
    let start_z = (rand() - 0.5) * terrain_size;
    points.push((start_x, start_z));
    active.push(0);
    grid[grid_index(start_x, start_z)] = 0;

    while !active.is_empty() && points.len() < count as usize {
        let active_idx = (rand() * active.len() as f64) as usize;
        let point_idx = active[active_idx];
        let (px, pz) = points[point_idx];

        let mut found = false;
        for _ in 0..k {
            let angle = rand() * std::f64::consts::TAU;
            let dist = min_dist + rand() * min_dist;
            let nx = px + angle.cos() * dist;
            let nz = pz + angle.sin() * dist;

            if !in_bounds(nx, nz) {
                continue;
            }

            // Check neighbors
            let gx = ((nx + half) / cell_size) as i32;
            let gz = ((nz + half) / cell_size) as i32;
            let mut too_close = false;

            'outer: for dz in -2..=2i32 {
                for dx in -2..=2i32 {
                    let ngx = gx + dx;
                    let ngz = gz + dz;
                    if ngx < 0 || ngx >= grid_w as i32 || ngz < 0 || ngz >= grid_h as i32 {
                        continue;
                    }
                    let idx = grid[ngz as usize * grid_w + ngx as usize];
                    if idx == -1 {
                        continue;
                    }
                    let (qx, qz) = points[idx as usize];
                    let dsq = (nx - qx) * (nx - qx) + (nz - qz) * (nz - qz);
                    if dsq < min_dist * min_dist {
                        too_close = true;
                        break 'outer;
                    }
                }
            }

            if !too_close {
                let new_idx = points.len();
                points.push((nx, nz));
                active.push(new_idx);
                grid[grid_index(nx, nz)] = new_idx as i32;
                found = true;
                break;
            }
        }

        if !found {
            active.swap_remove(active_idx);
        }
    }

    let mut positions = Vec::with_capacity(points.len() * 3);
    for (x, z) in &points {
        positions.push(*x as f32);
        positions.push(0.0);
        positions.push(*z as f32);
    }
    positions
}
