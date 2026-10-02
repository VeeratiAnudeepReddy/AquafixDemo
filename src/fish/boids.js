import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createFishGeometries } from './species.js';

export function createFishFlocks(scene) {
  const flockGroup = new THREE.Group();
  flockGroup.name = 'FishFlocks';

  const geometries = createFishGeometries();
  const ponds = CONFIG.farm.ponds;
  const pw = CONFIG.farm.pondWidth;
  const pl = CONFIG.farm.pondLength;

  // Traveling sinusoidal body wave vertex shader & belly/back gradient fragment shader
  const fishVertexShader = `
    uniform float uTime;
    uniform float uWiggleSpeed;
    uniform float uWiggleAmp;
    
    attribute float aPhase;
    attribute float aDistress;
    attribute float aScale;
    
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vDistress;
    varying float vLocalY;

    void main() {
      vDistress = aDistress;
      vLocalY = position.y;
      vec3 pos = position;

      // Traveling body wave from head (+X) to tail (-X)
      float tailFactor = clamp(0.2 - pos.x * 1.4, 0.0, 1.4);
      float speed = uWiggleSpeed * (1.0 + aDistress * 1.6);
      float amp = uWiggleAmp * (1.0 + aDistress * 0.9);
      
      // Sinusoidal wave traveling head-to-tail
      float wave = sin(uTime * speed - pos.x * 3.2 + aPhase) * amp * tailFactor;
      pos.z += wave;

      #ifdef USE_INSTANCING
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
        vNormal = normalize(mat3(modelViewMatrix * instanceMatrix) * normal);
      #else
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vNormal = normalize(normalMatrix * normal);
      #endif

      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fishFragmentShader = `
    uniform vec3 uBackColor;
    uniform vec3 uBellyColor;
    uniform vec3 uPaleColor;
    
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vDistress;
    varying float vLocalY;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 lightDir = normalize(vec3(0.4, 0.9, 0.3));
      vec3 viewDir = normalize(vViewPosition);

      // Diffuse light
      float NdotL = max(dot(normal, lightDir), 0.0);
      float diff = NdotL * 0.65 + 0.35;

      // Counter-shading: darker dorsal back, lighter silver belly
      float verticalBlend = clamp(vLocalY * 2.5 + 0.5, 0.0, 1.0);
      vec3 baseColor = mix(uBellyColor, uBackColor, verticalBlend);

      // Distressed fish turn pale silver
      vec3 fishColor = mix(baseColor, uPaleColor, vDistress * 0.7);

      // Soft Specular Sheen (Fish scales)
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 24.0) * 0.45;

      // Fresnel rim reflection
      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
      vec3 rimColor = vec3(0.4, 0.7, 0.8) * fresnel * 0.35;

      vec3 finalColor = fishColor * diff + spec + rimColor;
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  const pondsFlocks = [];

  // Temporary vectors for matrix math (zero allocation per frame)
  const dummy = new THREE.Object3D();
  const vPos = new THREE.Vector3();
  const vDir = new THREE.Vector3();

  ponds.forEach((p) => {
    let count = CONFIG.fish.counts.pond1;
    let geo = geometries.tilapia;
    let backColor = new THREE.Color('#3B729E');  // Slate-blue spine
    let bellyColor = new THREE.Color('#C7E1F2'); // Silvery-white belly
    let isShrimp = false;

    if (p.id === 2) {
      count = CONFIG.fish.counts.pond2;
      geo = geometries.rohu;
      backColor = new THREE.Color('#78622F');  // Olive-bronze carp spine
      bellyColor = new THREE.Color('#D8CB9C'); // Creamy golden-bronze belly
    } else if (p.id === 3) {
      count = CONFIG.fish.counts.pond3;
      geo = geometries.tilapia;
      backColor = new THREE.Color('#2B6E94');
      bellyColor = new THREE.Color('#B8DCEF');
    } else if (p.id === 4) {
      count = CONFIG.fish.counts.pond4;
      geo = geometries.shrimp;
      backColor = new THREE.Color('#E05D52');  // Pinkish-coral carapace
      bellyColor = new THREE.Color('#FCA5A5'); // Translucent pinkish underside
      isShrimp = true;
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: fishVertexShader,
      fragmentShader: fishFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWiggleSpeed: { value: isShrimp ? 7.5 : 5.8 },
        uWiggleAmp: { value: 0.11 },
        uBackColor: { value: backColor },
        uBellyColor: { value: bellyColor },
        uPaleColor: { value: new THREE.Color('#E2E8F0') }
      }
    });

    const instancedMesh = new THREE.InstancedMesh(geo, mat, count);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    // Attributes for phase, distress, and individual size variation
    const phases = new Float32Array(count);
    const distressArr = new Float32Array(count);
    const scalesArr = new Float32Array(count);

    // Dynamic states
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const individualSpeeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      phases[i] = Math.random() * Math.PI * 2;
      distressArr[i] = 0.0;
      // Slight natural size variation (0.85 to 1.15)
      const s = 0.85 + Math.random() * 0.3;
      scalesArr[i] = s;
      individualSpeeds[i] = 0.9 + Math.random() * 0.25;

      const px = p.x + (Math.random() - 0.5) * (pw - 4);
      let py = -1.3 - Math.random() * (CONFIG.farm.pondDepth - 1.8);
      if (isShrimp) {
        py = -2.9 - Math.random() * 0.35;
      }
      const pz = p.z + (Math.random() - 0.5) * (pl - 4);

      pos[i * 3 + 0] = px;
      pos[i * 3 + 1] = py;
      pos[i * 3 + 2] = pz;

      const angle = Math.random() * Math.PI * 2;
      const speed = (1.6 + Math.random() * 1.4) * individualSpeeds[i];
      vel[i * 3 + 0] = Math.cos(angle) * speed;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
      vel[i * 3 + 2] = Math.sin(angle) * speed;
    }

    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    geo.setAttribute('aDistress', new THREE.InstancedBufferAttribute(distressArr, 1));
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scalesArr, 1));

    flockGroup.add(instancedMesh);

    pondsFlocks.push({
      pondId: p.id,
      hero: p.hero,
      isShrimp,
      count,
      mesh: instancedMesh,
      mat,
      geo,
      pos,
      vel,
      scalesArr,
      phases,
      distressArr,
      distressLevel: 0.0,
      targetYMin: isShrimp ? -3.3 : -2.6,
      targetYMax: isShrimp ? -2.9 : -1.2,
      baseSpeed: isShrimp ? 1.6 : 2.6
    });
  });

  scene.add(flockGroup);

  return {
    group: flockGroup,
    setDistress: (pondId, distress) => {
      const f = pondsFlocks.find((fl) => fl.pondId === pondId);
      if (!f) return;
      f.distressLevel = distress;

      // Low DO: fish rise up to surface and gasp
      if (distress > 0.3) {
        f.targetYMin = -0.75;
        f.targetYMax = -0.48;
      } else {
        f.targetYMin = -2.6;
        f.targetYMax = -1.2;
      }

      for (let i = 0; i < f.count; i++) {
        f.distressArr[i] = distress;
      }
      f.geo.attributes.aDistress.needsUpdate = true;
    },
    update: (time, dt) => {
      pondsFlocks.forEach((f) => {
        f.mat.uniforms.uTime.value = time;

        const pondInfo = CONFIG.farm.ponds.find((p) => p.id === f.pondId);
        const minX = pondInfo.x - pw / 2 + 1.5;
        const maxX = pondInfo.x + pw / 2 - 1.5;
        const minZ = pondInfo.z - pl / 2 + 1.5;
        const maxZ = pondInfo.z + pl / 2 - 1.5;

        const speedMult = f.distressLevel > 1.2 ? 0.35 : (f.distressLevel > 0.4 ? 1.45 : 1.0);

        for (let i = 0; i < f.count; i++) {
          let ix = f.pos[i * 3 + 0];
          let iy = f.pos[i * 3 + 1];
          let iz = f.pos[i * 3 + 2];

          let ivx = f.vel[i * 3 + 0];
          let ivy = f.vel[i * 3 + 1];
          let ivz = f.vel[i * 3 + 2];

          // 1. Boundary soft push
          const bForce = 4.2;
          if (ix < minX) ivx += bForce * dt;
          if (ix > maxX) ivx -= bForce * dt;
          if (iz < minZ) ivz += bForce * dt;
          if (iz > maxZ) ivz -= bForce * dt;

          if (iy < f.targetYMin) ivy += bForce * dt;
          if (iy > f.targetYMax) ivy -= bForce * dt;

          // 2. Neighbor alignment & separation (sample subset)
          let closeCount = 0;
          let sepX = 0, sepZ = 0;
          let avgVx = 0, avgVz = 0;

          const sampleStep = Math.max(1, Math.floor(f.count / 14));
          for (let j = 0; j < f.count; j += sampleStep) {
            if (i === j) continue;
            const dx = ix - f.pos[j * 3 + 0];
            const dz = iz - f.pos[j * 3 + 2];
            const distSq = dx * dx + dz * dz;

            if (distSq < 2.6 && distSq > 0.001) {
              sepX += dx / distSq;
              sepZ += dz / distSq;
              avgVx += f.vel[j * 3 + 0];
              avgVz += f.vel[j * 3 + 2];
              closeCount++;
            }
          }

          if (closeCount > 0) {
            ivx += (sepX / closeCount) * 1.9 * dt;
            ivz += (sepZ / closeCount) * 1.9 * dt;
            ivx += ((avgVx / closeCount) - ivx) * 0.85 * dt;
            ivz += ((avgVz / closeCount) - ivz) * 0.85 * dt;
          }

          // Distress twitch & surface gasping
          if (f.distressLevel > 0.4 && f.distressLevel <= 1.2) {
            ivx += (Math.random() - 0.5) * 3.2 * dt;
            ivz += (Math.random() - 0.5) * 3.2 * dt;
          }

          const curSpeed = Math.sqrt(ivx * ivx + ivz * ivz);
          const desSpeed = f.baseSpeed * speedMult;
          if (curSpeed > 0.001) {
            ivx = (ivx / curSpeed) * desSpeed;
            ivz = (ivz / curSpeed) * desSpeed;
          }
          ivy = THREE.MathUtils.clamp(ivy, -0.65, 0.65);

          ix += ivx * dt;
          iy += ivy * dt;
          iz += ivz * dt;

          f.pos[i * 3 + 0] = ix;
          f.pos[i * 3 + 1] = iy;
          f.pos[i * 3 + 2] = iz;
          f.vel[i * 3 + 0] = ivx;
          f.vel[i * 3 + 1] = ivy;
          f.vel[i * 3 + 2] = ivz;

          // Matrix update with scale & heading
          dummy.position.set(ix, iy, iz);
          const s = f.scalesArr[i];
          dummy.scale.set(s, s, s);

          vDir.set(ivx, ivy, ivz).normalize();
          dummy.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), vDir);

          // Lethargic listing tilt
          if (f.distressLevel > 1.2 && (i % 3 === 0)) {
            dummy.rotation.z += 0.85;
          }

          dummy.updateMatrix();
          f.mesh.setMatrixAt(i, dummy.matrix);
        }

        f.mesh.instanceMatrix.needsUpdate = true;
      });
    }
  };
}
