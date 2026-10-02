import * as THREE from 'three';

/**
 * Procedural multi-part, tapered fish geometries with separate fin geometry
 */

export function createFishGeometries() {
  // 1. Tilapia (Compressed deep oval body, dorsal ridge, forked tail)
  const tilapiaGroup = new THREE.Group();

  // Spindle body with smooth tapered profile
  const tBodyGeo = new THREE.CylinderGeometry(0.08, 0.38, 1.45, 12, 6);
  tBodyGeo.rotateZ(-Math.PI / 2);
  tBodyGeo.scale(1.0, 0.45, 0.95); // laterally compressed

  // Dorsal fin (thin trapezoid along top spine)
  const dFinGeo = new THREE.BufferGeometry();
  const dFinVertices = new Float32Array([
    // x, y, z
    -0.3, 0.18, 0.0,
     0.2, 0.16, 0.0,
     0.0, 0.42, 0.0,
    -0.4, 0.35, 0.0
  ]);
  dFinGeo.setAttribute('position', new THREE.BufferAttribute(dFinVertices, 3));
  dFinGeo.setIndex([0, 1, 2, 0, 2, 3]);
  dFinGeo.computeVertexNormals();

  // Tail fin (forked caudal fin)
  const tTailGeo = new THREE.BufferGeometry();
  const tTailVertices = new Float32Array([
    -0.7,  0.0,  0.0,
    -1.1,  0.35, 0.0,
    -0.95, 0.0,  0.0,
    -1.1, -0.35, 0.0
  ]);
  tTailGeo.setAttribute('position', new THREE.BufferAttribute(tTailVertices, 3));
  tTailGeo.setIndex([0, 1, 2, 0, 2, 3]);
  tTailGeo.computeVertexNormals();

  // 2. Rohu (Elongated torpedo body, olive-bronze carp profile)
  const rBodyGeo = new THREE.CylinderGeometry(0.06, 0.32, 1.9, 14, 6);
  rBodyGeo.rotateZ(-Math.PI / 2);
  rBodyGeo.scale(1.0, 0.65, 0.72); // rounder cylindrical carp shape

  // 3. Shrimp (Curved segmented crustacean abdomen + tail fan)
  const sBodyGeo = new THREE.TorusGeometry(0.32, 0.09, 8, 16, Math.PI * 0.88);
  sBodyGeo.rotateZ(-Math.PI / 3);
  sBodyGeo.scale(0.85, 0.85, 0.85);

  return {
    tilapia: tBodyGeo,
    rohu: rBodyGeo,
    shrimp: sBodyGeo
  };
}
