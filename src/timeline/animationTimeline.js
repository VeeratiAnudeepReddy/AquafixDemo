import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG } from '../config.js';

export class AnimationTimeline {
  constructor({
    camera,
    controls,
    scene,
    hudManager,
    infoCards,
    fishFlocks,
    aerators,
    buoys,
    twinHologram,
    farmer,
    sensorSim,
    underwaterEffects,
    pondWater,
    phoneApp
  }) {
    this.camera = camera;
    this.controls = controls;
    this.scene = scene;
    this.hudManager = hudManager;
    this.infoCards = infoCards;
    this.fishFlocks = fishFlocks;
    this.aerators = aerators;
    this.buoys = buoys;
    this.twinHologram = twinHologram;
    this.farmer = farmer;
    this.sensorSim = sensorSim;
    this.underwaterEffects = underwaterEffects;
    this.pondWater = pondWater;
    this.phoneApp = phoneApp;

    this.currentTime = 0;
    this.currentChapterId = 0;
    this.isPlaying = true;
    this.cameraTarget = new THREE.Vector3(0, 0, 0);

    this.masterTimeline = gsap.timeline({
      paused: false,
      repeat: -1, // Seamless looping
      onUpdate: () => this.onTimelineUpdate()
    });

    this.buildMasterTimeline();
  }

  buildMasterTimeline() {
    const tl = this.masterTimeline;
    const cam = this.camera;
    const cConfig = CONFIG.camera;

    // Helper for smooth camera interpolation with left target framing when phone is docked
    const tweenCamera = (cfg, duration, ease = 'power2.inOut', targetOffsetX = 0) => {
      const subTl = gsap.timeline();
      subTl.to(cam.position, {
        x: cfg.position.x,
        y: cfg.position.y,
        z: cfg.position.z,
        duration,
        ease
      }, 0);
      subTl.to(this.cameraTarget, {
        x: cfg.target.x + targetOffsetX,
        y: cfg.target.y,
        z: cfg.target.z,
        duration,
        ease,
        onUpdate: () => {
          cam.lookAt(this.cameraTarget);
        }
      }, 0);
      return subTl;
    };

    // ----------------------------------------------------
    // Chapter 0: INTRO (0 - 6s)
    // ----------------------------------------------------
    tl.addLabel('ch-0', 0);
    tl.call(() => {
      this.currentChapterId = 0;
      this.hudManager.setChapterOverlay(0, this.sensorSim);
      this.farmer.setVisible(false);
      this.twinHologram.setStreamsActive(true);
      this.twinHologram.setFeedbackOpacity(0);
      this.fishFlocks.setDistress(3, 0);
      this.buoys.setBuoyRisk(3, 'HIGH');
      this.aerators.setRunning(3, false);
      this.infoCards.setVisible(false);
      if (this.phoneApp) this.phoneApp.showPhone(false);
    }, null, 0);

    cam.position.set(cConfig.intro.position.x, cConfig.intro.position.y, cConfig.intro.position.z);
    this.cameraTarget.set(cConfig.intro.target.x, cConfig.intro.target.y, cConfig.intro.target.z);
    cam.lookAt(this.cameraTarget);

    tl.to(cam.position, {
      y: 65,
      z: 78,
      duration: 6,
      ease: 'power2.inOut'
    }, 0);

    // ----------------------------------------------------
    // Chapter 1: OBSERVE (6 - 14s) - Phone slides in
    // ----------------------------------------------------
    tl.addLabel('ch-1', 6);
    tl.call(() => {
      this.currentChapterId = 1;
      this.hudManager.setChapterOverlay(1, this.sensorSim);
      this.twinHologram.setStreamsActive(true);
      this.infoCards.setVisible(true);
      if (this.phoneApp) this.phoneApp.showPhone(true);
    }, null, 6);

    // Offset camera target left (-5.0) so phone dock doesn't cover farm focus
    tl.add(tweenCamera(cConfig.observe, 8, 'power2.inOut', -5.0), 6);

    // ----------------------------------------------------
    // Chapter 2: DETECT (14 - 24s)
    // ----------------------------------------------------
    tl.addLabel('ch-2', 14);
    tl.call(() => {
      this.currentChapterId = 2;
      this.hudManager.setChapterOverlay(2, this.sensorSim);
      this.buoys.setBuoyRisk(3, 'WARNING');
      this.fishFlocks.setDistress(3, 0.75); // Fish rise to surface
    }, null, 14);

    tl.add(tweenCamera(cConfig.detect, 10, 'power2.inOut', -4.5), 14);

    // ----------------------------------------------------
    // Chapter 3: EXPLAIN (24 - 34s) - Underwater Diagnostic Dive
    // Smooth continuous aerial -> underwater -> aerial flow (3-4s transitions, no cuts)
    // ----------------------------------------------------
    tl.addLabel('ch-3', 24);
    tl.call(() => {
      this.currentChapterId = 3;
      this.hudManager.setChapterOverlay(3, this.sensorSim);
      this.fishFlocks.setDistress(3, 1.05); // Gasping fish rising near surface
    }, null, 24);

    // Stage 1: Aerial descent toward water surface (24.0s - 25.6s, 1.6s)
    tl.to(cam.position, {
      x: -21.0,
      y: 1.8,
      z: 32.0,
      duration: 1.6,
      ease: 'power1.in'
    }, 24.0);
    tl.to(this.cameraTarget, {
      x: -17.0,
      y: -0.4,
      z: 22.0,
      duration: 1.6,
      ease: 'power1.in',
      onUpdate: () => cam.lookAt(this.cameraTarget)
    }, 24.0);

    // Surface Piercing Moment: trigger splash ripple and fade fog (25.6s)
    tl.call(() => {
      if (this.pondWater) this.pondWater.setFishRippling(true);
      if (this.underwaterEffects) this.underwaterEffects.setUnderwaterVisibility(0.85);
    }, null, 25.6);

    // Stage 2: Passing through surface into underwater viewing position (25.6s - 27.4s, 1.8s)
    tl.to(cam.position, {
      x: -16.5,
      y: -1.8,
      z: 23.5,
      duration: 1.8,
      ease: 'power2.out'
    }, 25.6);
    tl.to(this.cameraTarget, {
      x: -12.5,
      y: -1.6,
      z: 20.5,
      duration: 1.8,
      ease: 'power2.out',
      onUpdate: () => cam.lookAt(this.cameraTarget)
    }, 25.6);

    // Stage 3: Steady underwater exploration (27.4s - 31.0s, 3.6s)
    // Clear view of fish schooling, caustics, and illuminated ceiling (clearance > 1.7m above floor)
    tl.to(cam.position, {
      x: -14.8,
      y: -1.7,
      z: 21.2,
      duration: 3.6,
      ease: 'sine.inOut'
    }, 27.4);
    tl.to(this.cameraTarget, {
      x: -11.2,
      y: -1.5,
      z: 19.2,
      duration: 3.6,
      ease: 'sine.inOut',
      onUpdate: () => cam.lookAt(this.cameraTarget)
    }, 27.4);

    // Stage 4: Resurfacing ascent toward water surface (31.0s - 32.6s, 1.6s)
    tl.to(cam.position, {
      x: -19.5,
      y: 1.5,
      z: 32.5,
      duration: 1.6,
      ease: 'power1.in'
    }, 31.0);
    tl.to(this.cameraTarget, {
      x: -17.0,
      y: 0.0,
      z: 22.0,
      duration: 1.6,
      ease: 'power1.in',
      onUpdate: () => cam.lookAt(this.cameraTarget)
    }, 31.0);

    // Surface Piercing Moment on Exit (32.2s): restore fog & ripples
    tl.call(() => {
      if (this.pondWater) this.pondWater.setFishRippling(false);
      if (this.underwaterEffects) this.underwaterEffects.setUnderwaterVisibility(0.0);
    }, null, 32.2);

    // Stage 5: Rise smoothly into aerial predictive stance before Chapter 4 (32.6s - 34.0s, 1.4s)
    tl.to(cam.position, {
      x: -24.0,
      y: 28.0,
      z: 44.0,
      duration: 1.4,
      ease: 'power2.out'
    }, 32.6);
    tl.to(this.cameraTarget, {
      x: -17.0 - 5.0, // Left offset for phone dock
      y: 0.0,
      z: 22.0,
      duration: 1.4,
      ease: 'power2.out',
      onUpdate: () => cam.lookAt(this.cameraTarget)
    }, 32.6);

    // ----------------------------------------------------
    // Chapter 4: PREDICT (34 - 44s)
    // ----------------------------------------------------
    tl.addLabel('ch-4', 34);
    tl.call(() => {
      this.currentChapterId = 4;
      this.hudManager.setChapterOverlay(4, this.sensorSim);
      this.buoys.setBuoyRisk(3, 'CRITICAL');
      this.fishFlocks.setDistress(3, 1.4); // Lethargy
    }, null, 34);

    tl.add(tweenCamera(cConfig.predict, 10, 'power2.inOut', -5.0), 34);

    // ----------------------------------------------------
    // Chapter 5: ALERT (44 - 54s) - WhatsApp Chat & Voice Call
    // ----------------------------------------------------
    tl.addLabel('ch-5', 44);
    tl.call(() => {
      this.currentChapterId = 5;
      this.hudManager.setChapterOverlay(5, this.sensorSim);
      this.buoys.setBuoyRisk(3, 'CRITICAL');
      this.farmer.setVisible(true);
      this.farmer.setProgress(0);
    }, null, 44);

    tl.add(tweenCamera(cConfig.alert, 10, 'power2.inOut', -5.5), 44);

    // ----------------------------------------------------
    // Chapter 6: SIMULATE & RECOMMEND (54 - 66s)
    // ----------------------------------------------------
    tl.addLabel('ch-6', 54);
    tl.call(() => {
      this.currentChapterId = 6;
      this.hudManager.setChapterOverlay(6, this.sensorSim);
      this.farmer.setVisible(true);
    }, null, 54);

    tl.add(tweenCamera(cConfig.simulate, 12, 'power2.inOut', 0), 54);

    // Farmer walking along bund to aerator
    const walkProgressObj = { p: 0 };
    tl.to(walkProgressObj, {
      p: 1,
      duration: 5.5,
      ease: 'power1.inOut',
      onUpdate: () => {
        this.farmer.setProgress(walkProgressObj.p);
      }
    }, 55);

    // Aerator turns on at 60s
    tl.call(() => {
      this.triggerAeratorActivation();
    }, null, 60);

    // ----------------------------------------------------
    // Chapter 7: LEARN & FEEDBACK LOOP (66 - 75s)
    // ----------------------------------------------------
    tl.addLabel('ch-7', 66);
    tl.call(() => {
      this.currentChapterId = 7;
      this.hudManager.setChapterOverlay(7, this.sensorSim);
      this.buoys.setBuoyRisk(3, 'LOW');
      this.fishFlocks.setDistress(3, 0); // Calming recovery
      this.twinHologram.setFeedbackOpacity(1.0);
      if (this.phoneApp) this.phoneApp.showPhone(false);
    }, null, 66);

    tl.add(tweenCamera(cConfig.learn, 9, 'power2.inOut', 0), 66);

    // End loop buffer
    tl.to({}, { duration: 0.1 }, 75);
  }

  triggerAeratorActivation() {
    this.aerators.setRunning(3, true);
    const box3 = document.getElementById('check-box-3');
    const item3 = document.getElementById('check-3');
    if (box3 && item3) {
      box3.textContent = '✔';
      item3.classList.add('checked');
    }
  }

  onTimelineUpdate() {
    this.currentTime = this.masterTimeline.time();
    this.sensorSim.updateTimelineState(this.currentTime);
    this.infoCards.updateTelemetry(this.sensorSim, this.camera);
    this.hudManager.updateTimelineUI(
      this.currentTime,
      this.currentChapterId,
      this.sensorSim
    );

    if (this.phoneApp) {
      this.phoneApp.updateData(this.sensorSim, this.currentTime);
    }
  }

  jumpToChapter(chapterId) {
    const chapter = CONFIG.timeline.chapters.find((c) => c.id === chapterId);
    if (!chapter) return;

    this.currentChapterId = chapterId;
    this.masterTimeline.seek(chapter.start);
    this.hudManager.setChapterOverlay(chapterId, this.sensorSim);
  }

  togglePlayPause() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      this.masterTimeline.play();
    } else {
      this.masterTimeline.pause();
    }
    this.hudManager.setPlayPauseState(this.isPlaying);
  }
}
