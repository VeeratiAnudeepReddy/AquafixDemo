import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * Underwater Atmosphere & Optical Effects for Hero Pond 3
 * Features:
 * - Bright, readable, crystal-clear light fog (#1B7F8C, visibility ~15m)
 * - Earthy silt floor (#7A6A4F) with animated multi-octave caustics
 * - Luminous water surface ceiling seen from below with rippling waves and meniscus surface line
 * - Soft volumetric sun shafts (god rays)
 * - Suspended drifting plankton / micro-bubbles
 */

export function createUnderwaterEffects(scene) {
  const underwaterGroup = new THREE.Group();
  underwaterGroup.name = 'UnderwaterEffects';

  const heroPond = CONFIG.farm.ponds.find((p) => p.hero);
  const pw = CONFIG.farm.pondWidth - 0.8;
  const pl = CONFIG.farm.pondLength - 0.8;

  // ----------------------------------------------------
  // 1. Earthy Silt Floor (#7A6A4F) with Animated Caustics
  // ----------------------------------------------------
  const siltCanvas = document.createElement('canvas');
  siltCanvas.width = 128;
  siltCanvas.height = 128;
  const sCtx = siltCanvas.getContext('2d');
  // Procedural silt texture matching #7A6A4F
  for (let x = 0; x < 128; x++) {
    for (let y = 0; y < 128; y++) {
      const n = (Math.random() - 0.5) * 18;
      const r = Math.floor(122 + n);
      const g = Math.floor(106 + n * 0.9);
      const b = Math.floor(79 + n * 0.8);
      sCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      sCtx.fillRect(x, y, 1, 1);
    }
  }
  const siltTexture = new THREE.CanvasTexture(siltCanvas);
  siltTexture.wrapS = THREE.RepeatWrapping;
  siltTexture.wrapT = THREE.RepeatWrapping;
  siltTexture.repeat.set(6, 6);

  const floorGeo = new THREE.PlaneGeometry(pw, pl, 36, 36);
  floorGeo.rotateX(-Math.PI / 2);

  const causticsVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPosition = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const causticsFragmentShader = `
    uniform float uTime;
    uniform sampler2D uSiltMap;
    uniform vec3 uSiltBaseColor;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    // Multi-octave procedural caustics pattern
    float causticWave(vec2 p, float speed, float scale) {
      vec2 p1 = p * scale + vec2(uTime * speed * 0.6, -uTime * speed * 0.45);
      vec2 p2 = p * (scale * 1.3) + vec2(-uTime * speed * 0.5, uTime * speed * 0.75);
      float c = sin(p1.x + sin(p1.y)) + sin(p2.x + sin(p2.y));
      return pow(abs(c) * 0.5, 3.0);
    }

    void main() {
      vec4 siltSample = texture2D(uSiltMap, vUv);
      vec3 siltColor = uSiltBaseColor * (siltSample.rgb * 1.1);

      float c1 = causticWave(vUv, 0.65, 14.0);
      float c2 = causticWave(vUv, 0.85, 22.0);
      float totalCaustic = (c1 * 0.65 + c2 * 0.35);

      vec3 causticLight = vec3(0.35, 0.95, 0.90) * totalCaustic * 1.9;
      
      // Falloff near edge of pond floor basin
      float edgeX = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
      float edgeY = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
      float edgeMask = edgeX * edgeY;

      vec3 finalFloor = siltColor + causticLight * edgeMask;
      gl_FragColor = vec4(finalFloor, 1.0);
    }
  `;

  const causticsMat = new THREE.ShaderMaterial({
    vertexShader: causticsVertexShader,
    fragmentShader: causticsFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uSiltMap: { value: siltTexture },
      uSiltBaseColor: { value: new THREE.Color(CONFIG.water.silt) } // #7A6A4F
    }
  });

  const floorMesh = new THREE.Mesh(floorGeo, causticsMat);
  floorMesh.position.set(heroPond.x, -CONFIG.farm.pondDepth + 0.04, heroPond.z);
  floorMesh.receiveShadow = true;
  underwaterGroup.add(floorMesh);

  // ----------------------------------------------------
  // 2. Visible Water Surface Ceiling (Seen from Below)
  // Bright ceiling with ripples and distinct surface horizon meniscus
  // ----------------------------------------------------
  const ceilingGeo = new THREE.PlaneGeometry(pw, pl, 40, 48);
  ceilingGeo.rotateX(Math.PI / 2); // Facing down toward the underwater camera

  const ceilingVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPosition = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const ceilingFragmentShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
      // Animated water meniscus ripples
      vec2 uv1 = vUv * 18.0 + vec2(uTime * 0.08, uTime * 0.06);
      vec2 uv2 = vUv * 34.0 - vec2(uTime * 0.10, -uTime * 0.07);
      float ripple = sin(uv1.x + sin(uv1.y)) * 0.5 + cos(uv2.x + cos(uv2.y)) * 0.5;

      // Bright translucent ceiling with light cyan glow
      vec3 ceilingColor = mix(vec3(0.35, 0.88, 0.85), vec3(0.85, 0.98, 0.95), ripple * 0.35 + 0.45);

      // Edge perimeter surface line tint (air-water boundary ring)
      float edgeX = min(vUv.x, 1.0 - vUv.x);
      float edgeY = min(vUv.y, 1.0 - vUv.y);
      float border = smoothstep(0.04, 0.005, min(edgeX, edgeY));
      vec3 finalCeiling = mix(ceilingColor, vec3(0.95, 0.85, 0.70), border * 0.65);

      gl_FragColor = vec4(finalCeiling, 0.75);
    }
  `;

  const ceilingMat = new THREE.ShaderMaterial({
    vertexShader: ceilingVertexShader,
    fragmentShader: ceilingFragmentShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceilingMesh.position.set(heroPond.x, CONFIG.farm.waterLevelY - 0.015, heroPond.z);
  underwaterGroup.add(ceilingMesh);

  // ----------------------------------------------------
  // 3. Volumetric Light Shafts (God Rays from Sun)
  // ----------------------------------------------------
  const shaftGroup = new THREE.Group();
  shaftGroup.position.set(heroPond.x, -1.8, heroPond.z);

  const shaftVertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const shaftFragmentShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      // Soft vertical taper from surface downwards
      float verticalFade = (1.0 - vUv.y) * smoothstep(0.0, 0.25, vUv.y);
      float shimmer = 0.88 + sin(uTime * 2.2 + vUv.x * 10.0) * 0.12;
      vec3 rayColor = vec3(0.35, 0.95, 0.92) * shimmer;
      float alpha = verticalFade * 0.18;

      gl_FragColor = vec4(rayColor, alpha);
    }
  `;

  const shaftMat = new THREE.ShaderMaterial({
    vertexShader: shaftVertexShader,
    fragmentShader: shaftFragmentShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const shaftGeo = new THREE.CylinderGeometry(0.35, 2.4, 3.2, 16, 1, true);

  for (let s = 0; s < 7; s++) {
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    const angle = (s / 7) * Math.PI * 2;
    const r = 3.8 + (s % 2) * 1.4;
    shaft.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    shaft.rotation.z = 0.24;
    shaft.rotation.x = -0.15;
    shaftGroup.add(shaft);
  }
  underwaterGroup.add(shaftGroup);

  // ----------------------------------------------------
  // 4. Suspended Plankton & Micro-Bubbles
  // ----------------------------------------------------
  const particleCount = 280;
  const particleGeo = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  const particleVelocities = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3 + 0] = heroPond.x + (Math.random() - 0.5) * (pw - 2.5);
    particlePositions[i * 3 + 1] = -0.7 - Math.random() * (CONFIG.farm.pondDepth - 1.2);
    particlePositions[i * 3 + 2] = heroPond.z + (Math.random() - 0.5) * (pl - 2.5);

    particleVelocities[i * 3 + 0] = (Math.random() - 0.5) * 0.12;
    particleVelocities[i * 3 + 1] = 0.10 + Math.random() * 0.18;
    particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

  const pCanvas = document.createElement('canvas');
  pCanvas.width = 32;
  pCanvas.height = 32;
  const pCtx = pCanvas.getContext('2d');
  const g = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  g.addColorStop(0.4, 'rgba(78, 222, 215, 0.65)');
  g.addColorStop(1, 'rgba(78, 222, 215, 0)');
  pCtx.fillStyle = g;
  pCtx.fillRect(0, 0, 32, 32);

  const particleTexture = new THREE.CanvasTexture(pCanvas);

  const particleMat = new THREE.PointsMaterial({
    size: 0.24,
    map: particleTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.82
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  underwaterGroup.add(particles);

  scene.add(underwaterGroup);

  let isUnderwaterMode = false;
  const surfaceFogColor = new THREE.Color(CONFIG.palette.skyPeach);
  const underwaterFogColor = new THREE.Color(CONFIG.water.underwaterFog); // #1B7F8C (Light, bright, clear)

  return {
    group: underwaterGroup,
    setUnderwaterVisibility: (underwaterProgress) => {
      // Smooth fog transition between aerial and underwater
      const targetNear = THREE.MathUtils.lerp(65, 5, underwaterProgress);
      const targetFar = THREE.MathUtils.lerp(230, 32, underwaterProgress);
      scene.fog.near = targetNear;
      scene.fog.far = targetFar;
      scene.fog.color.lerpColors(surfaceFogColor, underwaterFogColor, underwaterProgress);
    },
    update: (time, dt, camera) => {
      causticsMat.uniforms.uTime.value = time;
      ceilingMat.uniforms.uTime.value = time;
      shaftMat.uniforms.uTime.value = time;

      shaftGroup.rotation.y = Math.sin(time * 0.22) * 0.06;

      // Animate drifting particles rising
      const posAttr = particleGeo.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        let py = posAttr.getY(i) + particleVelocities[i * 3 + 1] * dt;
        if (py > -0.48) {
          py = -CONFIG.farm.pondDepth + 0.35;
        }
        posAttr.setY(i, py);

        const px = posAttr.getX(i) + Math.sin(time * 1.8 + i) * 0.003;
        posAttr.setX(i, px);
      }
      posAttr.needsUpdate = true;

      // Camera distance fog transition
      const camY = camera.position.y;
      if (camY < -0.38 && !isUnderwaterMode) {
        isUnderwaterMode = true;
        scene.fog.color.copy(underwaterFogColor);
        scene.fog.near = 5;
        scene.fog.far = 32; // Crisp visibility window ~15m
      } else if (camY >= -0.38 && isUnderwaterMode) {
        isUnderwaterMode = false;
        scene.fog.color.copy(surfaceFogColor);
        scene.fog.near = 65;
        scene.fog.far = 230;
      }
    }
  };
}
