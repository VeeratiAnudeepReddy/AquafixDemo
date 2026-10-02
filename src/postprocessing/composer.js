import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Cinematic Grade + Subtle Aerial Depth of Field + Grain + Vignette Shader
const CinematicPostShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignetteDarkness: { value: 0.82 },
    uVignetteOffset: { value: 1.15 },
    uWarmth: { value: 0.035 },
    uGrainAmount: { value: 0.015 },
    uEnableDof: { value: 1.0 },
    uResolution: { value: new THREE.Vector2(1920, 1080) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignetteDarkness;
    uniform float uVignetteOffset;
    uniform float uWarmth;
    uniform float uGrainAmount;
    uniform float uEnableDof;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float random(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233) + uTime)) * 43758.5453);
    }

    void main() {
      vec4 baseTex = texture2D(tDiffuse, vUv);
      vec3 color = baseTex.rgb;

      // 1. Subtle Aerial Depth-of-Field (Tilt-Shift softening at extremes)
      if (uEnableDof > 0.5) {
        float distFromFocal = abs(vUv.y - 0.55);
        if (distFromFocal > 0.28) {
          float blurAmount = smoothstep(0.28, 0.48, distFromFocal) * 1.5;
          vec2 texel = vec2(1.0) / uResolution;
          vec3 blurColor = baseTex.rgb * 0.4;
          blurColor += texture2D(tDiffuse, vUv + vec2(texel.x, 0.0) * blurAmount).rgb * 0.15;
          blurColor += texture2D(tDiffuse, vUv - vec2(texel.x, 0.0) * blurAmount).rgb * 0.15;
          blurColor += texture2D(tDiffuse, vUv + vec2(0.0, texel.y) * blurAmount).rgb * 0.15;
          blurColor += texture2D(tDiffuse, vUv - vec2(0.0, texel.y) * blurAmount).rgb * 0.15;
          color = mix(color, blurColor, 0.55);
        }
      }

      // 2. Subtle Golden-Hour Color Grade
      color.r += uWarmth;
      color.b -= uWarmth * 0.5;

      // 3. Subtle Film Grain
      float grain = (random(vUv * 750.0) - 0.5) * uGrainAmount;
      color += grain;

      // 4. Smooth Radial Vignette
      vec2 uv = (vUv - vec2(0.5)) * vec2(uVignetteOffset);
      float dist = length(uv);
      float vignette = smoothstep(0.85, 0.28, dist);
      color = mix(color * (1.0 - uVignetteDarkness * 0.4), color, vignette);

      gl_FragColor = vec4(color, baseTex.a);
    }
  `
};

export function setupPostprocessing(renderer, scene, camera, width, height) {
  const composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Very minimal bloom (0.28 strength) for gentle status LEDs and twin core sheen
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.28,
    0.4,
    0.88
  );
  composer.addPass(bloomPass);

  const colorPass = new ShaderPass(CinematicPostShader);
  colorPass.uniforms.uResolution.value.set(width, height);
  composer.addPass(colorPass);

  return {
    composer,
    bloomPass,
    colorPass,
    setSize: (w, h) => {
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
      colorPass.uniforms.uResolution.value.set(w, h);
    },
    setDofEnabled: (enabled) => {
      colorPass.uniforms.uEnableDof.value = enabled ? 1.0 : 0.0;
    },
    updateTime: (t) => {
      colorPass.uniforms.uTime.value = t;
    }
  };
}
