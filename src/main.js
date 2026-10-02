import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { CONFIG } from './config.js';
import { setupLighting } from './scene/lights.js';
import { createEnvironment } from './scene/environment.js';
import { createPondWater } from './water/pondWater.js';
import { createUnderwaterEffects } from './water/underwater.js';
import { createSensorBuoys } from './scene/buoys.js';
import { createAerators } from './scene/aerators.js';
import { createDigitalTwinHologram } from './scene/digitalTwinHologram.js';
import { createFarmer } from './scene/farmer.js';
import { createFishFlocks } from './fish/boids.js';
import { SensorSimulator } from './data/sensorSimulator.js';
import { createPondInfoCards } from './hud/infoCards.js';
import { HudManager } from './hud/hudManager.js';
import { setupPostprocessing } from './postprocessing/composer.js';
import { AnimationTimeline } from './timeline/animationTimeline.js';
import { PhoneApp } from './phone/phoneApp.js';
import { audioService } from './phone/audioService.js';

// Global App Initialization
class AquaGuardApp {
  constructor() {
    this.container = document.getElementById('presentation-container');
    this.canvas = document.getElementById('webgl-canvas');
    this.css2dContainer = document.getElementById('css2d-container');

    this.clock = new THREE.Clock();
    this.falseColorMode = false;
    this.initScene();
    this.initRenderers();
    this.initComponents();
    this.initInteractions();
    this.onWindowResize();

    window.addEventListener('resize', () => this.onWindowResize());

    // URL parameter support (e.g. ?ch=1, ?ch=5) for direct presentation jumps
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('ch')) {
      const ch = parseInt(urlParams.get('ch'), 10);
      setTimeout(() => {
        if (this.timeline) this.timeline.jumpToChapter(ch);
      }, 150);
    }

    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.palette.skyPeach);

    const aspect = 16 / 9;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 500);
    this.camera.position.set(0, 85, 95);
    this.camera.lookAt(0, 0, 0);
  }

  initRenderers() {
    // 1. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // 2. CSS2D Renderer for Floating Info Cards
    this.css2dRenderer = new CSS2DRenderer();
    this.css2dRenderer.domElement.style.position = 'absolute';
    this.css2dRenderer.domElement.style.top = '0';
    this.css2dRenderer.domElement.style.left = '0';
    this.css2dRenderer.domElement.style.pointerEvents = 'none';
    this.css2dContainer.appendChild(this.css2dRenderer.domElement);
  }

  initComponents() {
    // 1. Lighting with Sky shader & PMREM reflections
    this.lights = setupLighting(this.scene, this.renderer);
    this.env = createEnvironment(this.scene);

    // 2. Pond Water & Underwater System
    this.water = createPondWater(this.scene);
    this.underwater = createUnderwaterEffects(this.scene);

    // 3. Sensor Buoys & Aerators
    this.buoys = createSensorBuoys(this.scene);
    this.aerators = createAerators(this.scene);

    // 4. Digital Twin Hologram & Farmer Character
    this.twinHologram = createDigitalTwinHologram(this.scene, this.buoys.buoys);
    this.farmer = createFarmer(this.scene);

    // 5. Fish Flocks with Boids Simulation
    this.fishFlocks = createFishFlocks(this.scene);

    // 6. Live Telemetry Data Simulator
    this.sensorSim = new SensorSimulator();

    // 7. HUD Manager
    this.hudManager = new HudManager(
      (chapterId) => this.timeline.jumpToChapter(chapterId),
      () => this.timeline.togglePlayPause()
    );

    // 8. Floating CSS2D Info Cards above Ponds
    this.infoCards = createPondInfoCards(this.scene, this.buoys.buoys, (pondId) => {
      // Focus on selected pond
      if (pondId === 3) {
        this.timeline.jumpToChapter(3); // Jump to detect phase
      }
    });

    // 9. Smartphone Mockup Overlay Module
    this.phoneApp = new PhoneApp({
      container: this.container,
      onFarmerConfirm: () => {
        if (this.timeline) this.timeline.triggerAeratorActivation();
      }
    });

    // 10. Postprocessing Pipeline
    const rect = this.container.getBoundingClientRect();
    this.postprocessing = setupPostprocessing(
      this.renderer,
      this.scene,
      this.camera,
      rect.width,
      rect.height
    );

    // 11. Master Animation Timeline (GSAP)
    this.timeline = new AnimationTimeline({
      camera: this.camera,
      controls: null,
      scene: this.scene,
      hudManager: this.hudManager,
      infoCards: this.infoCards,
      fishFlocks: this.fishFlocks,
      aerators: this.aerators,
      buoys: this.buoys,
      twinHologram: this.twinHologram,
      farmer: this.farmer,
      sensorSim: this.sensorSim,
      underwaterEffects: this.underwater,
      pondWater: this.water,
      phoneApp: this.phoneApp
    });

    // Performance monitor
    this.fpsCount = 0;
    this.lastFpsCheck = performance.now();

    // Check URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('t')) {
      const seekTime = parseFloat(urlParams.get('t'));
      if (!isNaN(seekTime)) {
        setTimeout(() => {
          this.timeline.masterTimeline.seek(seekTime);
          const ch = CONFIG.timeline.chapters.find(c => seekTime >= c.start && seekTime < c.end) || CONFIG.timeline.chapters[0];
          this.timeline.currentChapterId = ch.id;
          this.hudManager.setChapterOverlay(ch.id, this.sensorSim);
          this.timeline.onTimelineUpdate();
        }, 150);
      }
    } else if (urlParams.has('ch')) {
      const targetCh = parseInt(urlParams.get('ch'), 10);
      if (!isNaN(targetCh)) {
        setTimeout(() => {
          this.timeline.jumpToChapter(targetCh);
          if (urlParams.has('scene') && this.phoneApp) {
            const sc = parseInt(urlParams.get('scene'), 10);
            this.phoneApp.showPhone(true);
            this.phoneApp.switchScene(sc);
            if (sc === 2) this.phoneApp.populateChatSequence();
            if (sc === 3) this.phoneApp.startVoiceCallSequence();
          }
        }, 150);
      }
    }

    if (urlParams.has('debug')) {
      setTimeout(() => {
        if (this.fishFlocks && this.fishFlocks.toggleDebugWireframes) {
          this.fishFlocks.toggleDebugWireframes();
        }
      }, 200);
    }

    if (urlParams.has('focus')) {
      const f = urlParams.get('focus');
      setTimeout(() => {
        if (this.timeline && this.timeline.masterTimeline) {
          this.timeline.masterTimeline.pause();
        }
        this.hudManager.setChapterOverlay(1, this.sensorSim);
        if (f === 'rohu') {
          // Rohu in Pond 2 [x: 17, z: -22] - front lit
          this.camera.position.set(17, -1.5, -30);
          this.camera.lookAt(17, -1.9, -22);
          if (this.timeline.cameraTarget) this.timeline.cameraTarget.set(17, -1.9, -22);
        } else if (f === 'shrimp') {
          // Shrimp in Pond 4 [x: 17, z: 22] - floor perspective front lit
          this.camera.position.set(17, -2.2, 30);
          this.camera.lookAt(17, -2.85, 22);
          if (this.timeline.cameraTarget) this.timeline.cameraTarget.set(17, -2.85, 22);
        } else if (f === 'tilapia') {
          // Tilapia in Pond 3 [x: -17, z: 22]
          this.camera.position.set(-17, -1.5, 30);
          this.camera.lookAt(-17, -1.9, 22);
          if (this.timeline.cameraTarget) this.timeline.cameraTarget.set(-17, -1.9, 22);
        }
      }, 250);
    }
  }

  initInteractions() {
    // PART 3 Keyboard Shortcuts:
    // Space: Play/Pause
    // Left/Right arrows: Previous/Next step
    // 1-8: Jump to step
    // 0: Jump to intro
    // R: Restart
    // H: Toggle HUD
    // F: Fullscreen
    // M: Audio Toggle
    // D: Debug wireframes
    // C: False-color debug view
    // P: Presenter mode
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.timeline.togglePlayPause();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextId = Math.min(9, this.timeline.currentChapterId + 1);
        this.timeline.jumpToChapter(nextId);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevId = Math.max(0, this.timeline.currentChapterId - 1);
        this.timeline.jumpToChapter(prevId);
      } else if (e.key >= '1' && e.key <= '8') {
        const chapterId = parseInt(e.key, 10);
        this.timeline.jumpToChapter(chapterId);
      } else if (e.key === '0') {
        this.timeline.jumpToChapter(0);
      } else if (e.key === 'r' || e.key === 'R') {
        this.timeline.jumpToChapter(0);
        if (!this.timeline.isPlaying) {
          this.timeline.togglePlayPause();
        }
      } else if (e.key === 'h' || e.key === 'H') {
        this.hudManager.toggleHud();
      } else if (e.key === 'm' || e.key === 'M') {
        const isAudioOn = audioService.toggleMute();
        console.log(`[AquaGuard Audio]: ${isAudioOn ? 'Enabled' : 'Muted'}`);
      } else if (e.key === 'd' || e.key === 'D') {
        if (this.fishFlocks && this.fishFlocks.toggleDebugWireframes) {
          this.fishFlocks.toggleDebugWireframes();
        }
      } else if (e.key === 'c' || e.key === 'C') {
        // Toggle false-color debug view
        this.toggleFalseColor();
      } else if (e.key === 'p' || e.key === 'P') {
        // Toggle presenter mode
        this.hudManager.togglePresenter();
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          if (this.container.requestFullscreen) this.container.requestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
        }
      }
    });
  }

  toggleFalseColor() {
    this.falseColorMode = !this.falseColorMode;
    const fcOverlay = document.getElementById('false-color-overlay');
    if (fcOverlay) {
      fcOverlay.classList.toggle('visible', this.falseColorMode);
    }
    console.log(`[AquaGuard] False-color debug view: ${this.falseColorMode ? 'ON' : 'OFF'}`);
  }

  onWindowResize() {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.css2dRenderer.setSize(width, height);

    if (this.postprocessing) {
      this.postprocessing.setSize(width, height);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // FPS Performance Guard
    this.fpsCount++;
    const now = performance.now();
    if (now - this.lastFpsCheck > 2000) {
      const currentFps = (this.fpsCount * 1000) / (now - this.lastFpsCheck);
      if (currentFps < 42 && this.postprocessing) {
        this.postprocessing.setDofEnabled(false);
      }
      this.fpsCount = 0;
      this.lastFpsCheck = now;
    }

    // Gentle handheld camera drift (subtle noise)
    if (this.camera && this.timeline && this.timeline.cameraTarget) {
      const driftX = Math.sin(elapsedTime * 0.8) * 0.08;
      const driftY = Math.cos(elapsedTime * 0.6) * 0.05;
      this.camera.position.x += driftX * dt;
      this.camera.position.y += driftY * dt;
    }

    // 1. Update Environment & Reeds Wind Sway
    if (this.env && this.env.update) {
      this.env.update(elapsedTime);
    }

    // 2. Update Water & Underwater
    this.water.update(elapsedTime, this.camera);
    this.underwater.update(elapsedTime, dt, this.camera);

    // 3. Update Buoys & Aerators
    this.buoys.update(elapsedTime);
    this.aerators.update(elapsedTime, dt);

    // 4. Update Holographic Twin
    this.twinHologram.update(elapsedTime, dt);

    // 5. Update Fish Boids
    this.fishFlocks.update(elapsedTime, dt);

    // 6. Update Postprocessing Time Uniform & Render
    if (this.postprocessing) {
      this.postprocessing.updateTime(elapsedTime);
      this.postprocessing.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    // 7. Render CSS2D Floating Labels
    this.css2dRenderer.render(this.scene, this.camera);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new AquaGuardApp();
});
