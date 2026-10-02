import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createUnderwaterEffects(scene) {
  const underwaterGroup = new THREE.Group();
  underwaterGroup.name = 'UnderwaterEffects';

  const heroPond = CONFIG.farm.ponds.find((p) => p.hero);
  const pw = CONFIG.farm.pondWidth - 1;
  const pl = CONFIG.farm.pondLength - 1;

  // 1. Procedural Mud/Silt Floor Texture with Animated Caustics
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  for (let x = 0; x < 128; x++) {
    for (let y = 0; y < 128; y++) {
      const v = Math.floor(25 + Math.random() * 20);
      ctx.fillStyle = `rgb(${v}, ${v + 8}, ${v + 4})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const siltTexture = new THREE.CanvasTexture(canvas);
  siltTexture.wrapS = THREE.RepeatWrapping;
  siltTexture.wrapT = THREE.RepeatWrapping;
  siltTexture.repeat.set(8, 8);

  const causticsGeo = new THREE.PlaneGeometry(pw, pl, 36, 36);
  causticsGeo.rotateX(-Math.PI / 2);

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
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    // Multi-octave procedural caustics simulation
    float causticLayer(vec2 p, float speed, float scale) {
      vec2 p1 = p * scale + vec2(uTime * speed * 0.7, -uTime * speed * 0.5);
      vec2 p2 = p * (scale * 1.25) + vec2(-uTime * speed * 0.6, uTime * speed * 0.8);
      float c = sin(p1.x + sin(p1.y)) + sin(p2.x + sin(p2.y));
      return pow(abs(c) * 0.5, 3.2);
    }

    void main() {
      vec4 silt = texture2D(uSiltMap, vUv);
      float c1 = causticLayer(vUv, 0.7, 16.0);
      float c2 = causticLayer(vUv, 0.9, 24.0);
      float totalCaustic = (c1 * 0.65 + c2 * 0.35);

      vec3 causticColor = vec3(0.3, 0.9, 0.85) * totalCaustic * 2.2;
      
      // Soft falloff near edges of basin floor
      float edgeX = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
      float edgeY = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
      float alpha = edgeX * edgeY * 0.7;

      gl_FragColor = vec4(causticColor + silt.rgb * 0.2, alpha);
    }
  `;

  const causticsUniforms = {
    uTime: { value: 0 },
    uSiltMap: { value: siltTexture }
  };

  const causticsMat = new THREE.ShaderMaterial({
    vertexShader: causticsVertexShader,
    fragmentShader: causticsFragmentShader,
    uniforms: causticsUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const causticsMesh = new THREE.Mesh(causticsGeo, causticsMat);
  causticsMesh.position.set(heroPond.x, -CONFIG.farm.pondDepth + 0.06, heroPond.z);
  underwaterGroup.add(causticsMesh);

  // 2. Volumetric Light Shafts (God Rays)
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
      // Soft falloff towards base and edges
      float verticalFade = (1.0 - vUv.y) * smoothstep(0.0, 0.2, vUv.y);
      float shimmer = 0.85 + sin(uTime * 2.5 + vUv.x * 12.0) * 0.15;
      vec3 rayColor = vec3(0.2, 0.85, 0.8) * shimmer;
      float alpha = verticalFade * 0.16;

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

  const shaftGeo = new THREE.CylinderGeometry(0.4, 2.2, 3.4, 16, 1, true);

  for (let s = 0; s < 6; s++) {
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    const angle = (s / 6) * Math.PI * 2;
    const r = 3.6 + (s % 2) * 1.2;
    shaft.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    shaft.rotation.z = 0.22;
    shaft.rotation.x = -0.14;
    shaftGroup.add(shaft);
  }
  underwaterGroup.add(shaftGroup);

  // 3. Suspended Drifting Micro-Particles (Plankton & Air Bubbles)
  const particleCount = 320;
  const particleGeo = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  const particleVelocities = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3 + 0] = heroPond.x + (Math.random() - 0.5) * (pw - 2);
    particlePositions[i * 3 + 1] = -0.6 - Math.random() * (CONFIG.farm.pondDepth - 1.0);
    particlePositions[i * 3 + 2] = heroPond.z + (Math.random() - 0.5) * (pl - 2);

    particleVelocities[i * 3 + 0] = (Math.random() - 0.5) * 0.18;
    particleVelocities[i * 3 + 1] = 0.12 + Math.random() * 0.22;
    particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.18;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

  // Canvas texture for round luminous particles
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 32;
  pCanvas.height = 32;
  const pCtx = pCanvas.getContext('2d');
  const g = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  g.addColorStop(0.35, 'rgba(64, 224, 208, 0.6)');
  g.addColorStop(1, 'rgba(64, 224, 208, 0)');
  pCtx.fillStyle = g;
  pCtx.fillRect(0, 0, 32, 32);

  const particleTexture = new THREE.CanvasTexture(pCanvas);

  const particleMat = new THREE.PointsMaterial({
    size: 0.28,
    map: particleTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.8
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  underwaterGroup.add(particles);

  scene.add(underwaterGroup);

  let isUnderwaterMode = false;
  const surfaceFogColor = new THREE.Color(CONFIG.palette.skyPeach);
  const underwaterFogColor = new THREE.Color('#0A3A44'); // Deep turquoise underwater fog

  return {
    group: underwaterGroup,
    update: (time, dt, camera) => {
      causticsUniforms.uTime.value = time;
      shaftMat.uniforms.uTime.value = time;

      shaftGroup.rotation.y = Math.sin(time * 0.25) * 0.08;

      // Animate drifting particles rising
      const posAttr = particleGeo.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        let py = posAttr.getY(i) + particleVelocities[i * 3 + 1] * dt;
        if (py > -0.42) {
          py = -CONFIG.farm.pondDepth + 0.25;
        }
        posAttr.setY(i, py);

        const px = posAttr.getX(i) + Math.sin(time * 2 + i) * 0.004;
        posAttr.setX(i, px);
      }
      posAttr.needsUpdate = true;

      // Distance fog transition tuned so fish stay crisp and readable
      const camY = camera.position.y;
      if (camY < -0.3 && !isUnderwaterMode) {
        isUnderwaterMode = true;
        scene.fog.color.copy(underwaterFogColor);
        scene.fog.near = 4;
        scene.fog.far = 42; // Clear visibility window for fish
      } else if (camY >= -0.3 && isUnderwaterMode) {
        isUnderwaterMode = false;
        scene.fog.color.copy(surfaceFogColor);
        scene.fog.near = 65;
        scene.fog.far = 230;
      }
    }
  };
}
