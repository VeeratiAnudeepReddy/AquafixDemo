import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Helper to generate procedural noise texture for realistic PBR roughness
function createNoiseTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const n = Math.floor(180 + Math.random() * 75);
    data[i] = n;
    data[i + 1] = n;
    data[i + 2] = n;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  return texture;
}

// Helper to generate procedural normal map for surface grain
function createNormalTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(120 + Math.random() * 20);     // normal X
    data[i + 1] = Math.floor(120 + Math.random() * 20); // normal Y
    data[i + 2] = 255;                                  // normal Z (up)
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

export function createEnvironment(scene) {
  const envGroup = new THREE.Group();
  envGroup.name = 'Environment';

  const noiseTex = createNoiseTexture();
  const normalTex = createNormalTexture();

  // PBR Standard Materials with procedural roughness and normal grain
  const landMaterial = new THREE.MeshStandardMaterial({
    color: CONFIG.palette.landSand,
    roughness: 0.88,
    metalness: 0.08,
    roughnessMap: noiseTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.35, 0.35)
  });

  const bundMaterial = new THREE.MeshStandardMaterial({
    color: CONFIG.palette.bundSoil,
    roughness: 0.92,
    metalness: 0.05,
    roughnessMap: noiseTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.5, 0.5)
  });

  const wetMudMaterial = new THREE.MeshStandardMaterial({
    color: '#362A1F', // Dark saturated moist silt
    roughness: 0.45,
    metalness: 0.2,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.6, 0.6)
  });

  const grassMaterial = new THREE.MeshStandardMaterial({
    color: CONFIG.palette.grass,
    roughness: 0.78,
    metalness: 0.05,
    roughnessMap: noiseTex
  });

  const concreteMaterial = new THREE.MeshStandardMaterial({
    color: CONFIG.palette.concrete,
    roughness: 0.65,
    metalness: 0.15,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.3, 0.3)
  });

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: '#7C4A28',
    roughness: 0.75,
    metalness: 0.05
  });

  const roofMaterial = new THREE.MeshStandardMaterial({
    color: '#B87333',
    roughness: 0.92,
    metalness: 0.05,
    normalMap: normalTex
  });

  // 1. Gently Noise-Displaced Outer Terrain
  const outerTerrainGeo = new THREE.PlaneGeometry(260, 260, 48, 48);
  outerTerrainGeo.rotateX(-Math.PI / 2);
  
  // Apply organic subtle undulating height variation to vertices outside pond perimeter
  const posAttr = outerTerrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    // Flat near ponds, gently rolling further out
    const distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter > 42) {
      const elevation = (Math.sin(x * 0.06) + Math.cos(z * 0.05)) * 0.65 +
                        (Math.sin(x * 0.15 + z * 0.12)) * 0.3;
      posAttr.setY(i, elevation);
    }
  }
  outerTerrainGeo.computeVertexNormals();

  const outerTerrain = new THREE.Mesh(outerTerrainGeo, grassMaterial);
  outerTerrain.position.y = -0.05;
  outerTerrain.receiveShadow = true;
  envGroup.add(outerTerrain);

  // Dirt road entering farm with subtle ruts
  const roadGeo = new THREE.PlaneGeometry(11, 170, 8, 32);
  roadGeo.rotateX(-Math.PI / 2);
  const roadMat = new THREE.MeshStandardMaterial({
    color: '#C2AC82',
    roughness: 0.95,
    roughnessMap: noiseTex
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.position.set(-42, 0.02, 0);
  road.receiveShadow = true;
  envGroup.add(road);

  // 2. 4 Sunken Pond Basins with Irregular Slopes & Wet-Mud Margins
  const ponds = CONFIG.farm.ponds;
  const pw = CONFIG.farm.pondWidth;
  const pl = CONFIG.farm.pondLength;
  const pd = CONFIG.farm.pondDepth;

  ponds.forEach((p) => {
    const pondGroup = new THREE.Group();
    pondGroup.position.set(p.x, 0, p.z);

    // Pond Basin Floor (Dark rich silt)
    const floorGeo = new THREE.PlaneGeometry(pw - 3, pl - 3);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#1D2A1F',
      roughness: 0.6,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -pd;
    floor.receiveShadow = true;
    pondGroup.add(floor);

    // Irregular sloped banks with wet mud zone near water line
    const createBank = (width, length, rotX, rotZ, posX, posY, posZ) => {
      const bankGeo = new THREE.PlaneGeometry(width, length, 12, 6);
      if (rotX) bankGeo.rotateX(rotX);
      if (rotZ) bankGeo.rotateZ(rotZ);
      
      // Slightly perturb vertices for natural earth irregularity
      const bPos = bankGeo.attributes.position;
      for (let i = 0; i < bPos.count; i++) {
        bPos.setZ(i, bPos.getZ(i) + (Math.random() - 0.5) * 0.12);
      }
      bankGeo.computeVertexNormals();

      const bank = new THREE.Mesh(bankGeo, bundMaterial);
      bank.position.set(posX, posY, posZ);
      bank.receiveShadow = true;
      return bank;
    };

    // North bank (+Z)
    pondGroup.add(createBank(pw, 4.8, -Math.PI / 2 - 0.75, 0, 0, -pd / 2, pl / 2 - 0.5));
    // South bank (-Z)
    pondGroup.add(createBank(pw, 4.8, -Math.PI / 2 + 0.75, 0, 0, -pd / 2, -pl / 2 + 0.5));
    // East bank (+X)
    pondGroup.add(createBank(4.8, pl, -Math.PI / 2, 0.75, pw / 2 - 0.5, -pd / 2, 0));
    // West bank (-X)
    pondGroup.add(createBank(4.8, pl, -Math.PI / 2, -0.75, -pw / 2 + 0.5, -pd / 2, 0));

    // Wet mud shoreline ring right around the water level
    const mudMarginGeo = new THREE.RingGeometry((pw - 2) / 2, (pw + 1.2) / 2, 32);
    mudMarginGeo.rotateX(-Math.PI / 2);
    mudMarginGeo.scale(1.0, 1.0, pl / pw);
    const mudMargin = new THREE.Mesh(mudMarginGeo, wetMudMaterial);
    mudMargin.position.y = CONFIG.farm.waterLevelY - 0.08;
    mudMargin.receiveShadow = true;
    pondGroup.add(mudMargin);

    // Concrete corner posts
    const postGeo = new THREE.CylinderGeometry(0.3, 0.35, 1.2, 8);
    const corners = [
      [-pw / 2, -pl / 2],
      [pw / 2, -pl / 2],
      [-pw / 2, pl / 2],
      [pw / 2, pl / 2]
    ];
    corners.forEach(([cx, cz]) => {
      const post = new THREE.Mesh(postGeo, concreteMaterial);
      post.position.set(cx, 0.6, cz);
      post.castShadow = true;
      post.receiveShadow = true;
      pondGroup.add(post);
    });

    envGroup.add(pondGroup);
  });

  // 3. Central Bund Walkways with Chamfered Edges
  const hBundGeo = new THREE.BoxGeometry(86, 0.42, CONFIG.farm.bundWidth);
  const hBund = new THREE.Mesh(hBundGeo, bundMaterial);
  hBund.position.set(0, 0.12, 0);
  hBund.receiveShadow = true;
  envGroup.add(hBund);

  const vBundGeo = new THREE.BoxGeometry(CONFIG.farm.bundWidth, 0.42, 104);
  const vBund = new THREE.Mesh(vBundGeo, bundMaterial);
  vBund.position.set(0, 0.12, 0);
  vBund.receiveShadow = true;
  envGroup.add(vBund);

  // Central concrete walkway intersection slab
  const junctionGeo = new THREE.BoxGeometry(6.4, 0.45, 6.4);
  const junction = new THREE.Mesh(junctionGeo, concreteMaterial);
  junction.position.set(0, 0.14, 0);
  junction.receiveShadow = true;
  envGroup.add(junction);

  // 4. Farmer's Hut
  const hutGroup = new THREE.Group();
  hutGroup.position.set(-37, 0, 0);

  const hutBase = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.5, 7.2), concreteMaterial);
  hutBase.position.y = 0.25;
  hutBase.receiveShadow = true;
  hutGroup.add(hutBase);

  const hutWalls = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 3.2, 5.6),
    new THREE.MeshStandardMaterial({
      color: '#CCA87B',
      roughness: 0.9,
      roughnessMap: noiseTex
    })
  );
  hutWalls.position.y = 2.1;
  hutWalls.castShadow = true;
  hutWalls.receiveShadow = true;
  hutGroup.add(hutWalls);

  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.2), woodMaterial);
  door.position.set(1.5, 1.6, 2.82);
  hutGroup.add(door);

  const win = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.2, 0.1),
    new THREE.MeshStandardMaterial({ color: '#1B2A38', roughness: 0.2 })
  );
  win.position.set(-1.8, 2.2, 2.82);
  hutGroup.add(win);

  const roofGeo = new THREE.ConeGeometry(6.2, 2.6, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeo, roofMaterial);
  roof.position.y = 4.8;
  roof.scale.set(1.15, 1, 0.95);
  roof.castShadow = true;
  hutGroup.add(roof);

  const porchPostGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6);
  const p1 = new THREE.Mesh(porchPostGeo, woodMaterial);
  p1.position.set(3.8, 1.55, 3.1);
  p1.castShadow = true;
  hutGroup.add(p1);
  const p2 = new THREE.Mesh(porchPostGeo, woodMaterial);
  p2.position.set(-3.8, 1.55, 3.1);
  p2.castShadow = true;
  hutGroup.add(p2);

  envGroup.add(hutGroup);

  // 5. Equipment Shed with Solar Array
  const shedGroup = new THREE.Group();
  shedGroup.position.set(37, 0, 0);

  const shedBase = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.4, 6.2), concreteMaterial);
  shedBase.position.y = 0.2;
  shedGroup.add(shedBase);

  const shedWall = new THREE.Mesh(
    new THREE.BoxGeometry(7, 2.8, 5),
    new THREE.MeshStandardMaterial({
      color: '#9E9E9E',
      roughness: 0.6,
      metalness: 0.2,
      normalMap: normalTex
    })
  );
  shedWall.position.y = 1.8;
  shedWall.castShadow = true;
  shedWall.receiveShadow = true;
  shedGroup.add(shedWall);

  const solarPanelGroup = new THREE.Group();
  solarPanelGroup.position.set(0, 3.4, 0);
  solarPanelGroup.rotation.x = 0.35;

  const solarFrame = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 0.15, 5.2),
    new THREE.MeshStandardMaterial({ color: '#1F2937', roughness: 0.5, metalness: 0.7 })
  );
  solarPanelGroup.add(solarFrame);

  const solarCells = new THREE.Mesh(
    new THREE.PlaneGeometry(7.0, 4.8),
    new THREE.MeshStandardMaterial({
      color: '#0A1C3B',
      roughness: 0.15,
      metalness: 0.8
    })
  );
  solarCells.rotation.x = -Math.PI / 2;
  solarCells.position.y = 0.1;
  solarPanelGroup.add(solarCells);
  solarPanelGroup.castShadow = true;
  shedGroup.add(solarPanelGroup);

  const inverterBox = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 2.0, 0.8),
    new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.4, metalness: 0.3 })
  );
  inverterBox.position.set(-2.2, 1.4, 2.7);
  shedGroup.add(inverterBox);

  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: CONFIG.palette.statusSafe })
  );
  led.position.set(-2.2, 2.0, 3.12);
  shedGroup.add(led);

  envGroup.add(shedGroup);

  // 6. Instanced Palm Trees
  const treePositions = [
    [-34, -36], [-40, -22], [-42, 24], [-35, 38],
    [35, -34], [42, -18], [40, 22], [36, 36],
    [-2, -54], [2, -54], [-2, 54], [2, 54],
    [-44, 4], [44, -4]
  ];

  const palmGroup = new THREE.Group();
  treePositions.forEach(([tx, tz], idx) => {
    const tree = createPalmTree(idx, noiseTex);
    tree.position.set(tx, 0, tz);
    palmGroup.add(tree);
  });
  envGroup.add(palmGroup);

  // 7. Instanced Wind-Swaying Reeds & Grass along Embankments
  const reedsSystem = createWindSwayReeds();
  envGroup.add(reedsSystem.group);

  scene.add(envGroup);

  return {
    group: envGroup,
    update: (time) => {
      reedsSystem.update(time);
    }
  };
}

function createPalmTree(seed, noiseTex) {
  const tree = new THREE.Group();
  const height = 7.2 + (seed % 3) * 1.3;
  const trunkSegments = 8;
  const trunkRadius = 0.45;
  const trunkMat = new THREE.MeshStandardMaterial({
    color: '#6D4C2F',
    roughness: 0.9,
    roughnessMap: noiseTex
  });

  let curY = 0;
  let curX = 0;
  const curveDir = Math.sin(seed * 1.5) * 0.28;

  for (let i = 0; i < trunkSegments; i++) {
    const segH = height / trunkSegments;
    const rTop = trunkRadius * (1 - (i * 0.08));
    const rBot = trunkRadius * (1 - ((i - 1) * 0.08));
    const segGeo = new THREE.CylinderGeometry(rTop, rBot, segH, 7);
    const seg = new THREE.Mesh(segGeo, trunkMat);
    seg.position.set(curX, curY + segH / 2, 0);
    seg.rotation.z = -curveDir * 0.2;
    seg.castShadow = true;
    tree.add(seg);

    curY += segH;
    curX += curveDir;
  }

  const frondMat = new THREE.MeshStandardMaterial({
    color: '#427038',
    roughness: 0.8,
    side: THREE.DoubleSide
  });

  const numFronds = 7;
  for (let f = 0; f < numFronds; f++) {
    const angle = (f / numFronds) * Math.PI * 2;
    const frond = new THREE.Group();
    frond.position.set(curX, curY, 0);
    frond.rotation.y = angle;

    const leafGeo = new THREE.ConeGeometry(0.95, 4.4, 4);
    leafGeo.rotateX(Math.PI / 2.7);
    const leaf = new THREE.Mesh(leafGeo, frondMat);
    leaf.position.set(0, -0.4, 2.1);
    leaf.castShadow = true;
    frond.add(leaf);

    tree.add(frond);
  }

  const nutMat = new THREE.MeshStandardMaterial({ color: '#4E341B', roughness: 0.9 });
  for (let c = 0; c < 3; c++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), nutMat);
    const a = (c * Math.PI * 2) / 3;
    nut.position.set(curX + Math.cos(a) * 0.35, curY - 0.2, Math.sin(a) * 0.35);
    tree.add(nut);
  }

  return tree;
}

// Low-poly instanced reeds with vertex-shader wind sway & color variations
function createWindSwayReeds() {
  const reedsGroup = new THREE.Group();

  const reedGeo = new THREE.CylinderGeometry(0.04, 0.08, 1.9, 5);
  reedGeo.translate(0, 0.95, 0); // origin at root

  const reedVertexShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Wind sway displacement: sway proportional to height (pos.y)
      float wind = sin(uTime * 2.4 + pos.x * 0.4 + pos.z * 0.4) * 0.16 +
                   cos(uTime * 1.6 + pos.z * 0.8) * 0.08;
      pos.x += wind * (pos.y / 1.9);

      #ifdef USE_INSTANCING
        vec4 worldPosition = modelMatrix * instanceMatrix * vec4(pos, 1.0);
      #else
        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
      #endif

      vWorldPos = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const reedFragmentShader = `
    uniform vec3 uColorBottom;
    uniform vec3 uColorTop;
    varying vec2 vUv;

    void main() {
      // Natural vertical gradient from earthy base to sunny green tip
      vec3 col = mix(uColorBottom, uColorTop, vUv.y);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const reedUniforms = {
    uTime: { value: 0 },
    uColorBottom: { value: new THREE.Color('#4E6A34') },
    uColorTop: { value: new THREE.Color('#789D4A') }
  };

  const reedMat = new THREE.ShaderMaterial({
    vertexShader: reedVertexShader,
    fragmentShader: reedFragmentShader,
    uniforms: reedUniforms,
    side: THREE.DoubleSide
  });

  const totalInstances = 4 * 36;
  const instancedReeds = new THREE.InstancedMesh(reedGeo, reedMat, totalInstances);
  instancedReeds.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let idx = 0;

  CONFIG.farm.ponds.forEach((p) => {
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const rx = p.x + Math.cos(angle) * (CONFIG.farm.pondWidth / 2 - 0.4) + (Math.random() - 0.5) * 0.4;
      const rz = p.z + Math.sin(angle) * (CONFIG.farm.pondLength / 2 - 0.4) + (Math.random() - 0.5) * 0.4;

      dummy.position.set(rx, 0.05, rz);
      dummy.scale.set(
        0.8 + Math.random() * 0.4,
        0.75 + Math.random() * 0.5,
        0.8 + Math.random() * 0.4
      );
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.rotation.z = (Math.random() - 0.5) * 0.15;
      dummy.updateMatrix();

      instancedReeds.setMatrixAt(idx++, dummy.matrix);
    }
  });

  instancedReeds.instanceMatrix.needsUpdate = true;
  reedsGroup.add(instancedReeds);

  return {
    group: reedsGroup,
    update: (time) => {
      reedUniforms.uTime.value = time;
    }
  };
}
