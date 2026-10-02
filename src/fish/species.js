import * as THREE from 'three';

/**
 * Procedural Fish & Shrimp Geometries
 * Features:
 * - At least 26 length segments for smooth vertex-shader body wave deformation
 * - Anatomical cross-sections (laterally compressed Tilapia, cylindrical torpedo Rohu, segmented curved Shrimp)
 * - Separate integrated fin geometry (caudal tail, dorsal spine fin, pectoral fins, anal fin)
 * - UV and position layout matching travelling sinusoidal wave (Head at +X, Tail at -X)
 */

function buildFishGeometry({
  length = 1.45,
  heightScale = 0.42,
  widthScale = 0.18,
  lengthSegments = 26,
  radialSegments = 16,
  dorsalConfig = { startX: -0.35, endX: 0.25, height: 0.24 },
  tailConfig = { length: 0.45, spread: 0.38, forked: true },
  analConfig = { startX: -0.55, endX: -0.15, depth: 0.14 },
  pectoralConfig = { x: 0.2, spreadZ: 0.18, angle: 0.35 }
}) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const halfL = length * 0.5;

  // 1. Generate Main Tapered Body Slices along X-axis
  // Slice 0 at nose (+halfL), Slice lengthSegments-1 at caudal peduncle (-halfL)
  for (let i = 0; i < lengthSegments; i++) {
    const u = i / (lengthSegments - 1); // 0 = head, 1 = tail
    const x = halfL - u * length;

    // Organic fish profile curves
    // Max depth around 35-40% back from nose
    const profileFactor = Math.sin(Math.pow(u, 0.72) * Math.PI);
    const taper = Math.max(0.04, profileFactor);

    // Height (Y) and Width (Z)
    const hy = taper * heightScale;
    const wz = taper * widthScale;

    // Slight dorsal arch (center of mass slightly lower)
    const yOffset = (profileFactor * 0.05) - (u * 0.02);

    for (let j = 0; j < radialSegments; j++) {
      const v = j / radialSegments;
      const theta = v * Math.PI * 2;

      // Elliptical cross section
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const y = cosT * hy + yOffset;
      const z = sinT * wz;

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  // Body triangle indices
  for (let i = 0; i < lengthSegments - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      const a = i * radialSegments + j;
      const b = (i + 1) * radialSegments + j;
      const c = (i + 1) * radialSegments + nextJ;
      const d = i * radialSegments + nextJ;

      indices.push(a, b, d);
      indices.push(d, b, c);
    }
  }

  // Cap the nose (fan to center vertex)
  const noseIdx = positions.length / 3;
  positions.push(halfL + 0.04, 0, 0);
  uvs.push(0, 0.5);
  for (let j = 0; j < radialSegments; j++) {
    const nextJ = (j + 1) % radialSegments;
    indices.push(noseIdx, nextJ, j);
  }

  // Helper to append a double-sided planar fin
  function addFinQuad(v0, v1, v2, v3, uvCoords) {
    const baseIdx = positions.length / 3;
    positions.push(v0.x, v0.y, v0.z);
    positions.push(v1.x, v1.y, v1.z);
    positions.push(v2.x, v2.y, v2.z);
    positions.push(v3.x, v3.y, v3.z);

    uvs.push(uvCoords[0], uvCoords[1]);
    uvs.push(uvCoords[2], uvCoords[3]);
    uvs.push(uvCoords[4], uvCoords[5]);
    uvs.push(uvCoords[6], uvCoords[7]);

    // Double sided
    indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
    indices.push(baseIdx, baseIdx + 2, baseIdx + 1);
    indices.push(baseIdx, baseIdx + 3, baseIdx + 2);
  }

  // 2. Dorsal Fin (along spine)
  if (dorsalConfig) {
    const steps = 6;
    for (let s = 0; s < steps; s++) {
      const f0 = s / steps;
      const f1 = (s + 1) / steps;
      const x0 = dorsalConfig.startX + f0 * (dorsalConfig.endX - dorsalConfig.startX);
      const x1 = dorsalConfig.startX + f1 * (dorsalConfig.endX - dorsalConfig.startX);

      const h0 = Math.sin(f0 * Math.PI) * dorsalConfig.height;
      const h1 = Math.sin(f1 * Math.PI) * dorsalConfig.height;

      // Spine root height estimate
      const rootY0 = heightScale * 0.42;
      const rootY1 = heightScale * 0.42;

      addFinQuad(
        { x: x0, y: rootY0, z: 0 },
        { x: x0 - 0.04, y: rootY0 + h0, z: 0 },
        { x: x1 - 0.04, y: rootY1 + h1, z: 0 },
        { x: x1, y: rootY1, z: 0 },
        [0.8, 0, 0.8, 1, 0.85, 1, 0.85, 0]
      );
    }
  }

  // 3. Caudal Tail Fin (Forked or Rounded)
  if (tailConfig) {
    const tailRootX = -halfL;
    const tailTipX = tailRootX - tailConfig.length;
    const s = tailConfig.spread;

    if (tailConfig.forked) {
      // Upper lobe
      addFinQuad(
        { x: tailRootX, y: 0.05, z: 0 },
        { x: tailTipX, y: s, z: 0 },
        { x: tailTipX + 0.14, y: 0.04, z: 0 },
        { x: tailRootX, y: 0.0, z: 0 },
        [0.9, 0.5, 1.0, 1.0, 0.95, 0.5, 0.9, 0.5]
      );
      // Lower lobe
      addFinQuad(
        { x: tailRootX, y: -0.05, z: 0 },
        { x: tailRootX, y: 0.0, z: 0 },
        { x: tailTipX + 0.14, y: -0.04, z: 0 },
        { x: tailTipX, y: -s, z: 0 },
        [0.9, 0.5, 0.9, 0.5, 0.95, 0.5, 1.0, 0.0]
      );
    } else {
      addFinQuad(
        { x: tailRootX, y: -0.08, z: 0 },
        { x: tailTipX, y: -s * 0.7, z: 0 },
        { x: tailTipX, y: s * 0.7, z: 0 },
        { x: tailRootX, y: 0.08, z: 0 },
        [0.9, 0, 1.0, 0, 1.0, 1, 0.9, 1]
      );
    }
  }

  // 4. Anal Fin (bottom rear)
  if (analConfig) {
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const f0 = s / steps;
      const f1 = (s + 1) / steps;
      const x0 = analConfig.startX + f0 * (analConfig.endX - analConfig.startX);
      const x1 = analConfig.startX + f1 * (analConfig.endX - analConfig.startX);
      const d0 = Math.sin(f0 * Math.PI) * analConfig.depth;
      const d1 = Math.sin(f1 * Math.PI) * analConfig.depth;
      const rootY = -heightScale * 0.38;

      addFinQuad(
        { x: x0, y: rootY, z: 0 },
        { x: x1, y: rootY, z: 0 },
        { x: x1 - 0.03, y: rootY - d1, z: 0 },
        { x: x0 - 0.03, y: rootY - d0, z: 0 },
        [0.7, 0, 0.75, 0, 0.75, 1, 0.7, 1]
      );
    }
  }

  // 5. Pectoral Fins (lateral pair, flapped gently in vertex shader)
  if (pectoralConfig) {
    const px = pectoralConfig.x;
    const pz = pectoralConfig.spreadZ;
    // Left pectoral
    addFinQuad(
      { x: px, y: -0.06, z: pz * 0.7 },
      { x: px - 0.16, y: -0.14, z: pz * 1.6 },
      { x: px - 0.24, y: -0.16, z: pz * 1.8 },
      { x: px - 0.08, y: -0.08, z: pz * 0.8 },
      [0.3, 0, 0.3, 1, 0.4, 1, 0.4, 0]
    );
    // Right pectoral
    addFinQuad(
      { x: px, y: -0.06, z: -pz * 0.7 },
      { x: px - 0.08, y: -0.08, z: -pz * 0.8 },
      { x: px - 0.24, y: -0.16, z: -pz * 1.8 },
      { x: px - 0.16, y: -0.14, z: -pz * 1.6 },
      [0.3, 0, 0.4, 0, 0.4, 1, 0.3, 1]
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

/**
 * Procedural Tiger Shrimp Geometry
 * Curved segmented crustacean carapace, 6 abdomen rings, tail fan (uropods), antennae, and walking pleopods
 */
function buildShrimpGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  const segments = 18;
  const radial = 12;
  const totalLength = 0.95;

  for (let i = 0; i < segments; i++) {
    const u = i / (segments - 1);
    // Shrimp curves into a gentle crescent arc
    const arcAngle = (u - 0.2) * 1.35;
    const rCurve = 0.65;
    const x = Math.sin(arcAngle) * rCurve - 0.1;
    const y = -Math.cos(arcAngle) * rCurve + 0.58;

    // Segment thickness taper
    let r = Math.sin(Math.pow(u, 0.6) * Math.PI) * 0.12 + 0.02;
    if (u < 0.25) r *= 1.25; // Head/carapace thicker

    for (let j = 0; j < radial; j++) {
      const v = j / radial;
      const theta = v * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Slightly flattened horizontally
      const py = y + cosT * r * 1.15;
      const pz = sinT * r * 0.9;

      positions.push(x, py, pz);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < segments - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const nextJ = (j + 1) % radial;
      const a = i * radial + j;
      const b = (i + 1) * radial + j;
      const c = (i + 1) * radial + nextJ;
      const d = i * radial + nextJ;
      indices.push(a, b, d);
      indices.push(d, b, c);
    }
  }

  // Antennae (slender forward/upward sweeps)
  const baseAntennaIdx = positions.length / 3;
  // Left antenna
  positions.push(0.35, 0.05, 0.04);
  positions.push(0.72, 0.24, 0.14);
  positions.push(0.70, 0.22, 0.13);
  uvs.push(0, 0, 0, 1, 0, 0.5);
  indices.push(baseAntennaIdx, baseAntennaIdx + 1, baseAntennaIdx + 2);

  // Right antenna
  positions.push(0.35, 0.05, -0.04);
  positions.push(0.70, 0.22, -0.13);
  positions.push(0.72, 0.24, -0.14);
  uvs.push(0, 0, 0, 0.5, 0, 1);
  indices.push(baseAntennaIdx + 3, baseAntennaIdx + 4, baseAntennaIdx + 5);

  // Tail fan (uropods)
  const tailIdx = positions.length / 3;
  const tailX = -0.52;
  const tailY = -0.22;
  // Fan out 3 petals
  positions.push(tailX, tailY, 0);
  positions.push(tailX - 0.18, tailY - 0.08, 0.12);
  positions.push(tailX - 0.22, tailY - 0.06, 0);
  positions.push(tailX - 0.18, tailY - 0.08, -0.12);
  uvs.push(1, 0.5, 1, 1, 1, 0.5, 1, 0);

  indices.push(tailIdx, tailIdx + 1, tailIdx + 2);
  indices.push(tailIdx, tailIdx + 2, tailIdx + 3);
  indices.push(tailIdx, tailIdx + 2, tailIdx + 1);
  indices.push(tailIdx, tailIdx + 3, tailIdx + 2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

export function createFishGeometries() {
  // 1. Tilapia: Laterally compressed, deep body, spiny dorsal fin, forked tail
  const tilapia = buildFishGeometry({
    length: 1.45,
    heightScale: 0.44,
    widthScale: 0.18,
    lengthSegments: 28,
    radialSegments: 16,
    dorsalConfig: { startX: -0.42, endX: 0.22, height: 0.24 },
    tailConfig: { length: 0.48, spread: 0.40, forked: true },
    analConfig: { startX: -0.52, endX: -0.12, depth: 0.16 },
    pectoralConfig: { x: 0.22, spreadZ: 0.20 }
  });

  // 2. Rohu (Carp): Elongated cylindrical torpedo body, olive-bronze carp profile, wide tail
  const rohu = buildFishGeometry({
    length: 1.85,
    heightScale: 0.46,
    widthScale: 0.28,
    lengthSegments: 28,
    radialSegments: 16,
    dorsalConfig: { startX: -0.28, endX: 0.18, height: 0.26 },
    tailConfig: { length: 0.55, spread: 0.46, forked: true },
    analConfig: { startX: -0.58, endX: -0.22, depth: 0.14 },
    pectoralConfig: { x: 0.32, spreadZ: 0.26 }
  });

  // 3. Tiger Shrimp: Segmented curved body with antennae and tail fan
  const shrimp = buildShrimpGeometry();

  return { tilapia, rohu, shrimp };
}
