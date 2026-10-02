import { CONFIG } from '../config.js';

/**
 * HUD Manager — PART 3: Clarity System
 * - Persistent step tracker (8 numbered pills)
 * - Caption bar (bottom, centered, max 18 words)
 * - Focus control, callouts, colour language legend
 * - Presenter mode (key P), navigation controls
 */
export class HudManager {
  constructor(onChapterSelect, onPlayPauseToggle) {
    this.onChapterSelect = onChapterSelect;
    this.onPlayPauseToggle = onPlayPauseToggle;
    this.presenterMode = false;

    // Cache DOM Elements
    this.overlay = document.getElementById('hud-overlay');
    this.stars = document.querySelectorAll('#stars-row .star');
    this.dots = {
      1: document.getElementById('dot-1'),
      2: document.getElementById('dot-2'),
      3: document.getElementById('dot-3'),
      4: document.getElementById('dot-4')
    };

    this.stepTracker = document.getElementById('step-tracker');
    this.captionBar = document.getElementById('caption-bar');
    this.captionText = document.getElementById('caption-text');
    this.stepLabel = document.getElementById('step-label');
    this.legendPanel = document.getElementById('color-legend');

    this.criticalBanner = document.getElementById('critical-alert-banner');
    this.bannerCauseText = document.getElementById('banner-cause-text');
    this.bannerCountdownText = document.getElementById('banner-countdown-text');

    this.predictPanel = document.getElementById('predict-countdown-panel');
    this.countdownDigits = document.getElementById('countdown-digits');
    this.countdownCircle = document.getElementById('countdown-circle');
    this.predictCurDo = document.getElementById('predict-cur-do');

    this.explainPanel = document.getElementById('underwater-explain-panel');
    this.phoneOverlay = document.getElementById('phone-alert-overlay');
    this.simulationPanel = document.getElementById('simulation-split-panel');
    this.introPanel = document.getElementById('intro-card-panel');
    this.endPanel = document.getElementById('end-card-panel');
    this.recommendPanel = document.getElementById('recommend-panel');

    this.progressBar = document.getElementById('timeline-progress-bar');
    this.timeDisplay = document.getElementById('time-display');
    this.btnPlayPause = document.getElementById('btn-play-pause');
    this.btnToggleHud = document.getElementById('btn-toggle-hud');
    this.btnFullscreen = document.getElementById('btn-fullscreen');
    this.btnReplay = document.getElementById('btn-replay');

    this.chapterTicksRow = document.getElementById('chapter-ticks-row');
    this.timelineContainer = document.getElementById('timeline-track-container');

    this.hudVisible = true;
    this.initStepTracker();
    this.initTimelineTicks();
    this.bindEvents();
  }

  initStepTracker() {
    if (!this.stepTracker) return;
    this.stepTracker.innerHTML = '';
    // Build 8 step pills (steps 1-8, skipping intro/outro)
    const steps = CONFIG.timeline.chapters.filter(c => c.id >= 1 && c.id <= 8);
    steps.forEach((ch) => {
      const pill = document.createElement('div');
      pill.className = 'step-pill';
      pill.id = `step-pill-${ch.id}`;
      pill.dataset.step = ch.id;
      pill.innerHTML = `
        <span class="pill-number">${ch.id}</span>
        <span class="pill-title">${ch.label}</span>
      `;
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onChapterSelect) this.onChapterSelect(ch.id);
      });
      this.stepTracker.appendChild(pill);
    });
  }

  initTimelineTicks() {
    if (!this.chapterTicksRow) return;
    this.chapterTicksRow.innerHTML = '';
    CONFIG.timeline.chapters.forEach((ch) => {
      const tick = document.createElement('div');
      tick.className = 'chapter-tick';
      tick.id = `tick-${ch.id}`;
      tick.title = `Step ${ch.id}: ${ch.title}`;

      tick.innerHTML = `
        <div class="tick-dot"></div>
        <span class="tick-label">${ch.label}</span>
      `;

      tick.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onChapterSelect) this.onChapterSelect(ch.id);
      });

      this.chapterTicksRow.appendChild(tick);
    });
  }

  bindEvents() {
    // Play/Pause button
    if (this.btnPlayPause) {
      this.btnPlayPause.addEventListener('click', () => {
        if (this.onPlayPauseToggle) this.onPlayPauseToggle();
      });
    }

    // Replay button on end card
    if (this.btnReplay) {
      this.btnReplay.addEventListener('click', () => {
        if (this.onChapterSelect) this.onChapterSelect(0);
      });
    }

    // Toggle HUD [H]
    if (this.btnToggleHud) {
      this.btnToggleHud.addEventListener('click', () => {
        this.toggleHud();
      });
    }

    // Fullscreen toggle
    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', () => {
        const container = document.getElementById('presentation-container');
        if (!document.fullscreenElement) {
          if (container.requestFullscreen) container.requestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
        }
      });
    }

    // Timeline Track scrubber click
    if (this.timelineContainer) {
      this.timelineContainer.addEventListener('click', (e) => {
        const rect = this.timelineContainer.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const targetTime = clickRatio * CONFIG.timeline.totalDuration;

        // Find matching chapter
        const chapter = CONFIG.timeline.chapters.find(
          (c) => targetTime >= c.start && targetTime < c.end
        ) || CONFIG.timeline.chapters[0];

        if (this.onChapterSelect) this.onChapterSelect(chapter.id);
      });
    }
  }

  toggleHud() {
    this.hudVisible = !this.hudVisible;
    if (this.hudVisible) {
      this.overlay.classList.remove('hidden');
    } else {
      this.overlay.classList.add('hidden');
    }
  }

  togglePresenter() {
    this.presenterMode = !this.presenterMode;
    // TODO: Extended captions for presenter mode
  }

  setPlayPauseState(isPlaying) {
    if (this.btnPlayPause) this.btnPlayPause.textContent = isPlaying ? '❚❚' : '▶';
  }

  setRiskStars(level) {
    if (!this.stars) return;
    this.stars.forEach((star, idx) => {
      const starIndex = idx + 1;
      star.className = 'star';
      if (starIndex <= level) {
        if (level >= 4) {
          star.classList.add('critical');
        } else {
          star.classList.add('active');
        }
      }
    });
  }

  updateStepTracker(currentChapterId) {
    if (!this.stepTracker) return;
    const pills = this.stepTracker.querySelectorAll('.step-pill');
    pills.forEach(pill => {
      const stepId = parseInt(pill.dataset.step, 10);
      pill.classList.remove('active', 'completed');
      if (stepId === currentChapterId) {
        pill.classList.add('active');
      } else if (stepId < currentChapterId) {
        pill.classList.add('completed');
      }
    });

    // Update step label
    if (this.stepLabel) {
      if (currentChapterId >= 1 && currentChapterId <= 8) {
        this.stepLabel.textContent = `STEP ${currentChapterId} OF 8`;
      } else if (currentChapterId === 0) {
        this.stepLabel.textContent = 'INTRODUCTION';
      } else {
        this.stepLabel.textContent = 'AQUAGUARD AI';
      }
    }
  }

  updateCaption(chapterId) {
    if (!this.captionText) return;
    const chapter = CONFIG.timeline.chapters.find(c => c.id === chapterId);
    if (chapter && chapter.caption) {
      this.captionText.textContent = chapter.caption;
      if (this.captionBar) this.captionBar.classList.add('visible');
    }
  }

  showLegend(show) {
    if (this.legendPanel) {
      this.legendPanel.classList.toggle('visible', show);
    }
  }

  updateMinimap(sensorSim) {
    CONFIG.farm.ponds.forEach((p) => {
      const data = sensorSim.getPondData(p.id);
      const dot = this.dots[p.id];
      if (!dot || !data) return;

      dot.className = 'pond-dot';
      if (data.risk === 'HIGH' || data.risk === 'CRITICAL') {
        dot.classList.add('critical');
      } else if (data.risk === 'MEDIUM' || data.risk === 'WARNING') {
        dot.style.borderColor = CONFIG.palette.statusWarning;
        dot.style.background = 'rgba(255, 176, 32, 0.18)';
      } else {
        dot.style.borderColor = CONFIG.palette.statusSafe;
        dot.style.background = 'rgba(61, 220, 132, 0.18)';
      }
    });
  }

  updateTimelineUI(currentTime, currentChapterId, sensorSim) {
    const total = CONFIG.timeline.totalDuration;
    const progress = Math.min(100, (currentTime / total) * 100);
    if (this.progressBar) this.progressBar.style.width = `${progress}%`;

    const curM = Math.floor(currentTime / 60);
    const curS = Math.floor(currentTime % 60);
    const totM = Math.floor(total / 60);
    const totS = Math.floor(total % 60);
    if (this.timeDisplay) {
      this.timeDisplay.textContent = `${String(curM).padStart(2, '0')}:${String(curS).padStart(2, '0')} / ${String(totM).padStart(2, '0')}:${String(totS).padStart(2, '0')}`;
    }

    CONFIG.timeline.chapters.forEach((ch) => {
      const tick = document.getElementById(`tick-${ch.id}`);
      if (tick) {
        if (ch.id === currentChapterId) {
          tick.classList.add('active');
        } else {
          tick.classList.remove('active');
        }
      }
    });

    this.updateStepTracker(currentChapterId);

    const hero = sensorSim.getPondData(3);

    // Update Countdown Ring
    if (this.countdownDigits && hero) {
      this.countdownDigits.textContent = `${hero.timeToCritical}m`;
      if (this.predictCurDo) {
        this.predictCurDo.textContent = `${hero.currentDisplayDo || hero.do.toFixed(1)} mg/L`;
      }
      const ringOffset = 339 * (1 - Math.max(0, hero.timeToCritical / 42));
      if (this.countdownCircle) this.countdownCircle.style.strokeDashoffset = ringOffset;
      if (this.bannerCountdownText) {
        this.bannerCountdownText.textContent = `Est. ${hero.timeToCritical}m to critical`;
      }
    }

    this.updateMinimap(sensorSim);
  }

  setChapterOverlay(chapterId, sensorSim) {
    // Hide all overlay panels
    if (this.introPanel) this.introPanel.classList.remove('active');
    if (this.criticalBanner) this.criticalBanner.classList.remove('active');
    if (this.predictPanel) this.predictPanel.classList.remove('active');
    if (this.explainPanel) this.explainPanel.classList.remove('active');
    if (this.phoneOverlay) this.phoneOverlay.classList.remove('active');
    if (this.simulationPanel) this.simulationPanel.classList.remove('active');
    if (this.endPanel) this.endPanel.classList.remove('active');
    if (this.recommendPanel) this.recommendPanel.classList.remove('active');

    // Update caption for current step
    this.updateCaption(chapterId);

    // Show legend during intro and step 3
    this.showLegend(chapterId === 0 || chapterId === 3);

    switch (chapterId) {
      case 0: // INTRO
        if (this.introPanel) this.introPanel.classList.add('active');
        this.setRiskStars(1);
        break;

      case 1: // MONITOR POND CONDITIONS
        this.setRiskStars(2);
        break;

      case 2: // ANALYZE WITH AQUAGUARD AI
        this.setRiskStars(2);
        break;

      case 3: // DETECT ISSUE OR RISK
        if (this.explainPanel) this.explainPanel.classList.add('active');
        this.setRiskStars(3);
        break;

      case 4: // ACTION RECOMMENDATION
        if (this.recommendPanel) this.recommendPanel.classList.add('active');
        this.setRiskStars(4);
        break;

      case 5: // FARMER-FIRST MOBILE APP
        this.setRiskStars(4);
        break;

      case 6: // NOTIFY FARMER
        if (this.criticalBanner) this.criticalBanner.classList.add('active');
        this.setRiskStars(4);
        break;

      case 7: // FARMER TAKES ACTION
        if (this.simulationPanel) this.simulationPanel.classList.add('active');
        this.setRiskStars(2);
        break;

      case 8: // TRACK OUTCOME
        this.setRiskStars(1);
        break;

      case 9: // OUTRO
        if (this.endPanel) this.endPanel.classList.add('active');
        this.setRiskStars(1);
        break;
    }
  }
}
