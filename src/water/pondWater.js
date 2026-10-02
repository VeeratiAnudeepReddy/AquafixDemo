import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createPondWater(scene) {
  const waterGroup = new THREE.Group();
  waterGroup.name = 'PondWater';

  const pw = CONFIG.farm.pondWidth - 0.2;
  const pl = CONFIG.farm.pondLength - 0.2;

  // Layered Water Surface Shader with dual-scale normal perturbation, sun glitter, aerator ripples, and shoreline foam
  const waterVertexShader = `
    uniform float uTime;
    uniform vec3 uAeratorPos[4];
    uniform float uAeratorActive[4];
    uniform vec3 uFishRipplePos;
    uniform float uFishRippleActive;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Base undulating wave
      float wave1 = sin(pos.x * 0.45 + uTime * 1.7) * 0.05;
      float wave2 = cos(pos.y * 0.38 + uTime * 1.3) * 0.045;
      float wave3 = sin((pos.x + pos.y) * 0.65 + uTime * 2.1) * 0.025;
      float totalDisp = wave1 + wave2 + wave3;

      vec4 worldPosition = modelMatrix * vec4(pos.x, pos.y, pos.z, 1.0);

      // Aerator radial ripples
      for (int i = 0; i < 4; i++) {
        if (uAeratorActive[i] > 0.05) {
          float d = length(worldPosition.xz - uAeratorPos[i].xz);
          if (d < 12.0) {
            float ripple = sin(d * 4.5 - uTime * 9.0) * exp(-d * 0.35) * 0.08 * uAeratorActive[i];
            totalDisp += ripple;
          }
        }
      }

      // Fish surfacing ripples
      if (uFishRippleActive > 0.05) {
        float fd = length(worldPosition.xz - uFishRipplePos.xz);
        if (fd < 6.0) {
          totalDisp += sin(fd * 6.0 - uTime * 7.0) * exp(-fd * 0.6) * 0.04 * uFishRippleActive;
        }
      }

      pos.z += totalDisp;
      worldPosition = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPosition.xyz;

      // Calculate surface normal derivative
      float dX = cos(pos.x * 0.45 + uTime * 1.7) * 0.022 + cos((pos.x + pos.y) * 0.65 + uTime * 2.1) * 0.016;
      float dY = -sin(pos.y * 0.38 + uTime * 1.3) * 0.017 + cos((pos.x + pos.y) * 0.65 + uTime * 2.1) * 0.016;
      vNormal = normalize(vec3(-dX, 1.0, -dY));

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const waterFragmentShader = `
    uniform float uTime;
    uniform vec3 uColorShallow;
    uniform vec3 uColorDeep;
    uniform vec3 uColorFoam;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform vec3 uCameraPos;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    // Dual-scale animated procedural micro-normals for wave glitter
    vec3 getDualNormals(vec2 uv, float time, vec3 baseNormal) {
      vec2 uv1 = uv * 14.0 + vec2(time * 0.06, time * 0.04);
      vec2 uv2 = uv * 32.0 - vec2(time * 0.08, -time * 0.05);

      float n1 = sin(uv1.x + sin(uv1.y)) * 0.08;
      float n2 = cos(uv2.x * 1.2 + cos(uv2.y * 1.1)) * 0.05;

      vec3 perturbed = baseNormal + vec3(n1 + n2, 0.0, n1 - n2);
      return normalize(perturbed);
    }

    void main() {
      vec3 viewDir = normalize(uCameraPos - vWorldPosition);
      vec3 normal = getDualNormals(vUv, uTime, vNormal);

      // Fresnel reflection factor
      float NdotV = max(dot(normal, viewDir), 0.0);
      float fresnel = clamp(1.0 - NdotV, 0.0, 1.0);
      fresnel = pow(fresnel, 3.0);

      // Sun Specular Highlight & Micro-Glitter
      vec3 halfDir = normalize(uSunDirection + viewDir);
      float NdotH = max(dot(normal, halfDir), 0.0);
      float broadSpec = pow(NdotH, 28.0) * 0.8;
      float sharpGlitter = pow(NdotH, 128.0) * 1.5;
      vec3 specular = uSunColor * (broadSpec + sharpGlitter);

      // Depth-based color: lighter teal in shallows near edges, deep teal in center
      float edgeDistX = min(vUv.x, 1.0 - vUv.x);
      float edgeDistY = min(vUv.y, 1.0 - vUv.y);
      float depthFactor = clamp(min(edgeDistX, edgeDistY) * 3.5, 0.0, 1.0);
      vec3 waterBody = mix(uColorShallow, uColorDeep, depthFactor);

      // Sky reflection mixed with fresnel
      vec3 waterReflect = mix(waterBody, uSkyColor, fresnel * 0.7);

      // Shoreline soft foam line with animated turbulence
      float foamNoise = sin(vUv.x * 70.0 + uTime * 2.5) * 0.008 + cos(vUv.y * 60.0 + uTime * 1.8) * 0.008;
      float foam = smoothstep(0.04 + foamNoise, 0.005, min(edgeDistX, edgeDistY));

      // Compose final water color
      vec3 finalColor = mix(waterReflect, uColorFoam, foam * 0.7);
      finalColor += specular;

      gl_FragColor = vec4(finalColor, 0.94);
    }
  `;

  // Aerator positions for ripples
  const aeratorPositions = CONFIG.farm.ponds.map((p) => new THREE.Vector3(p.x + 5, CONFIG.farm.waterLevelY, p.z));

  const waterUniforms = {
    uTime: { value: 0 },
    uColorShallow: { value: new THREE.Color('#38C1BA') }, // Vibrant light teal shallows
    uColorDeep: { value: new THREE.Color(CONFIG.palette.waterDeep) }, // Deep silt teal
    uColorFoam: { value: new THREE.Color('#F0FDFA') },
    uSunDirection: { value: new THREE.Vector3(45, 55, 35).normalize() },
    uSunColor: { value: new THREE.Color('#FFF5E4') },
    uSkyColor: { value: new THREE.Color(CONFIG.palette.skyPeach) },
    uCameraPos: { value: new THREE.Vector3() },
    uAeratorPos: { value: aeratorPositions },
    uAeratorActive: { value: [1.0, 1.0, 0.0, 1.0] }, // Pond 3 starts off
    uFishRipplePos: { value: new THREE.Vector3(-17, 0, 22) },
    uFishRippleActive: { value: 0.0 }
  };

  const waterMaterial = new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: waterUniforms,
    transparent: true,
    side: THREE.DoubleSide
  });

  const waterPlanes = [];

  CONFIG.farm.ponds.forEach((p) => {
    const geo = new THREE.PlaneGeometry(pw, pl, 56, 72);
    geo.rotateX(-Math.PI / 2);

    const mesh = new THREE.Mesh(geo, waterMaterial);
    mesh.position.set(p.x, CONFIG.farm.waterLevelY, p.z);
    mesh.receiveShadow = true;
    waterGroup.add(mesh);
    waterPlanes.push(mesh);
  });

  scene.add(waterGroup);

  return {
    group: waterGroup,
    material: waterMaterial,
    uniforms: waterUniforms,
    setAeratorActive: (pondIndex, active) => {
      waterUniforms.uAeratorActive.value[pondIndex] = active ? 1.0 : 0.0;
    },
    setFishRippling: (active) => {
      waterUniforms.uFishRippleActive.value = active ? 1.0 : 0.0;
    },
    update: (time, camera) => {
      waterUniforms.uTime.value = time;
      waterUniforms.uCameraPos.value.copy(camera.position);
    }
  };
}
