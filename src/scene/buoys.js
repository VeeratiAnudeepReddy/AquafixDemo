import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createSensorBuoys(scene) {
  const buoyGroup = new THREE.Group();
  buoyGroup.name = 'SensorBuoys';

  const buoys = [];

  // Canvas texture for glowing pulse halo
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 8, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.3, 'rgba(61, 220, 132, 0.8)');
  g.addColorStop(1, 'rgba(61, 220, 132, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(canvas);

  CONFIG.farm.ponds.forEach((p) => {
    const buoy = new THREE.Group();
    // Position buoy in western half of pond
    const bx = p.x - 4.5;
    const bz = p.z - 2.0;
    buoy.position.set(bx, CONFIG.farm.waterLevelY, bz);

    // 1. Torus float ring (Aquaculture yellow/white buoy body)
    const floatGeo = new THREE.TorusGeometry(0.7, 0.22, 12, 24);
    floatGeo.rotateX(Math.PI / 2);
    const floatMat = new THREE.MeshLambertMaterial({ color: '#F5F5F5' });
    const floatMesh = new THREE.Mesh(floatGeo, floatMat);
    floatMesh.castShadow = true;
    buoy.add(floatMesh);

    // Orange band on float
    const bandGeo = new THREE.TorusGeometry(0.705, 0.08, 12, 24);
    bandGeo.rotateX(Math.PI / 2);
    const bandMat = new THREE.MeshLambertMaterial({ color: '#FF7043' });
    const bandMesh = new THREE.Mesh(bandGeo, bandMat);
    buoy.add(bandMesh);

    // 2. Solar canopy & central mast
    const mastGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.4, 8);
    const mastMat = new THREE.MeshLambertMaterial({ color: '#37474F' });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.y = 0.7;
    buoy.add(mast);

    // Mini solar disk
    const solarDiscGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16);
    const solarDiscMat = new THREE.MeshLambertMaterial({ color: '#102A45' });
    const solarDisc = new THREE.Mesh(solarDiscGeo, solarDiscMat);
    solarDisc.position.y = 1.05;
    buoy.add(solarDisc);

    // 3. Antenna tip with Beacon LED
    const ledGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const ledMat = new THREE.MeshBasicMaterial({
      color: CONFIG.palette.statusSafe
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.y = 1.45;
    buoy.add(led);

    // 4. Glowing Ring on Water Line (color changes by risk status)
    const ringGeo = new THREE.RingGeometry(0.85, 1.35, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: CONFIG.palette.statusSafe,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.02;
    buoy.add(ring);

    // 5. Pulsing Sprite Aura
    const spriteMat = new THREE.SpriteMaterial({
      map: glowTexture,
      color: CONFIG.palette.statusSafe,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.75
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.y = 1.45;
    sprite.scale.set(1.5, 1.5, 1.5);
    buoy.add(sprite);

    // 6. Submerged sensor cable & probe payload
    const cableGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6);
    const cableMat = new THREE.MeshBasicMaterial({ color: '#263238' });
    const cable = new THREE.Mesh(cableGeo, cableMat);
    cable.position.y = -0.9;
    buoy.add(cable);

    // Multiparameter sensor probe (DO / pH / Temp / ORP)
    const probeGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.6, 8);
    const probeMat = new THREE.MeshLambertMaterial({ color: '#78909C' });
    const probe = new THREE.Mesh(probeGeo, probeMat);
    probe.position.y = -1.8;
    buoy.add(probe);

    buoyGroup.add(buoy);

    buoys.push({
      pondId: p.id,
      hero: p.hero,
      group: buoy,
      basePos: new THREE.Vector3(bx, CONFIG.farm.waterLevelY, bz),
      ledMat,
      ringMat,
      spriteMat,
      sprite,
      currentRisk: p.sensors.risk
    });
  });

  scene.add(buoyGroup);

  return {
    group: buoyGroup,
    buoys,
    setBuoyRisk: (pondId, riskLevel) => {
      const b = buoys.find((item) => item.pondId === pondId);
      if (!b) return;
      b.currentRisk = riskLevel;

      let c = CONFIG.palette.statusSafe;
      if (riskLevel === 'MEDIUM' || riskLevel === 'WARNING') c = CONFIG.palette.statusWarning;
      if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') c = CONFIG.palette.statusCritical;

      b.ledMat.color.set(c);
      b.ringMat.color.set(c);
      b.spriteMat.color.set(c);
    },
    update: (time) => {
      buoys.forEach((b, idx) => {
        // Gentle water bobbing and rocking
        const bob = Math.sin(time * 2.2 + idx * 1.5) * 0.04;
        const tiltX = Math.sin(time * 1.8 + idx) * 0.04;
        const tiltZ = Math.cos(time * 1.6 + idx) * 0.04;

        b.group.position.y = b.basePos.y + bob;
        b.group.rotation.x = tiltX;
        b.group.rotation.z = tiltZ;

        // Pulsing light
        const pulse = (Math.sin(time * 4.0 + idx * 2.0) + 1.0) * 0.5;
        b.ringMat.opacity = 0.35 + pulse * 0.45;
        b.sprite.scale.setScalar(1.2 + pulse * 0.6);
      });
    }
  };
}
