import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createFarmer(scene) {
  const farmerGroup = new THREE.Group();
  farmerGroup.name = 'FarmerSilhouette';

  // Stylized dark silhouette material
  const mat = new THREE.MeshLambertMaterial({
    color: '#1E293B',
    roughness: 0.9
  });

  // Farmer's hat (conical Asian/rural conical straw hat)
  const hatGeo = new THREE.ConeGeometry(0.7, 0.28, 12);
  const hatMat = new THREE.MeshLambertMaterial({ color: '#D4AF37' });
  const hat = new THREE.Mesh(hatGeo, hatMat);
  hat.position.y = 1.95;
  farmerGroup.add(hat);

  // Head
  const headGeo = new THREE.SphereGeometry(0.22, 10, 10);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.y = 1.75;
  farmerGroup.add(head);

  // Torso / Shirt
  const torsoGeo = new THREE.BoxGeometry(0.55, 0.75, 0.32);
  const torso = new THREE.Mesh(torsoGeo, mat);
  torso.position.y = 1.25;
  farmerGroup.add(torso);

  // Legs (animatable)
  const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.22);
  const leftLeg = new THREE.Mesh(legGeo, mat);
  leftLeg.position.set(-0.16, 0.45, 0);
  farmerGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, mat);
  rightLeg.position.set(0.16, 0.45, 0);
  farmerGroup.add(rightLeg);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.14, 0.65, 0.14);
  const leftArm = new THREE.Mesh(armGeo, mat);
  leftArm.position.set(-0.35, 1.2, 0);
  farmerGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, mat);
  rightArm.position.set(0.35, 1.2, 0);
  farmerGroup.add(rightArm);

  // Tablet/control device held in hands
  const tabletGeo = new THREE.BoxGeometry(0.28, 0.04, 0.2);
  const tabletMat = new THREE.MeshBasicMaterial({ color: CONFIG.palette.statusSafe });
  const tablet = new THREE.Mesh(tabletGeo, tabletMat);
  tablet.position.set(0, 1.15, 0.3);
  farmerGroup.add(tablet);

  farmerGroup.scale.setScalar(1.0);
  // Default position near hut
  farmerGroup.position.set(-32, 0.3, 2);
  farmerGroup.visible = false;

  scene.add(farmerGroup);

  let isWalking = false;
  let walkProgress = 0; // 0 (near hut) to 1 (near aerator)

  // Waypoints: Hut (-32, 0.3, 2) -> Crosswalk (-17, 0.3, 2) -> Pond 3 Aerator edge (-12, 0.3, 22)
  const path = new THREE.CurvePath();
  const line1 = new THREE.LineCurve3(
    new THREE.Vector3(-32, 0.3, 2),
    new THREE.Vector3(-17, 0.3, 2)
  );
  const line2 = new THREE.LineCurve3(
    new THREE.Vector3(-17, 0.3, 2),
    new THREE.Vector3(-12, 0.3, 20)
  );
  path.add(line1);
  path.add(line2);

  return {
    group: farmerGroup,
    setVisible: (v) => {
      farmerGroup.visible = v;
    },
    setProgress: (p) => {
      walkProgress = THREE.MathUtils.clamp(p, 0, 1);
      const pos = path.getPoint(walkProgress);
      farmerGroup.position.copy(pos);

      // Facing tangent
      const tangent = path.getTangent(walkProgress);
      farmerGroup.rotation.y = Math.atan2(tangent.x, tangent.z);

      // Leg swing animation while walking
      const swing = Math.sin(walkProgress * 40) * 0.45;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * 0.7;
      rightArm.rotation.x = swing * 0.7;
    }
  };
}
