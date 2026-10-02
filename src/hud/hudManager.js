import { CONFIG } from '../config.js';

export class HudManager {
  constructor(onChapterSelect, onPlayPauseToggle) {
    this.onChapterSelect = onChapterSelect;
    this.onPlayPauseToggle = onPlayPauseToggle;

    // Cache DOM Elements
    this.overlay = document.getElementById('hud-overlay');
    this.stars = document.querySelectorAll('#stars-row .star');
    this.dots = {
      1: document.getElementById('dot-1'),
      2: document.getElementById('dot-2'),
      3: document.getElementById('dot-3'),
      4: document.getElementById('dot-4')
    };

    this.missionStepTag = document.getElementById('mission-step-tag');
    this.missionNarrative = document.getElementById('mission-narrative');
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

    this.progressBar = document.getElementById('timeline-progress-bar');
    this.timeDisplay = document.getElementById('time-display');
    this.btnPlayPause = document.getElementById('btn-play-pause');
    this.btnToggleHud = document.getElementById('btn-toggle-hud');
    this.btnFullscreen = document.getElementById('btn-fullscreen');
    this.btnReplay = document.getElementById('btn-replay');

    this.chapterTicksRow = document.getElementById('chapter-ticks-row');
    this.timelineContainer = document.getElementById('timeline-track-container');

    this.hudVisible = true;
    this.initTimelineTicks();
    this.bindEvents();
  }

  initTimelineTicks() {
    this.chapterTicksRow.innerHTML = '';
    CONFIG.timeline.chapters.forEach((ch) => {
      const tick = document.createElement('div');
      tick.className = 'chapter-tick';
      tick.id = `tick-${ch.id}`;
      tick.title = `Step ${ch.id + 1}: ${ch.title}`;

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
    this.btnPlayPause.addEventListener('click', () => {
      if (this.onPlayPauseToggle) this.onPlayPauseToggle();
    });

    // Replay button on end card
    this.btnReplay.addEventListener('click', () => {
      if (this.onChapterSelect) this.onChapterSelect(0);
    });

    // Toggle HUD [H]
    this.btnToggleHud.addEventListener('click', () => {
      this.toggleHud();
    });

    // Fullscreen toggle
    this.btnFullscreen.addEventListener('click', () => {
      const container = document.getElementById('presentation-container');
      if (!document.fullscreenElement) {
        if (container.requestFullscreen) container.requestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    });

    // Timeline Track scrubber click
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

  toggleHud() {
    this.hudVisible = !this.hudVisible;
    if (this.hudVisible) {
      this.overlay.classList.remove('hidden');
    } else {
      this.overlay.classList.add('hidden');
    }
  }

  setPlayPauseState(isPlaying) {
    this.btnPlayPause.textContent = isPlaying ? '❚❚' : '▶';
  }

  setRiskStars(level) {
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
    this.progressBar.style.width = `${progress}%`;

    const curM = Math.floor(currentTime / 60);
    const curS = Math.floor(currentTime % 60);
    const totM = Math.floor(total / 60);
    const totS = Math.floor(total % 60);
    this.timeDisplay.textContent = `${String(curM).padStart(2, '0')}:${String(curS).padStart(2, '0')} / ${String(totM).padStart(2, '0')}:${String(totS).padStart(2, '0')}`;

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

    const hero = sensorSim.getPondData(3);

    // Update Countdown Ring
    if (this.countdownDigits && hero) {
      this.countdownDigits.textContent = `${hero.timeToCritical}m`;
      if (this.predictCurDo) {
        this.predictCurDo.textContent = `${hero.currentDisplayDo || hero.do.toFixed(1)} mg/L`;
      }
      const ringOffset = 339 * (1 - Math.max(0, hero.timeToCritical / 42));
      this.countdownCircle.style.strokeDashoffset = ringOffset;
      if (this.bannerCountdownText) {
        this.bannerCountdownText.textContent = `Est. ${hero.timeToCritical}m to critical`;
      }
    }

    this.updateMinimap(sensorSim);
  }

  setChapterOverlay(chapterId, sensorSim) {
    this.introPanel.classList.remove('active');
    this.criticalBanner.classList.remove('active');
    this.predictPanel.classList.remove('active');
    this.explainPanel.classList.remove('active');
    if (this.phoneOverlay) this.phoneOverlay.classList.remove('active');
    this.simulationPanel.classList.remove('active');
    this.endPanel.classList.remove('active');

    const hero = sensorSim ? sensorSim.getPondData(3) : null;

    switch (chapterId) {
      case 0: // INTRO
        this.introPanel.classList.add('active');
        if (this.missionStepTag) this.missionStepTag.textContent = 'STEP 1 OF 7: OVERVIEW';
        this.missionNarrative.textContent = 'Real-time digital twin monitoring 4 pond ecosystems with 73,000+ continuous observations.';
        this.setRiskStars(1);
        break;

      case 1: // OBSERVE
        if (this.missionStepTag) this.missionStepTag.textContent = 'STEP 2 OF 7: OBSERVE';
        this.missionNarrative.textContent = 'Telemetry buoys transmitting dissolved oxygen, pH, temperature and ammonia via MQTT.';
        this.setRiskStars(2);
        break;

      case 2: // DETECT
        if (this.missionStepTag) this.missionStepTag.textContent = 'STEP 3 OF 7: DETECT';
        this.missionNarrative.textContent = 'Pond 3 dissolved oxygen dropped to 3.2 mg/L, leaving baseline band (5.2 - 7.2 mg/L).';
        this.setRiskStars(3);
        break;

      case 3: // EXPLAIN
        this.explainPanel.classList.add('active');
        if (this.missionStepTag) this.missionStepTag.textContent = 'STEP 4 OF 7: EXPLAIN';
        this.missionNarrative.textContent = 'Diagnostic factors: DO falling 0.4 mg/L/hr, temp +1.8 °C above baseline, pH down to 6.5.';
        this.setRiskStars(3);
        break;

      case 4: // PREDICT
        this.predictPanel.classList.add('active');
        if (this.missionStepTag) this.missionStepTag.textContent = 'STEP 5 OF 7: PREDICT';
        this.missionNarrative.textContent = 'Forecast model predicts Tilapia critical threshold (2.8 mg/L) in 42 minutes if no action taken.';
        this.setRiskStars(4);
        break;

      case 5: // ALERT
        this.criticalBanner.classList.add('active');
        if (this.missionStepTag) this.missionStepTag.textContent = 'STEP 6 OF 7: ALERT';
        this.missionNarrative.textContent = 'Critical threshold breached (2.2 mg/L). Multi-channel dispatch to farmer via chat and automated voice call.';
        this.setRiskStars(4);
        break;

      case 6: // SIMULATE & RECOMMEND
        this.simulationPanel.classList.add('active');
        if (this.missionStepTag) this.missionStepTag.textContent = 'STEP 7 OF 7: SIMULATE & EXECUTE';
        this.missionNarrative.textContent = 'Simulated DO: Do nothing (1.1 mg/L, 85% loss) vs Aeration (5.8 mg/L, 0% loss). Aerator activated.';
        this.setRiskStars(2);
        break;

      case 7: // LEARN
        this.endPanel.classList.add('active');
        if (this.missionStepTag) this.missionStepTag.textContent = 'STEP 8 OF 7: LEARN';
        this.missionNarrative.textContent = 'Pond 3 recovered to 6.6 mg/L. Telemetry fed back to update Bayesian model parameters.';
        this.setRiskStars(1);
        break;
    }
  }
}
