import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * Pond Water Surface Simulation — PART 1: Clear BLUE water
 * Features:
 * - Blue water: shallow #38B6F0, mid #1E8FD6, deep #0B5FA8
 * - Strong colour contrast against warm earth land
 * - Most saturated object in every aerial frame
 * - Depth-based multi-tier color blending
 * - Clear white foam line along concrete edge
 * - Fresnel sky reflection picking up BLUE, not green
 * - Pond risk tint: hero pond shifts to duller blue-grey (max 12%)
 * - Transparency ~0.8 so floor and fish faintly visible from above
 */

export function createPondWater(scene) {
  const waterGroup = new THREE.Group();
  waterGroup.name = 'PondWater';

  const pw = CONFIG.farm.pondWidth - 0.2;
  const pl = CONFIG.farm.pondLength - 0.2;

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

      // Base gentle water undulation
      float wave1 = sin(pos.x * 0.40 + uTime * 1.5) * 0.04;
      float wave2 = cos(pos.y * 0.35 + uTime * 1.2) * 0.035;
      float wave3 = sin((pos.x + pos.y) * 0.60 + uTime * 1.9) * 0.02;
      float totalDisp = wave1 + wave2 + wave3;

      vec4 worldPosition = modelMatrix * vec4(pos.x, pos.y, pos.z, 1.0);

      // Aerator radial ripples
      for (int i = 0; i < 4; i++) {
        if (uAeratorActive[i] > 0.05) {
          float d = length(worldPosition.xz - uAeratorPos[i].xz);
          if (d < 14.0) {
            float ripple = sin(d * 4.2 - uTime * 8.5) * exp(-d * 0.32) * 0.075 * uAeratorActive[i];
            totalDisp += ripple;
          }
        }
      }

      // Fish surfacing ripples (near Hero pond buoy during low DO)
      if (uFishRippleActive > 0.05) {
        float fd = length(worldPosition.xz - uFishRipplePos.xz);
        if (fd < 7.0) {
          totalDisp += sin(fd * 5.5 - uTime * 6.5) * exp(-fd * 0.55) * 0.035 * uFishRippleActive;
        }
      }

      pos.z += totalDisp;
      worldPosition = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPosition.xyz;

      // Calculated surface normal derivatives
      float dX = cos(pos.x * 0.40 + uTime * 1.5) * 0.016 + cos((pos.x + pos.y) * 0.60 + uTime * 1.9) * 0.012;
      float dY = -sin(pos.y * 0.35 + uTime * 1.2) * 0.012 + cos((pos.x + pos.y) * 0.60 + uTime * 1.9) * 0.012;
      vNormal = normalize(vec3(-dX, 1.0, -dY));

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const waterFragmentShader = `
    uniform float uTime;
    uniform vec3 uColorShallow;
    uniform vec3 uColorMid;
    uniform vec3 uColorDeep;
    uniform vec3 uColorRiskTint;
    uniform float uRiskLevel[4];
    uniform int uPondIndex;
    uniform vec3 uColorFoam;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform vec3 uCameraPos;
    uniform vec3 uAeratorPos[4];
    uniform float uAeratorActive[4];
    uniform float uTransparency;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    // Dual-scale scrolling procedural normal perturbation for glitter
    vec3 getDualNormals(vec2 uv, float time, vec3 baseNormal) {
      vec2 uv1 = uv * 16.0 + vec2(time * 0.05, time * 0.03);
      vec2 uv2 = uv * 36.0 - vec2(time * 0.07, -time * 0.04);

      float n1 = sin(uv1.x + sin(uv1.y)) * 0.07;
      float n2 = cos(uv2.x * 1.2 + cos(uv2.y * 1.1)) * 0.045;

      vec3 perturbed = baseNormal + vec3(n1 + n2, 0.0, n1 - n2);
      return normalize(perturbed);
    }

    void main() {
      vec3 viewDir = normalize(uCameraPos - vWorldPosition);
      vec3 normal = getDualNormals(vUv, uTime, vNormal);

      // Fresnel reflection: stronger at grazing angles, transparent when looking down
      float NdotV = max(dot(normal, viewDir), 0.0);
      float fresnel = pow(1.0 - NdotV, 3.2);

      // Specular Sun Glitter Highlight — soft glitter
      vec3 halfDir = normalize(uSunDirection + viewDir);
      float NdotH = max(dot(normal, halfDir), 0.0);
      float broadSpec = pow(NdotH, 24.0) * 0.55;
      float sharpGlitter = pow(NdotH, 140.0) * 1.35;
      vec3 specular = uSunColor * (broadSpec + sharpGlitter);

      // Depth-based color: shallow blue edges -> mid blue -> deep blue center
      float edgeDistX = min(vUv.x, 1.0 - vUv.x);
      float edgeDistY = min(vUv.y, 1.0 - vUv.y);
      float depthFactor = clamp(min(edgeDistX, edgeDistY) * 3.4, 0.0, 1.0);

      vec3 waterBase = mix(uColorShallow, uColorMid, smoothstep(0.0, 0.45, depthFactor));
      waterBase = mix(waterBase, uColorDeep, smoothstep(0.45, 1.0, depthFactor));

      // Pond risk tint: shift toward duller blue-grey (max 12%), NEVER green/red
      float risk = uRiskLevel[uPondIndex];
      waterBase = mix(waterBase, uColorRiskTint, risk * 0.12);

      // Sky reflection via fresnel — picks up BLUE from sky, not green
      vec3 skyReflection = mix(uSkyColor, vec3(0.45, 0.72, 0.95), 0.5); // force blue tint in reflection
      vec3 waterColor = mix(waterBase, skyReflection, fresnel * 0.55);

      // Clear white foam line along concrete edge
      float foamNoise = sin(vUv.x * 65.0 + uTime * 2.2) * 0.007 + cos(vUv.y * 55.0 + uTime * 1.6) * 0.007;
      float edgeFoam = smoothstep(0.035 + foamNoise, 0.005, min(edgeDistX, edgeDistY));

      // Aerator splash foam ring — white
      float aeratorFoam = 0.0;
      for (int i = 0; i < 4; i++) {
        if (uAeratorActive[i] > 0.05) {
          float d = length(vWorldPosition.xz - uAeratorPos[i].xz);
          if (d < 3.2) {
            float aNoise = sin(vUv.x * 80.0 + uTime * 4.0) * 0.15;
            aeratorFoam += smoothstep(3.2, 0.4, d + aNoise) * 0.65 * uAeratorActive[i];
          }
        }
      }

      float totalFoam = clamp(edgeFoam * 0.75 + aeratorFoam, 0.0, 1.0);
      vec3 finalColor = mix(waterColor, uColorFoam, totalFoam);
      finalColor += specular;

      // Transparency: ~0.80 from top-down so floor and fish faintly visible
      float alpha = mix(uTransparency, 0.92, fresnel);
      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  // Aerator positions for ripples and foam
  const aeratorPositions = CONFIG.farm.ponds.map((p) => new THREE.Vector3(p.x + 5, CONFIG.farm.waterLevelY, p.z));

  const waterUniforms = {
    uTime: { value: 0 },
    uColorShallow: { value: new THREE.Color(CONFIG.water.shallow) },     // #38B6F0
    uColorMid: { value: new THREE.Color(CONFIG.water.mid) },             // #1E8FD6
    uColorDeep: { value: new THREE.Color(CONFIG.water.deep) },           // #0B5FA8
    uColorRiskTint: { value: new THREE.Color(CONFIG.water.heroRiskTint) }, // #7A9AB8 duller blue-grey
    uColorFoam: { value: new THREE.Color(CONFIG.water.foamWhite) },      // #F8FDFF white
    uRiskLevel: { value: [0.0, 0.35, 0.75, 0.0] },                      // P1: Low, P2: Med, P3: High, P4: Low
    uPondIndex: { value: 0 },
    uSunDirection: { value: new THREE.Vector3(45, 55, 35).normalize() },
    uSunColor: { value: new THREE.Color('#FFF5E4') },
    uSkyColor: { value: new THREE.Color(CONFIG.palette.skyBlue) },       // Blue sky reflection, not peach
    uCameraPos: { value: new THREE.Vector3() },
    uAeratorPos: { value: aeratorPositions },
    uAeratorActive: { value: [1.0, 1.0, 0.0, 1.0] }, // Pond 3 starts off
    uFishRipplePos: { value: new THREE.Vector3(-17, 0, 22) },
    uFishRippleActive: { value: 0.0 },
    uTransparency: { value: CONFIG.water.transparency }
  };

  const waterPlanes = [];

  CONFIG.farm.ponds.forEach((p, index) => {
    const geo = new THREE.PlaneGeometry(pw, pl, 56, 72);
    geo.rotateX(-Math.PI / 2);

    // Clone uniforms for per-pond index binding
    const pondUniforms = {
      ...waterUniforms,
      uPondIndex: { value: index }
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: pondUniforms,
      transparent: true,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, CONFIG.farm.waterLevelY, p.z);
    mesh.receiveShadow = true;
    waterGroup.add(mesh);
    waterPlanes.push({ mesh, mat });
  });

  scene.add(waterGroup);

  return {
    group: waterGroup,
    setAeratorActive: (pondIndex, active) => {
      waterUniforms.uAeratorActive.value[pondIndex] = active ? 1.0 : 0.0;
    },
    setRiskLevel: (pondIndex, riskVal) => {
      waterUniforms.uRiskLevel.value[pondIndex] = riskVal;
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
