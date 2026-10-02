import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createAerators(scene) {
  const aeratorGroup = new THREE.Group();
  aeratorGroup.name = 'Aerators';

  const aeratorList = [];

  // Material definitions
  const pontoonMat = new THREE.MeshLambertMaterial({ color: '#E8912D' }); // aquaculture orange float
  const motorMat = new THREE.MeshLambertMaterial({ color: '#2B3A42' }); // cast iron motor
  const frameMat = new THREE.MeshLambertMaterial({ color: '#78909C' }); // galvanized steel
  const bladeMat = new THREE.MeshLambertMaterial({ color: '#00838F' }); // durable polymer blade

  // Splash particle texture
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.3, 'rgba(200,240,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const splashTexture = new THREE.CanvasTexture(canvas);

  CONFIG.farm.ponds.forEach((p) => {
    const unit = new THREE.Group();
    // Position aerator near middle-east bank of each pond
    unit.position.set(p.x + 5, CONFIG.farm.waterLevelY + 0.15, p.z);

    // 1. Two floating pontoons
    const pontoonGeo = new THREE.CylinderGeometry(0.32, 0.32, 3.8, 10);
    pontoonGeo.rotateX(Math.PI / 2);

    const p1 = new THREE.Mesh(pontoonGeo, pontoonMat);
    p1.position.set(-1.4, -0.05, 0);
    p1.castShadow = true;
    unit.add(p1);

    const p2 = new THREE.Mesh(pontoonGeo, pontoonMat);
    p2.position.set(1.4, -0.05, 0);
    p2.castShadow = true;
    unit.add(p2);

    // Frame crossbeams
    const beamGeo = new THREE.BoxGeometry(3.2, 0.1, 0.12);
    const b1 = new THREE.Mesh(beamGeo, frameMat);
    b1.position.set(0, 0.2, 1.2);
    unit.add(b1);
    const b2 = new THREE.Mesh(beamGeo, frameMat);
    b2.position.set(0, 0.2, -1.2);
    unit.add(b2);

    // Electric motor enclosure
    const motorGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10);
    motorGeo.rotateZ(Math.PI / 2);
    const motor = new THREE.Mesh(motorGeo, motorMat);
    motor.position.set(0, 0.45, 0);
    motor.castShadow = true;
    unit.add(motor);

    // Motor support legs
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6);
    [-0.5, 0.5].forEach((lx) => {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(lx, 0.25, 0);
      unit.add(leg);
    });

    // 2. Rotating Wheel Axle & Paddle Blades (Left & Right)
    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(0, 0.2, 0);

    const axleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.4, 8);
    axleGeo.rotateZ(Math.PI / 2);
    const axle = new THREE.Mesh(axleGeo, frameMat);
    rotorGroup.add(axle);

    // Paddle wheels on left and right sides
    [-1.0, 1.0].forEach((sideX) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(sideX, 0, 0);

      const numBlades = 8;
      for (let i = 0; i < numBlades; i++) {
        const bladeArm = new THREE.Group();
        bladeArm.rotation.x = (i / numBlades) * Math.PI * 2;

        const bladeGeo = new THREE.BoxGeometry(0.55, 0.6, 0.04);
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(0, 0.55, 0);
        bladeArm.add(blade);

        wheelGroup.add(bladeArm);
      }
      rotorGroup.add(wheelGroup);
    });

    unit.add(rotorGroup);

    // 3. Splash / Spray Particle System
    const particleCount = 140;
    const splashGeo = new THREE.BufferGeometry();
    const splashPositions = new Float32Array(particleCount * 3);
    const splashVelocities = [];

    for (let i = 0; i < particleCount; i++) {
      const side = Math.random() > 0.5 ? -1.0 : 1.0;
      splashPositions[i * 3 + 0] = side + (Math.random() - 0.5) * 0.4;
      splashPositions[i * 3 + 1] = 0;
      splashPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;

      splashVelocities.push({
        vx: (Math.random() - 0.5) * 1.5,
        vy: 2.2 + Math.random() * 2.8,
        vz: (Math.random() - 0.5) * 3.5,
        origX: splashPositions[i * 3 + 0],
        origZ: splashPositions[i * 3 + 2]
      });
    }

    splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));

    const splashMat = new THREE.PointsMaterial({
      size: 0.32,
      map: splashTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.85
    });

    const splashMesh = new THREE.Points(splashGeo, splashMat);
    splashMesh.position.set(0, 0, 0);
    splashMesh.visible = false;
    unit.add(splashMesh);

    aeratorGroup.add(unit);

    // Pond 1, 2, 4 are active initially; Pond 3 starts off
    const initialRunning = !p.hero;

    aeratorList.push({
      pondId: p.id,
      unit,
      rotorGroup,
      splashMesh,
      splashGeo,
      splashVelocities,
      particleCount,
      isRunning: initialRunning,
      speed: initialRunning ? 1.0 : 0.0,
      targetSpeed: initialRunning ? 1.0 : 0.0
    });
  });

  scene.add(aeratorGroup);

  return {
    group: aeratorGroup,
    setRunning: (pondId, running) => {
      const a = aeratorList.find((item) => item.pondId === pondId);
      if (a) {
        a.targetSpeed = running ? 1.0 : 0.0;
        a.isRunning = running;
      }
    },
    update: (time, dt) => {
      aeratorList.forEach((a) => {
        // Smooth speed transition
        a.speed += (a.targetSpeed - a.speed) * 4.0 * dt;

        if (a.speed > 0.05) {
          a.rotorGroup.rotation.x += a.speed * 12.0 * dt;
          a.splashMesh.visible = true;
          a.splashMesh.material.opacity = a.speed * 0.85;

          // Update splash particle dynamics
          const posAttr = a.splashGeo.attributes.position;
          for (let i = 0; i < a.particleCount; i++) {
            const v = a.splashVelocities[i];
            let px = posAttr.getX(i) + v.vx * dt * a.speed;
            let py = posAttr.getY(i) + v.vy * dt * a.speed;
            let pz = posAttr.getZ(i) + v.vz * dt * a.speed;

            v.vy -= 9.8 * dt; // gravity

            if (py < -0.2) {
              // Reset particle to paddle wheel contact
              px = v.origX + (Math.random() - 0.5) * 0.3;
              py = 0.05;
              pz = v.origZ + (Math.random() - 0.5) * 0.3;
              v.vy = 2.0 + Math.random() * 2.8;
              v.vz = (Math.random() - 0.5) * 3.5;
            }

            posAttr.setXYZ(i, px, py, pz);
          }
          posAttr.needsUpdate = true;
        } else {
          a.splashMesh.visible = false;
        }
      });
    }
  };
}
