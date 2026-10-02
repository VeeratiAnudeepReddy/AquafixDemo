import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createFishGeometries } from './species.js';

/**
 * Realistic Boids Steering, Hard Containment & Animated Vertex-Wave Fish Simulation
 */

export function createFishFlocks(scene) {
  const flockGroup = new THREE.Group();
  flockGroup.name = 'FishFlocks';

  const geometries = createFishGeometries();
  const ponds = CONFIG.farm.ponds;

  // Global clamp event counter for containment validation
  let totalClampEvents = 0;
  let debugWireframesVisible = false;
  const wireframeGroup = new THREE.Group();
  wireframeGroup.name = 'SwimVolumeDebug';
  wireframeGroup.visible = false;
  scene.add(wireframeGroup);

  // Build debug wireframe boxes for each pond's swim volume
  ponds.forEach((p) => {
    const sv = p.swimVolume;
    const boxGeo = new THREE.BoxGeometry(
      sv.maxX - sv.minX,
      sv.maxY - sv.minY,
      sv.maxZ - sv.minZ
    );
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: p.id === 3 ? 0xFF3B30 : (p.id === 4 ? 0xFF8A80 : 0x3DDC84),
      linewidth: 1
    });
    const line = new THREE.LineSegments(edges, lineMat);
    line.position.set(
      (sv.minX + sv.maxX) * 0.5,
      (sv.minY + sv.maxY) * 0.5,
      (sv.minZ + sv.maxZ) * 0.5
    );
    wireframeGroup.add(line);
  });

  // Travelling sinusoidal body wave vertex shader
  // Head at +X, Tail at -X. Wave amplitude: head ~5%, tail 100%.
  // Head counter-sways, fins flap gently.
  const fishVertexShader = `
    uniform float uTime;
    
    attribute float aPhase;
    attribute float aDistress;
    attribute float aScale;
    attribute float aSpeedRatio; // actualSpeed / baseSpeed
    
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vViewPosition;
    varying float vDistress;
    varying float vLocalY;
    varying float vLocalX;
    varying float vLocalZ;

    void main() {
      vDistress = aDistress;
      vLocalY = position.y;
      vLocalX = position.x;
      vLocalZ = position.z;

      vec3 pos = position;

      // Fish body length approx 1.5; nose at +0.75, tail at -0.75
      // uProgress: 0.0 at nose, 1.0 at tail
      float uProgress = clamp(0.5 - pos.x * 0.65, 0.0, 1.0);

      // Tail amplitude grows progressively: head ~5%, tail 100%
      float ampProgress = 0.05 + 0.95 * pow(uProgress, 1.45);

      // Wave speed proportional to actual fish swimming speed
      float beatFreq = (3.8 + aDistress * 2.8) * max(0.4, aSpeedRatio);
      float spatialFreq = 3.6;

      // Travelling spine wave along lateral Z axis
      float wave = sin(uTime * beatFreq - pos.x * spatialFreq + aPhase) * 0.12 * ampProgress;
      pos.z += wave;

      // Natural counter-sway of head (slight opposing yaw displacement at nose)
      float headFactor = clamp(1.0 - uProgress * 2.2, 0.0, 1.0);
      float headSway = -sin(uTime * beatFreq + aPhase) * 0.024 * headFactor;
      pos.z += headSway;

      // Pectoral fin flap (vertices near midbody lower lateral sides)
      if (pos.x > 0.05 && pos.x < 0.35 && abs(pos.z) > 0.08) {
        float finFlap = sin(uTime * beatFreq * 1.2 + aPhase) * 0.025;
        pos.y += finFlap * sign(pos.y);
      }

      #ifdef USE_INSTANCING
        vec4 worldPos = modelMatrix * instanceMatrix * vec4(pos, 1.0);
        vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
      #else
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vNormal = normalize(normalMatrix * normal);
      #endif

      vWorldPosition = worldPos.xyz;
      vec4 mvPosition = viewMatrix * worldPos;
      vViewPosition = -mvPosition.xyz;

      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  // Fragment Shader with dorsal/belly counter-shading, species bands, and fresnel scale sheen
  const fishFragmentShader = `
    uniform vec3 uBackColor;
    uniform vec3 uBellyColor;
    uniform vec3 uBandColor;
    uniform float uBandIntensity;
    uniform vec3 uPaleColor;
    uniform float uIsShrimp;
    
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vViewPosition;
    varying float vDistress;
    varying float vLocalY;
    varying float vLocalX;
    varying float vLocalZ;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      vec3 lightDir = normalize(vec3(0.35, 0.85, 0.4));

      // Key light + soft ambient light (tuned bright for clear underwater contrast)
      float NdotL = max(dot(normal, lightDir), 0.0);
      float diff = NdotL * 0.55 + 0.45;

      // Dorsal-ventral countershading (darker back, lighter creamy belly)
      float vertFactor = clamp(vLocalY * 2.6 + 0.52, 0.0, 1.0);
      vec3 baseGrad = mix(uBellyColor, uBackColor, vertFactor);

      // Species subtle vertical lateral bands (e.g. Tilapia tiger bands)
      if (uBandIntensity > 0.01) {
        float bandWave = sin(vLocalX * 18.0) * 0.5 + 0.5;
        float bandMask = smoothstep(0.4, 0.85, bandWave) * smoothstep(-0.25, 0.15, vLocalY);
        baseGrad = mix(baseGrad, uBandColor, bandMask * uBandIntensity);
      }

      // Health state blend: distress / low-DO bleaches fish slightly pale
      float distressBleach = clamp(vDistress * 0.65, 0.0, 0.75);
      vec3 healthyFish = mix(baseGrad, uPaleColor, distressBleach);

      // Scale specular highlight
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 32.0) * 0.42;

      // Fresnel rim highlight for separation against water background
      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.5);
      vec3 rimColor = vec3(0.55, 0.85, 0.95) * fresnel * 0.48;

      vec3 finalColor = healthyFish * diff + spec + rimColor;

      // Shrimp translucency
      float alpha = uIsShrimp > 0.5 ? 0.88 : 1.0;
      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  const pondsFlocks = [];

  // Temporary reusable variables (zero allocation during per-frame update)
  const dummy = new THREE.Object3D();
  const vPos = new THREE.Vector3();
  const vVel = new THREE.Vector3();
  const vTarget = new THREE.Vector3();
  const vForward = new THREE.Vector3();
  const vHeading = new THREE.Vector3();
  const qTarget = new THREE.Quaternion();
  const qCurrent = new THREE.Quaternion();

  ponds.forEach((p) => {
    let count = CONFIG.fish.counts.pond1;
    let geo = geometries.tilapia;
    let backColor = new THREE.Color('#2C5E82');  // Tilapia steel-blue spine
    let bellyColor = new THREE.Color('#D8EDF8'); // Silvery-white belly
    let bandColor = new THREE.Color('#1B3B52');   // Faint vertical bars
    let bandIntensity = 0.22;
    let isShrimp = false;
    let speciesKey = 'tilapia';

    if (p.id === 2) {
      count = CONFIG.fish.counts.pond2;
      geo = geometries.rohu;
      backColor = new THREE.Color('#6E5528');    // Rohu olive-bronze carp spine
      bellyColor = new THREE.Color('#EDE4C8');   // Creamy golden belly
      bandColor = new THREE.Color('#4E3D1C');
      bandIntensity = 0.08;
      speciesKey = 'rohu';
    } else if (p.id === 3) {
      count = CONFIG.fish.counts.pond3;
      geo = geometries.tilapia;
      backColor = new THREE.Color('#245275');
      bellyColor = new THREE.Color('#CBE6F5');
      bandColor = new THREE.Color('#16354D');
      bandIntensity = 0.26;
      speciesKey = 'tilapia';
    } else if (p.id === 4) {
      count = CONFIG.fish.counts.pond4;
      geo = geometries.shrimp;
      backColor = new THREE.Color('#EA685E');    // Coral pinkish carapace
      bellyColor = new THREE.Color('#FED7AA');   // Translucent underside
      bandColor = new THREE.Color('#C24137');
      bandIntensity = 0.15;
      isShrimp = true;
      speciesKey = 'shrimp';
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: fishVertexShader,
      fragmentShader: fishFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBackColor: { value: backColor },
        uBellyColor: { value: bellyColor },
        uBandColor: { value: bandColor },
        uBandIntensity: { value: bandIntensity },
        uPaleColor: { value: new THREE.Color('#CBD5E1') },
        uIsShrimp: { value: isShrimp ? 1.0 : 0.0 }
      },
      transparent: isShrimp
    });

    const instancedMesh = new THREE.InstancedMesh(geo, mat, count);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    // Attributes for phase, distress, size, and speed ratio
    const phases = new Float32Array(count);
    const distressArr = new Float32Array(count);
    const scalesArr = new Float32Array(count);
    const speedRatioArr = new Float32Array(count);

    // Dynamic fish state vectors
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const quats = new Float32Array(count * 4);
    const wanderAngles = new Float32Array(count);
    const burstTimers = new Float32Array(count);

    const sv = p.swimVolume;
    const baseCruisingSpeed = CONFIG.fish.speeds[speciesKey].cruising;

    for (let i = 0; i < count; i++) {
      phases[i] = Math.random() * Math.PI * 2;
      distressArr[i] = 0.0;
      // Species realistic size variation (+/-12%)
      const s = 0.88 + Math.random() * 0.24;
      scalesArr[i] = s;
      speedRatioArr[i] = 1.0;
      wanderAngles[i] = Math.random() * Math.PI * 2;
      burstTimers[i] = Math.random() * 5.0;

      // Spawn safely in the central volume (well away from boundary margins)
      const spawnMargin = 3.5;
      const px = sv.minX + spawnMargin + Math.random() * (sv.maxX - sv.minX - spawnMargin * 2);
      let py;
      if (isShrimp) {
        py = -2.85 - Math.random() * 0.15; // Bottom zone
      } else {
        py = -2.3 + Math.random() * 1.0;    // Mid-depth cruising
      }
      const pz = sv.minZ + spawnMargin + Math.random() * (sv.maxZ - sv.minZ - spawnMargin * 2);

      pos[i * 3 + 0] = px;
      pos[i * 3 + 1] = py;
      pos[i * 3 + 2] = pz;

      // Initial velocity
      const angle = wanderAngles[i];
      const speed = baseCruisingSpeed * (0.85 + Math.random() * 0.3);
      vel[i * 3 + 0] = Math.cos(angle) * speed;
      vel[i * 3 + 1] = 0.0;
      vel[i * 3 + 2] = Math.sin(angle) * speed;

      // Initial quaternion facing velocity
      vHeading.set(vel[i * 3 + 0], 0, vel[i * 3 + 2]).normalize();
      qCurrent.setFromUnitVectors(new THREE.Vector3(1, 0, 0), vHeading);
      quats[i * 4 + 0] = qCurrent.x;
      quats[i * 4 + 1] = qCurrent.y;
      quats[i * 4 + 2] = qCurrent.z;
      quats[i * 4 + 3] = qCurrent.w;
    }

    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    geo.setAttribute('aDistress', new THREE.InstancedBufferAttribute(distressArr, 1));
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scalesArr, 1));
    geo.setAttribute('aSpeedRatio', new THREE.InstancedBufferAttribute(speedRatioArr, 1));

    flockGroup.add(instancedMesh);

    pondsFlocks.push({
      pondId: p.id,
      hero: p.hero,
      isShrimp,
      speciesKey,
      swimVolume: sv,
      count,
      mesh: instancedMesh,
      mat,
      geo,
      pos,
      vel,
      quats,
      scalesArr,
      phases,
      distressArr,
      speedRatioArr,
      wanderAngles,
      burstTimers,
      distressLevel: 0.0,
      targetDistress: 0.0,
      baseSpeed: baseCruisingSpeed,
      aeratorPos: new THREE.Vector3(p.x + 5, CONFIG.farm.waterLevelY, p.z)
    });
  });

  scene.add(flockGroup);

  return {
    group: flockGroup,
    wireframeGroup,
    toggleDebugWireframes: () => {
      debugWireframesVisible = !debugWireframesVisible;
      wireframeGroup.visible = debugWireframesVisible;
      console.log(`[AquaGuard SwimVolume Wireframes]: ${debugWireframesVisible ? 'ON' : 'OFF'} | Total Clamp Events: ${totalClampEvents}`);
      return debugWireframesVisible;
    },
    getClampCount: () => totalClampEvents,
    setDistress: (pondId, distress) => {
      const f = pondsFlocks.find((fl) => fl.pondId === pondId);
      if (!f) return;
      f.targetDistress = distress;
    },
    update: (time, dt) => {
      // Limit dt for simulation stability
      const delta = Math.min(dt, 0.05);

      pondsFlocks.forEach((f) => {
        f.mat.uniforms.uTime.value = time;

        // Smooth 4-6s blend towards target distress level
        f.distressLevel += (f.targetDistress - f.distressLevel) * Math.min(1.0, delta * 0.45);

        for (let i = 0; i < f.count; i++) {
          f.distressArr[i] = f.distressLevel;
        }
        f.geo.attributes.aDistress.needsUpdate = true;

        const sv = f.swimVolume;
        const count = f.count;
        const aerator = f.aeratorPos;
        const isShrimp = f.isShrimp;

        for (let i = 0; i < count; i++) {
          let px = f.pos[i * 3 + 0];
          let py = f.pos[i * 3 + 1];
          let pz = f.pos[i * 3 + 2];

          let vx = f.vel[i * 3 + 0];
          let vy = f.vel[i * 3 + 1];
          let vz = f.vel[i * 3 + 2];

          // ----------------------------------------------------
          // 1. BOIDS STEERING: Separation, Alignment, Cohesion
          // Sample up to 8 neighbors to guarantee high performance
          // ----------------------------------------------------
          let neighborCount = 0;
          let sepX = 0, sepY = 0, sepZ = 0;
          let aliVx = 0, aliVy = 0, aliVz = 0;
          let cohX = 0, cohY = 0, cohZ = 0;

          const stride = Math.max(1, Math.floor(count / 8));
          for (let j = 0; j < count; j += stride) {
            if (i === j) continue;
            const dx = px - f.pos[j * 3 + 0];
            const dy = py - f.pos[j * 3 + 1];
            const dz = pz - f.pos[j * 3 + 2];
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < 16.0 && distSq > 0.0001) {
              const d = Math.sqrt(distSq);

              // Separation (< 1.8m)
              if (d < 1.8) {
                const rep = (1.8 - d) / (d + 0.01);
                sepX += dx * rep;
                sepY += dy * rep * 0.4;
                sepZ += dz * rep;
              }

              // Alignment & Cohesion
              aliVx += f.vel[j * 3 + 0];
              aliVy += f.vel[j * 3 + 1];
              aliVz += f.vel[j * 3 + 2];

              cohX += f.pos[j * 3 + 0];
              cohY += f.pos[j * 3 + 1];
              cohZ += f.pos[j * 3 + 2];

              neighborCount++;
            }
          }

          let ax = 0, ay = 0, az = 0;

          if (neighborCount > 0) {
            // Separation
            ax += sepX * 2.8;
            ay += sepY * 1.5;
            az += sepZ * 2.8;

            // Alignment
            aliVx /= neighborCount;
            aliVy /= neighborCount;
            aliVz /= neighborCount;
            ax += (aliVx - vx) * 1.2;
            ay += (aliVy - vy) * 0.8;
            az += (aliVz - vz) * 1.2;

            // Cohesion (looser for natural schooling)
            cohX = (cohX / neighborCount) - px;
            cohY = (cohY / neighborCount) - py;
            cohZ = (cohZ / neighborCount) - pz;
            ax += cohX * 0.45;
            ay += cohY * 0.30;
            az += cohZ * 0.45;
          }

          // ----------------------------------------------------
          // 2. WANDER NOISE & AERATOR AVOIDANCE
          // ----------------------------------------------------
          f.wanderAngles[i] += (Math.sin(time * 0.8 + i * 2.1) + (Math.random() - 0.5) * 0.6) * delta;
          ax += Math.cos(f.wanderAngles[i]) * 0.7;
          az += Math.sin(f.wanderAngles[i]) * 0.7;

          // Aerator splash avoidance (avoid within 3.8m)
          const adx = px - aerator.x;
          const adz = pz - aerator.z;
          const aDistSq = adx * adx + adz * adz;
          if (aDistSq < 16.0 && aDistSq > 0.01) {
            const ad = Math.sqrt(aDistSq);
            const aForce = ((4.0 - ad) / ad) * 4.5;
            ax += adx * aForce;
            az += adz * aForce;
          }

          // ----------------------------------------------------
          // 3. HEALTH & LOW-DO GASPING BEHAVIOR
          // ----------------------------------------------------
          let desiredY = -2.1; // Default calm mid-depth

          if (isShrimp) {
            // Shrimp crawl near pond floor with short darting bursts
            f.burstTimers[i] -= delta;
            if (f.burstTimers[i] <= 0) {
              f.burstTimers[i] = 3.5 + Math.random() * 4.0;
              // Burst forward
              vx += (Math.random() - 0.5) * 2.0;
              vz += (Math.random() - 0.5) * 2.0;
            }
            desiredY = -2.90 + Math.sin(time * 1.2 + i) * 0.08;
          } else {
            // Fish species DO depth modulation:
            if (f.distressLevel > 0.25) {
              // Rising towards surface for gasping: target depth -0.65m with gentle bobbing
              // Must NEVER break surface (-0.40m); -0.65m center keeps top fin at -0.50m
              const bob = Math.sin(time * 2.4 + f.phases[i]) * 0.045;
              desiredY = CONFIG.fish.gaspingDepth + bob; // -0.65 +/- 0.045 -> stays safely below -0.60
            } else {
              // Healthy calm swimming: mid-depth range -2.6 to -1.4
              desiredY = -2.2 + Math.sin(time * 0.4 + i * 1.3) * 0.55;
            }
          }

          // Vertical depth steering
          const yDiff = desiredY - py;
          ay += yDiff * 3.4;

          // ----------------------------------------------------
          // 4. THREE-LAYER HARD CONTAINMENT (Step 1)
          // Layer A: Soft steering boundary force with normal deceleration
          // ----------------------------------------------------
          const margin = 2.4;
          const yMargin = 0.65;

          // X boundaries
          if (px < sv.minX + margin) {
            const d = Math.max(0.001, px - sv.minX);
            const w = (margin - d) / margin;
            ax += w * w * 8.5 + Math.max(0, -vx) * 7.5;
          } else if (px > sv.maxX - margin) {
            const d = Math.max(0.001, sv.maxX - px);
            const w = (margin - d) / margin;
            ax -= w * w * 8.5 + Math.max(0, vx) * 7.5;
          }

          // Z boundaries
          if (pz < sv.minZ + margin) {
            const d = Math.max(0.001, pz - sv.minZ);
            const w = (margin - d) / margin;
            az += w * w * 8.5 + Math.max(0, -vz) * 7.5;
          } else if (pz > sv.maxZ - margin) {
            const d = Math.max(0.001, sv.maxZ - pz);
            const w = (margin - d) / margin;
            az -= w * w * 8.5 + Math.max(0, vz) * 7.5;
          }

          // Y boundaries (Floor & Water Surface)
          // Repulsion from surface (maxY = -0.75) and floor (minY = -3.10)
          if (py < sv.minY + yMargin) {
            const d = Math.max(0.001, py - sv.minY);
            const w = (yMargin - d) / yMargin;
            ay += w * w * 9.5 + Math.max(0, -vy) * 8.0;
          } else if (py > sv.maxY - yMargin) {
            const d = Math.max(0.001, sv.maxY - py);
            const w = (yMargin - d) / yMargin;
            ay -= w * w * 9.5 + Math.max(0, vy) * 8.0;
          }

          // ----------------------------------------------------
          // Layer B: Turn-Rate Limiting & Acceleration Integration
          // ----------------------------------------------------
          const maxAcc = 14.0;
          const accLen = Math.sqrt(ax * ax + ay * ay + az * az);
          if (accLen > maxAcc) {
            ax = (ax / accLen) * maxAcc;
            ay = (ay / accLen) * maxAcc;
            az = (az / accLen) * maxAcc;
          }

          vx += ax * delta;
          vy += ay * delta;
          vz += az * delta;

          // Target cruising speed based on health
          let speedScale = 1.0;
          if (f.distressLevel > 1.2) {
            speedScale = 0.45; // Lethargic
          } else if (f.distressLevel > 0.35) {
            speedScale = 1.35; // Agitated swimming
          }

          const curHorizSpeed = Math.sqrt(vx * vx + vz * vz);
          const desHorizSpeed = f.baseSpeed * speedScale;

          if (curHorizSpeed > 0.001) {
            // Only re-accelerate toward cruise speed if not actively braking against a boundary
            const nearWall = (px < sv.minX + margin && vx < 0) || (px > sv.maxX - margin && vx > 0) ||
                             (pz < sv.minZ + margin && vz < 0) || (pz > sv.maxZ - margin && vz > 0);
            if (!nearWall) {
              const lerpedSpeed = THREE.MathUtils.lerp(curHorizSpeed, desHorizSpeed, delta * 2.5);
              vx = (vx / curHorizSpeed) * lerpedSpeed;
              vz = (vz / curHorizSpeed) * lerpedSpeed;
            } else {
              // Cap maximum speed when near wall
              const maxAllowed = desHorizSpeed * 1.4;
              if (curHorizSpeed > maxAllowed) {
                vx = (vx / curHorizSpeed) * maxAllowed;
                vz = (vz / curHorizSpeed) * maxAllowed;
              }
            }
          }

          // Pitch limit: vertical velocity constrained to limit pitch to +/-20 degrees (+/- 0.35 rad)
          const maxVertSpeed = desHorizSpeed * Math.tan(0.35); // +/- 20 deg
          vy = THREE.MathUtils.clamp(vy, -maxVertSpeed, maxVertSpeed);

          // Update position
          px += vx * delta;
          py += vy * delta;
          pz += vz * delta;

          // ----------------------------------------------------
          // Layer C: Hard Clamp (Last Resort) + Smooth Velocity Reflection
          // ----------------------------------------------------
          let clamped = false;
          if (px < sv.minX) {
            px = sv.minX;
            vx = Math.abs(vx) * 0.5;
            clamped = true;
          } else if (px > sv.maxX) {
            px = sv.maxX;
            vx = -Math.abs(vx) * 0.5;
            clamped = true;
          }

          if (py < sv.minY) {
            py = sv.minY;
            vy = Math.abs(vy) * 0.5;
            clamped = true;
          } else if (py > sv.maxY) {
            py = sv.maxY;
            vy = -Math.abs(vy) * 0.5;
            clamped = true;
          }

          if (pz < sv.minZ) {
            pz = sv.minZ;
            vz = Math.abs(vz) * 0.5;
            clamped = true;
          } else if (pz > sv.maxZ) {
            pz = sv.maxZ;
            vz = -Math.abs(vz) * 0.5;
            clamped = true;
          }

          if (clamped) {
            totalClampEvents++;
          }

          // Save state back
          f.pos[i * 3 + 0] = px;
          f.pos[i * 3 + 1] = py;
          f.pos[i * 3 + 2] = pz;
          f.vel[i * 3 + 0] = vx;
          f.vel[i * 3 + 1] = vy;
          f.vel[i * 3 + 2] = vz;

          // Update speed ratio attribute for vertex shader wave speed
          const totalSpeed = Math.sqrt(vx * vx + vy * vy + vz * vz);
          f.speedRatioArr[i] = totalSpeed / f.baseSpeed;

          // ----------------------------------------------------
          // 5. SMOOTH ORIENTATION & BANKING
          // ----------------------------------------------------
          dummy.position.set(px, py, pz);
          const s = f.scalesArr[i];
          dummy.scale.set(s, s, s);

          // Forward vector along velocity
          vForward.set(vx, vy, vz).normalize();
          if (vForward.lengthSq() > 0.01) {
            // Target quaternion facing velocity
            qTarget.setFromUnitVectors(new THREE.Vector3(1, 0, 0), vForward);

            // Bank slightly into turns
            // Calculate yaw rate by cross product of current forward and velocity
            qCurrent.set(
              f.quats[i * 4 + 0],
              f.quats[i * 4 + 1],
              f.quats[i * 4 + 2],
              f.quats[i * 4 + 3]
            );

            // Slerp smoothly towards target quaternion
            qCurrent.slerp(qTarget, Math.min(1.0, delta * 4.5));

            // Bank angle proportional to turn rate
            const turnBank = THREE.MathUtils.clamp(-az * 0.08, -0.38, 0.38);
            dummy.quaternion.copy(qCurrent);
            dummy.rotateX(turnBank);

            // Lethargic listing tilt if severe DO depletion
            if (f.distressLevel > 1.2 && (i % 4 === 0)) {
              dummy.rotateZ(0.75); // Listing to one side
            }

            f.quats[i * 4 + 0] = qCurrent.x;
            f.quats[i * 4 + 1] = qCurrent.y;
            f.quats[i * 4 + 2] = qCurrent.z;
            f.quats[i * 4 + 3] = qCurrent.w;
          }

          dummy.updateMatrix();
          f.mesh.setMatrixAt(i, dummy.matrix);
        }

        f.mesh.instanceMatrix.needsUpdate = true;
        f.geo.attributes.aSpeedRatio.needsUpdate = true;
      });
    }
  };
}
