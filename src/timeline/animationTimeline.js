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

    // Helper for smooth camera interpolation
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

    // ============================================================
    // INTRO (0-6s) — "The problem": aerial shot of 4 ponds
    // ============================================================
    tl.addLabel('ch-0', 0);
    tl.call(() => {
      this.currentChapterId = 0;
      this.hudManager.setChapterOverlay(0, this.sensorSim);
      this.farmer.setVisible(false);
      this.twinHologram.setStreamsActive(false);
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

    // ============================================================
    // Step 1: MONITOR POND CONDITIONS (6-18s)
    // Buoys light up, sensor icons, callout labels
    // ============================================================
    tl.addLabel('ch-1', 6);
    tl.call(() => {
      this.currentChapterId = 1;
      this.hudManager.setChapterOverlay(1, this.sensorSim);
      this.twinHologram.setStreamsActive(true);
      this.infoCards.setVisible(true);
    }, null, 6);

    tl.add(tweenCamera(cConfig.monitor, 12, 'power2.inOut', 0), 6);

    // ============================================================
    // Step 2: ANALYZE WITH AQUAGUARD AI (18-30s)
    // Data dots from buoys to AI hub
    // ============================================================
    tl.addLabel('ch-2', 18);
    tl.call(() => {
      this.currentChapterId = 2;
      this.hudManager.setChapterOverlay(2, this.sensorSim);
      this.twinHologram.setStreamsActive(true);
    }, null, 18);

    tl.add(tweenCamera(cConfig.analyze, 12, 'power2.inOut', 0), 18);

    // ============================================================
    // Step 3: DETECT ISSUE OR RISK (30-42s)
    // Pond 3 spotlighted, underwater fish gasping, marker red
    // ============================================================
    tl.addLabel('ch-3', 30);
    tl.call(() => {
      this.currentChapterId = 3;
      this.hudManager.setChapterOverlay(3, this.sensorSim);
      this.buoys.setBuoyRisk(3, 'WARNING');
      this.fishFlocks.setDistress(3, 0.75);
    }, null, 30);

    // Aerial approach to Pond 3
    tl.add(tweenCamera(cConfig.detect, 4, 'power2.inOut', 0), 30);

    // Underwater dive at 34s
    tl.to(cam.position, {
      x: -21.0, y: 1.8, z: 32.0,
      duration: 1.6, ease: 'power1.in'
    }, 34);
    tl.to(this.cameraTarget, {
      x: -17.0, y: -0.4, z: 22.0,
      duration: 1.6, ease: 'power1.in',
      onUpdate: () => cam.lookAt(this.cameraTarget)
    }, 34);

    // Surface piercing
    tl.call(() => {
      if (this.pondWater) this.pondWater.setFishRippling(true);
      if (this.underwaterEffects) this.underwaterEffects.setUnderwaterVisibility(0.85);
      this.fishFlocks.setDistress(3, 1.05);
      this.buoys.setBuoyRisk(3, 'CRITICAL');
    }, null, 35.6);

    // Underwater view
    tl.to(cam.position, {
      x: -16.5, y: -1.8, z: 23.5,
      duration: 1.8, ease: 'power2.out'
    }, 35.6);
    tl.to(this.cameraTarget, {
      x: -12.5, y: -1.6, z: 20.5,
      duration: 1.8, ease: 'power2.out',
      onUpdate: () => cam.lookAt(this.cameraTarget)
    }, 35.6);

    // Steady underwater
    tl.to(cam.position, {
      x: -14.8, y: -1.7, z: 21.2,
      duration: 2.0, ease: 'sine.inOut'
    }, 37.4);
    tl.to(this.cameraTarget, {
      x: -11.2, y: -1.5, z: 19.2,
      duration: 2.0, ease: 'sine.inOut',
      onUpdate: () => cam.lookAt(this.cameraTarget)
    }, 37.4);

    // Resurface
    tl.to(cam.position, {
      x: -19.5, y: 1.5, z: 32.5,
      duration: 1.4, ease: 'power1.in'
    }, 39.4);
    tl.to(this.cameraTarget, {
      x: -17.0, y: 0.0, z: 22.0,
      duration: 1.4, ease: 'power1.in',
      onUpdate: () => cam.lookAt(this.cameraTarget)
    }, 39.4);

    tl.call(() => {
      if (this.pondWater) this.pondWater.setFishRippling(false);
      if (this.underwaterEffects) this.underwaterEffects.setUnderwaterVisibility(0.0);
    }, null, 40.4);

    // Rise to aerial
    tl.to(cam.position, {
      x: -24.0, y: 28.0, z: 44.0,
      duration: 1.6, ease: 'power2.out'
    }, 40.4);
    tl.to(this.cameraTarget, {
      x: -17.0, y: 0.0, z: 22.0,
      duration: 1.6, ease: 'power2.out',
      onUpdate: () => cam.lookAt(this.cameraTarget)
    }, 40.4);

    // ============================================================
    // Step 4: ACTION RECOMMENDATION (42-54s)
    // Checklist card with 4 items
    // ============================================================
    tl.addLabel('ch-4', 42);
    tl.call(() => {
      this.currentChapterId = 4;
      this.hudManager.setChapterOverlay(4, this.sensorSim);
      this.buoys.setBuoyRisk(3, 'CRITICAL');
      this.fishFlocks.setDistress(3, 1.4);
    }, null, 42);

    tl.add(tweenCamera(cConfig.recommend, 12, 'power2.inOut', -5.0), 42);

    // ============================================================
    // Step 5: FARMER-FIRST MOBILE APP (54-66s)
    // Phone slides in showing 4 panels
    // ============================================================
    tl.addLabel('ch-5', 54);
    tl.call(() => {
      this.currentChapterId = 5;
      this.hudManager.setChapterOverlay(5, this.sensorSim);
      if (this.phoneApp) this.phoneApp.showPhone(true);
    }, null, 54);

    tl.add(tweenCamera(cConfig.mobileApp, 12, 'power2.inOut', -5.5), 54);

    // ============================================================
    // Step 6: NOTIFY FARMER (66-78s)
    // 6A: Online (66-72s), 6B: Offline (72-78s)
    // ============================================================
    tl.addLabel('ch-6', 66);
    tl.call(() => {
      this.currentChapterId = 6;
      this.hudManager.setChapterOverlay(6, this.sensorSim);
      this.farmer.setVisible(true);
      this.farmer.setProgress(0);
    }, null, 66);

    tl.add(tweenCamera(cConfig.notify, 12, 'power2.inOut', -5.5), 66);

    // ============================================================
    // Step 7: FARMER TAKES ACTION (78-90s)
    // Split screen: farmer taps confirm, walks to aerator, switches on
    // ============================================================
    tl.addLabel('ch-7', 78);
    tl.call(() => {
      this.currentChapterId = 7;
      this.hudManager.setChapterOverlay(7, this.sensorSim);
      this.farmer.setVisible(true);
    }, null, 78);

    tl.add(tweenCamera(cConfig.takeAction, 12, 'power2.inOut', 0), 78);

    // Farmer walking along bund to aerator
    const walkProgressObj = { p: 0 };
    tl.to(walkProgressObj, {
      p: 1,
      duration: 5.5,
      ease: 'power1.inOut',
      onUpdate: () => {
        this.farmer.setProgress(walkProgressObj.p);
      }
    }, 79);

    // Aerator turns on at 84s
    tl.call(() => {
      this.triggerAeratorActivation();
    }, null, 84);

    // ============================================================
    // Step 8: TRACK OUTCOME (90-100s)
    // Pond recovers, oxygen climbs, marker green, feedback loop
    // ============================================================
    tl.addLabel('ch-8', 90);
    tl.call(() => {
      this.currentChapterId = 8;
      this.hudManager.setChapterOverlay(8, this.sensorSim);
      this.buoys.setBuoyRisk(3, 'LOW');
      this.fishFlocks.setDistress(3, 0);
      this.twinHologram.setFeedbackOpacity(1.0);
    }, null, 90);

    tl.add(tweenCamera(cConfig.track, 10, 'power2.inOut', 0), 90);

    // ============================================================
    // OUTRO (100-106s)
    // 8-step strip, AquaGuard AI, Hawkins Crew, then loop
    // ============================================================
    tl.addLabel('ch-9', 100);
    tl.call(() => {
      this.currentChapterId = 9;
      this.hudManager.setChapterOverlay(9, this.sensorSim);
      if (this.phoneApp) this.phoneApp.showPhone(false);
    }, null, 100);

    tl.add(tweenCamera(cConfig.outro, 6, 'power2.inOut', 0), 100);

    // End loop buffer
    tl.to({}, { duration: 0.1 }, 106);
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
