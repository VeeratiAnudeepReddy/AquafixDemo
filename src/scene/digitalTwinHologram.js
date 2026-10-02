import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createDigitalTwinHologram(scene, buoys) {
  const twinGroup = new THREE.Group();
  twinGroup.name = 'DigitalTwinHologram';
  twinGroup.position.set(0, 15, 0);

  // 1. Central Holographic Core
  const coreGeo = new THREE.IcosahedronGeometry(2.2, 1);
  const coreMat = new THREE.MeshBasicMaterial({
    color: CONFIG.palette.uiPurpleAccent,
    wireframe: true,
    transparent: true,
    opacity: 0.8
  });
  const coreWire = new THREE.Mesh(coreGeo, coreMat);
  twinGroup.add(coreWire);

  // Inner solid core glow
  const innerGeo = new THREE.OctahedronGeometry(1.4, 0);
  const innerMat = new THREE.MeshLambertMaterial({
    color: '#8B5CF6',
    emissive: '#6D28D9',
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.75
  });
  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  twinGroup.add(innerMesh);

  // 2. Gyroscope Orbital Rings
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#A78BFA',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6
  });

  const ring1 = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.12, 48), ringMat);
  twinGroup.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.52, 48), ringMat);
  ring2.rotation.x = Math.PI / 3;
  twinGroup.add(ring2);

  // 3. Feedback Loop Ring for Chapter 7 (Learn)
  const feedbackGeo = new THREE.TorusGeometry(4.8, 0.08, 16, 64);
  const feedbackMat = new THREE.MeshBasicMaterial({
    color: CONFIG.palette.statusSafe,
    transparent: true,
    opacity: 0.0 // starts invisible, fades in at Learn stage
  });
  const feedbackRing = new THREE.Mesh(feedbackGeo, feedbackMat);
  feedbackRing.rotation.x = Math.PI / 2;
  twinGroup.add(feedbackRing);

  // 4. Data Packet Streaming Lines & Particles (Buoy -> Twin)
  const streamGroup = new THREE.Group();
  twinGroup.add(streamGroup);

  const packetsPerStream = 12;
  const streams = [];

  // Particle texture
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 32;
  pCanvas.height = 32;
  const pCtx = pCanvas.getContext('2d');
  const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.4, 'rgba(167, 139, 250, 0.8)');
  grad.addColorStop(1, 'rgba(167, 139, 250, 0)');
  pCtx.fillStyle = grad;
  pCtx.fillRect(0, 0, 32, 32);
  const packetTexture = new THREE.CanvasTexture(pCanvas);

  buoys.forEach((b) => {
    // Generate curved line from buoy position to (0, 15, 0)
    const pStart = b.basePos.clone().add(new THREE.Vector3(0, 1.45, 0));
    const pEnd = new THREE.Vector3(0, 15, 0);
    // Midpoint curved upward
    const pMid = new THREE.Vector3()
      .addVectors(pStart, pEnd)
      .multiplyScalar(0.5)
      .add(new THREE.Vector3(0, 4, 0));

    const curve = new THREE.QuadraticBezierCurve3(pStart, pMid, pEnd);

    // Faint guide line
    const points = curve.getPoints(36);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: '#7C3AED',
      transparent: true,
      opacity: 0.28
    });
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);

    // Moving data packets
    const pGeo = new THREE.BufferGeometry();
    const posArr = new Float32Array(packetsPerStream * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.45,
      map: packetTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.9
    });

    const packetMesh = new THREE.Points(pGeo, pMat);
    scene.add(packetMesh);

    streams.push({
      curve,
      line,
      packetMesh,
      pGeo,
      offsets: Array.from({ length: packetsPerStream }, (_, i) => i / packetsPerStream),
      active: true
    });
  });

  scene.add(twinGroup);

  return {
    group: twinGroup,
    feedbackRing,
    setStreamsActive: (active) => {
      streams.forEach((s) => {
        s.active = active;
        s.packetMesh.visible = active;
        s.line.visible = active;
      });
    },
    setFeedbackOpacity: (opacity) => {
      feedbackMat.opacity = opacity;
    },
    update: (time, dt) => {
      // Rotation animations
      coreWire.rotation.y = time * 0.4;
      coreWire.rotation.x = time * 0.25;

      innerMesh.rotation.y = -time * 0.6;
      innerMesh.rotation.z = time * 0.35;

      ring1.rotation.z = time * 0.8;
      ring2.rotation.y = time * 0.5;

      feedbackRing.rotation.z = time * 1.2;

      // Update data packet flow along curves
      streams.forEach((s) => {
        if (!s.active) return;
        const posAttr = s.pGeo.attributes.position;

        for (let i = 0; i < packetsPerStream; i++) {
          s.offsets[i] = (s.offsets[i] + dt * 0.35) % 1.0;
          const pt = s.curve.getPoint(s.offsets[i]);
          posAttr.setXYZ(i, pt.x, pt.y, pt.z);
        }
        posAttr.needsUpdate = true;
      });
    }
  };
}
