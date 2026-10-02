import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { CONFIG } from '../config.js';

export function setupLighting(scene, renderer) {
  // 1. Directional Sun (Golden-Hour Angle)
  const sunLight = new THREE.DirectionalLight('#FFF5E4', 2.2);
  sunLight.castShadow = true;

  // Compute sun vector from elevation and azimuth
  const phi = THREE.MathUtils.degToRad(90 - CONFIG.sky.elevation);
  const theta = THREE.MathUtils.degToRad(CONFIG.sky.azimuth);
  const sunVector = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  
  sunLight.position.copy(sunVector).multiplyScalar(100);
  scene.add(sunLight);

  // Soft PCF Shadows & bounds
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 1.0;
  sunLight.shadow.camera.far = 300;

  const d = 60;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.025;

  // 2. Soft Hemisphere Light (Sky Peach -> Soil Sand)
  const hemiLight = new THREE.HemisphereLight(
    CONFIG.palette.skyPeach,
    CONFIG.palette.landSand,
    0.85
  );
  scene.add(hemiLight);

  // 3. Three.js Sky Shader
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = CONFIG.sky.turbidity;
  skyUniforms['rayleigh'].value = CONFIG.sky.rayleigh;
  skyUniforms['mieCoefficient'].value = CONFIG.sky.mieCoefficient;
  skyUniforms['mieDirectionalG'].value = CONFIG.sky.mieDirectionalG;
  skyUniforms['sunPosition'].value.copy(sunLight.position);

  // 4. Generate PMREM Environment Map for realistic reflections
  if (renderer) {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    const envSky = new Sky();
    envSky.scale.setScalar(450000);
    const envUniforms = envSky.material.uniforms;
    envUniforms['turbidity'].value = CONFIG.sky.turbidity;
    envUniforms['rayleigh'].value = CONFIG.sky.rayleigh;
    envUniforms['mieCoefficient'].value = CONFIG.sky.mieCoefficient;
    envUniforms['mieDirectionalG'].value = CONFIG.sky.mieDirectionalG;
    envUniforms['sunPosition'].value.copy(sunLight.position);
    envScene.add(envSky);

    const renderTarget = pmremGenerator.fromScene(envScene);
    scene.environment = renderTarget.texture;
    pmremGenerator.dispose();
  }

  // 5. Atmospheric Horizon Fog
  scene.fog = new THREE.Fog(CONFIG.palette.skyPeach, 65, 230);

  return { sunLight, hemiLight, sky, sunVector };
}
