import { CONFIG } from '../config.js';
import { audioService } from './audioService.js';

export class PhoneApp {
  constructor({ container, onFarmerConfirm }) {
    this.container = container;
    this.onFarmerConfirm = onFarmerConfirm;

    this.currentScene = 1; // 1: App, 2: Chat, 3: Voice Call
    this.isVisible = false;
    this.currentLang = 'EN';
    this.hasConfirmed = false;

    this.callTimerInterval = null;
    this.callSeconds = 0;

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.phoneElement = document.createElement('div');
    this.phoneElement.className = 'smartphone-dock';
    this.phoneElement.id = 'smartphone-device';

    this.phoneElement.innerHTML = `
      <div class="smartphone-case">
        <!-- Physical Bezel Elements -->
        <div class="smartphone-speaker"></div>
        <div class="smartphone-camera-hole"></div>

        <!-- Phone Screen -->
        <div class="smartphone-screen" id="phone-screen">
          <!-- Status Bar -->
          <div class="phone-statusbar">
            <span class="phone-clock" id="phone-clock">06:14</span>
            <div class="phone-status-icons">
              <span class="status-net">5G</span>
              <span class="status-wifi">●●●</span>
              <span class="status-battery">98%</span>
            </div>
          </div>

          <!-- Scene 1: AquaGuard Mobile App (Chapters 1 to 4) -->
          <div class="phone-scene scene-app" id="phone-scene-app">
            <div class="app-nav">
              <div class="app-title-group">
                <span class="app-brand-title">AquaGuard Mobile</span>
                <span class="app-farm-title">${CONFIG.phone.farmName}</span>
              </div>
              <button class="lang-toggle-chip" id="btn-lang-toggle" title="Switch Language">
                <span id="lang-current-label">EN</span>
              </button>
            </div>

            <!-- Pond Quick Carousel / Hero Detail -->
            <div class="app-scroll-content">
              <!-- Pond 3 Hero Card Detail -->
              <div class="phone-hero-card" id="phone-p3-card">
                <div class="hero-card-header">
                  <div>
                    <span class="p-card-tag">POND 3 • HERO</span>
                    <strong class="p-card-title">Tilapia (Nile)</strong>
                  </div>
                  <span class="p-card-status chip-warning" id="phone-p3-status">WARNING</span>
                </div>

                <!-- 4 Gauges Row -->
                <div class="phone-gauges-grid">
                  <div class="gauge-item">
                    <span class="g-label">DO (mg/L)</span>
                    <strong class="g-val text-warning" id="phone-gauge-do">3.8</strong>
                    <div class="g-bar-bg"><div class="g-bar-fill fill-warning" id="phone-bar-do" style="width: 55%"></div></div>
                    <span class="g-range">Safe: 5.0 - 7.0</span>
                  </div>
                  <div class="gauge-item">
                    <span class="g-label">pH Level</span>
                    <strong class="g-val" id="phone-gauge-ph">6.7</strong>
                    <div class="g-bar-bg"><div class="g-bar-fill fill-safe" style="width: 70%"></div></div>
                    <span class="g-range">Safe: 6.8 - 8.0</span>
                  </div>
                  <div class="gauge-item">
                    <span class="g-label">Water Temp</span>
                    <strong class="g-val" id="phone-gauge-temp">30.4°C</strong>
                    <div class="g-bar-bg"><div class="g-bar-fill fill-warning" style="width: 82%"></div></div>
                    <span class="g-range">Safe: 26 - 30°C</span>
                  </div>
                  <div class="gauge-item">
                    <span class="g-label">NH3 Ammonia</span>
                    <strong class="g-val" id="phone-gauge-nh3">0.02</strong>
                    <div class="g-bar-bg"><div class="g-bar-fill fill-safe" style="width: 25%"></div></div>
                    <span class="g-range">Safe: &lt;0.05</span>
                  </div>
                </div>

                <!-- Forecast Chart with Dashed Future Line & Tilapia Limit -->
                <div class="phone-forecast-box">
                  <div class="forecast-header">
                    <span>PREDICTIVE TRAJECTORY</span>
                    <span class="text-danger" id="phone-ttc-label">TTC: 42 min</span>
                  </div>
                  <svg class="phone-chart-svg" viewBox="0 0 200 60">
                    <!-- Safe Band -->
                    <rect x="0" y="10" width="200" height="24" fill="rgba(61,220,132,0.08)" />
                    <line x1="0" y1="34" x2="200" y2="34" stroke="#FF3B30" stroke-width="1.2" stroke-dasharray="3,3" />
                    <text x="135" y="32" fill="#FF3B30" font-size="7">Limit: 2.8</text>
                    <!-- Historical Solid Curve -->
                    <path d="M 0 16 L 30 18 L 60 22 L 90 28" fill="none" stroke="#FFB020" stroke-width="2" />
                    <!-- Future Dashed Projection Curve -->
                    <path d="M 90 28 L 125 38 L 160 48 L 195 54" fill="none" stroke="#FF3B30" stroke-width="2" stroke-dasharray="4,3" />
                  </svg>
                </div>
              </div>

              <!-- Other Ponds Summary List -->
              <div class="phone-other-ponds">
                <div class="other-pond-tile">
                  <span>POND 1 (Tilapia)</span>
                  <strong class="text-safe" id="phone-p1-do">6.8 mg/L</strong>
                </div>
                <div class="other-pond-tile">
                  <span>POND 2 (Rohu)</span>
                  <strong class="text-warning" id="phone-p2-do">5.1 mg/L</strong>
                </div>
                <div class="other-pond-tile">
                  <span>POND 4 (Shrimp)</span>
                  <strong class="text-safe" id="phone-p4-do">6.9 mg/L</strong>
                </div>
              </div>
            </div>

            <!-- Bottom App Tab Bar -->
            <div class="app-tab-bar">
              <span class="tab-item active">Ponds</span>
              <span class="tab-item">Alerts</span>
              <span class="tab-item">Simulate</span>
              <span class="tab-item">Actions</span>
            </div>
          </div>

          <!-- Scene 2: WhatsApp-Style Alert Thread (Chapter 5) -->
          <div class="phone-scene scene-chat" id="phone-scene-chat">
            <div class="chat-header">
              <div class="chat-avatar">AG</div>
              <div class="chat-info">
                <strong>AquaGuard Alerts</strong>
                <span>Verified Automated Dispatch</span>
              </div>
            </div>
            <div class="chat-body" id="chat-messages-container">
              <!-- Dynamic Messages populated sequentially -->
            </div>
            <div class="chat-typing-row" id="chat-typing" style="display: none;">
              <span class="typing-indicator">AquaGuard is typing...</span>
            </div>
            <!-- Quick Reply Actions -->
            <div class="chat-quick-replies" id="chat-quick-replies">
              <button class="btn-quick-reply" id="btn-reply-aerator">Aerator ON</button>
              <button class="btn-quick-reply">Need help</button>
              <button class="btn-quick-reply">Ignore</button>
            </div>
          </div>

          <!-- Scene 3: Automated Voice Call (Chapter 5 Escalation) -->
          <div class="phone-scene scene-call" id="phone-scene-call">
            <!-- Incoming Ringing View -->
            <div class="call-incoming" id="call-incoming-view">
              <div class="ringing-rings-box">
                <div class="ring-pulse-ring r1"></div>
                <div class="ring-pulse-ring r2"></div>
                <div class="call-avatar-big">AG</div>
              </div>
              <h3>AquaGuard Voice Alert</h3>
              <p class="text-danger">Pond 3 Critical Hypoxia</p>
              <div class="call-action-buttons">
                <button class="btn-call-decline">✕</button>
                <button class="btn-call-answer" id="btn-call-answer">✔ Answer</button>
              </div>
            </div>

            <!-- Connected In-Call View -->
            <div class="call-connected" id="call-connected-view" style="display: none;">
              <div class="connected-header">
                <h3>AquaGuard Emergency Voice</h3>
                <span class="call-timer" id="call-timer-digits">00:01</span>
              </div>

              <!-- Animated Audio Waveform Bars -->
              <div class="audio-waveform-row">
                <span class="wave-bar w1"></span>
                <span class="wave-bar w2"></span>
                <span class="wave-bar w3"></span>
                <span class="wave-bar w4"></span>
                <span class="wave-bar w5"></span>
                <span class="wave-bar w6"></span>
                <span class="wave-bar w7"></span>
              </div>

              <!-- Synchronized Captions (Telugu + English) -->
              <div class="call-captions-box">
                <div class="caption-telugu" id="caption-telugu">
                  చెరువు 3లో ఆక్సిజన్ స్థాయి పడిపోతోంది. దయచేసి వెంటనే ఏరేటర్‌ను ఆన్ చేయండి. నిర్ధారించడానికి 1 నొక్కండి.
                </div>
                <div class="caption-english" id="caption-english">
                  "Pond 3 oxygen is falling fast. Please switch on the aerator now. Press 1 to confirm."
                </div>
              </div>

              <!-- Keypad Overlay Highlighting '1' -->
              <div class="call-keypad-grid">
                <div class="keypad-key active-key" id="keypad-1">
                  <strong>1</strong>
                  <span>CONFIRM</span>
                </div>
                <div class="keypad-key">2</div>
                <div class="keypad-key">3</div>
                <div class="keypad-key">4</div>
                <div class="keypad-key">5</div>
                <div class="keypad-key">6</div>
              </div>
              <div class="keypad-status-msg" id="keypad-status-msg">
                Press 1 to confirm aerator activation
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.phoneElement);

    // Cache elements
    this.gaugeDo = this.phoneElement.querySelector('#phone-gauge-do');
    this.gaugePh = this.phoneElement.querySelector('#phone-gauge-ph');
    this.gaugeTemp = this.phoneElement.querySelector('#phone-gauge-temp');
    this.gaugeNh3 = this.phoneElement.querySelector('#phone-gauge-nh3');
    this.barDo = this.phoneElement.querySelector('#phone-bar-do');
    this.p3Status = this.phoneElement.querySelector('#phone-p3-status');
    this.ttcLabel = this.phoneElement.querySelector('#phone-ttc-label');

    this.p1Do = this.phoneElement.querySelector('#phone-p1-do');
    this.p2Do = this.phoneElement.querySelector('#phone-p2-do');
    this.p4Do = this.phoneElement.querySelector('#phone-p4-do');

    this.sceneApp = this.phoneElement.querySelector('#phone-scene-app');
    this.sceneChat = this.phoneElement.querySelector('#phone-scene-chat');
    this.sceneCall = this.phoneElement.querySelector('#phone-scene-call');

    this.sceneApp.classList.add('active');

    this.chatContainer = this.phoneElement.querySelector('#chat-messages-container');
    this.chatTyping = this.phoneElement.querySelector('#chat-typing');
    this.btnReplyAerator = this.phoneElement.querySelector('#btn-reply-aerator');

    this.callIncomingView = this.phoneElement.querySelector('#call-incoming-view');
    this.callConnectedView = this.phoneElement.querySelector('#call-connected-view');
    this.callTimerDigits = this.phoneElement.querySelector('#call-timer-digits');
    this.keypad1 = this.phoneElement.querySelector('#keypad-1');
    this.keypadStatusMsg = this.phoneElement.querySelector('#keypad-status-msg');

    this.btnLangToggle = this.phoneElement.querySelector('#btn-lang-toggle');
    this.langLabel = this.phoneElement.querySelector('#lang-current-label');
  }

  bindEvents() {
    // Language toggle chip
    this.btnLangToggle.addEventListener('click', () => {
      const langs = CONFIG.phone.languages;
      const curIdx = langs.indexOf(this.currentLang);
      const nextIdx = (curIdx + 1) % langs.length;
      this.currentLang = langs[nextIdx];
      this.langLabel.textContent = this.currentLang;
      this.updateLanguageLabels();
    });

    // Quick reply click
    this.btnReplyAerator.addEventListener('click', () => {
      this.handleFarmerReply();
    });

    // Call answer button manual override
    const btnAnswer = this.phoneElement.querySelector('#btn-call-answer');
    if (btnAnswer) {
      btnAnswer.addEventListener('click', () => {
        this.answerCall();
      });
    }

    // Keypad 1 click manual override
    if (this.keypad1) {
      this.keypad1.addEventListener('click', () => {
        this.pressKeypad1();
      });
    }
  }

  updateLanguageLabels() {
    const p3Title = this.phoneElement.querySelector('.p-card-title');
    if (!p3Title) return;

    if (this.currentLang === 'తెలుగు') {
      p3Title.textContent = 'తిలాపియా (చేపల చెరువు 3)';
    } else if (this.currentLang === 'हिन्दी') {
      p3Title.textContent = 'तिलापिया (तालाब 3)';
    } else {
      p3Title.textContent = 'Tilapia (Nile)';
    }
  }

  showPhone(show = true) {
    this.isVisible = show;
    if (show) {
      this.phoneElement.classList.add('visible');
    } else {
      this.phoneElement.classList.remove('visible');
    }
  }

  switchScene(sceneNum) {
    this.currentScene = sceneNum;
    this.sceneApp.classList.toggle('active', sceneNum === 1);
    this.sceneChat.classList.toggle('active', sceneNum === 2);
    this.sceneCall.classList.toggle('active', sceneNum === 3);
  }

  // Update real-time sync with sensorSimulator
  updateData(sensorSim, currentTime) {
    const hero = sensorSim.getPondData(3);
    const p1 = sensorSim.getPondData(1);
    const p2 = sensorSim.getPondData(2);
    const p4 = sensorSim.getPondData(4);

    if (hero) {
      const doVal = hero.currentDisplayDo || hero.do.toFixed(1);
      this.gaugeDo.textContent = doVal;
      this.gaugePh.textContent = hero.currentDisplayPh || hero.ph.toFixed(1);
      this.gaugeTemp.textContent = (hero.currentDisplayTemp || hero.temp.toFixed(1)) + '°C';
      this.gaugeNh3.textContent = hero.currentDisplayNh3 || hero.nh3.toFixed(2);

      const doNum = parseFloat(doVal);
      const pct = Math.max(10, Math.min(100, (doNum / 7.0) * 100));
      this.barDo.style.width = `${pct}%`;

      if (hero.risk === 'CRITICAL') {
        this.gaugeDo.className = 'g-val text-danger';
        this.barDo.className = 'g-bar-fill fill-danger';
        this.p3Status.className = 'p-card-status chip-critical';
        this.p3Status.textContent = 'CRITICAL';
      } else if (hero.risk === 'WARNING' || hero.risk === 'HIGH') {
        this.gaugeDo.className = 'g-val text-warning';
        this.barDo.className = 'g-bar-fill fill-warning';
        this.p3Status.className = 'p-card-status chip-warning';
        this.p3Status.textContent = 'WARNING';
      } else {
        this.gaugeDo.className = 'g-val text-safe';
        this.barDo.className = 'g-bar-fill fill-safe';
        this.p3Status.className = 'p-card-status chip-low';
        this.p3Status.textContent = 'SAFE';
      }

      this.ttcLabel.textContent = `TTC: ${hero.timeToCritical} min`;
    }

    if (p1) this.p1Do.textContent = `${p1.currentDisplayDo || p1.do.toFixed(1)} mg/L`;
    if (p2) this.p2Do.textContent = `${p2.currentDisplayDo || p2.do.toFixed(1)} mg/L`;
    if (p4) this.p4Do.textContent = `${p4.currentDisplayDo || p4.do.toFixed(1)} mg/L`;

    // 8-STEP Timeline-driven Scene Progression:
    // Step 5 (54-66s): Scene 1 (AquaGuard Mobile App with 4 panels)
    // Step 6A (66-72s): Scene 2 (WhatsApp-style Online alerts)
    // Step 6B (72-78s): Scene 3 (Voice Call + Offline sync)
    // Step 7 (78-90s): Scene 1 showing farmer action / recovery
    // Step 8-Outro (90+): Hide phone

    if (currentTime >= 54 && currentTime < 66) {
      // Step 5: Farmer-First Mobile App
      if (!this.isVisible) this.showPhone(true);
      if (this.currentScene !== 1) this.switchScene(1);

      // Demonstrate regional language toggle once at 58s
      if (currentTime >= 58 && currentTime < 62 && this.currentLang === 'EN') {
        this.currentLang = 'తెలుగు';
        this.langLabel.textContent = this.currentLang;
        this.updateLanguageLabels();
      } else if (currentTime >= 62 && this.currentLang === 'తెలుగు') {
        this.currentLang = 'EN';
        this.langLabel.textContent = this.currentLang;
        this.updateLanguageLabels();
      }
    } else if (currentTime >= 66 && currentTime < 72) {
      // Step 6A: Online — WhatsApp + App alerts
      if (!this.isVisible) this.showPhone(true);
      if (this.currentScene !== 2) {
        this.switchScene(2);
        this.populateChatSequence();
      }
    } else if (currentTime >= 72 && currentTime < 78) {
      // Step 6B: Voice Call / Offline sync
      if (!this.isVisible) this.showPhone(true);
      if (this.currentScene !== 3) {
        this.switchScene(3);
        this.startVoiceCallSequence();
      }
    } else if (currentTime >= 78 && currentTime < 90) {
      // Step 7-8: Farmer action & tracking — show app with recovery
      if (!this.isVisible) this.showPhone(true);
      if (this.currentScene !== 1) this.switchScene(1);
    } else if (currentTime >= 90) {
      // Outro: hide phone
      if (this.isVisible) this.showPhone(false);
    } else {
      // Before Step 5: phone hidden
      if (this.isVisible) this.showPhone(false);
    }
  }

  // Scene 2: Populate Sequential Chat Messages with Typing Indicator
  populateChatSequence() {
    this.chatContainer.innerHTML = '';
    const msgs = CONFIG.phone.chatMessages;

    this.chatTyping.style.display = 'block';

    msgs.forEach((m, idx) => {
      setTimeout(() => {
        this.chatTyping.style.display = 'none';

        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${m.type === 'telugu' ? 'bubble-telugu' : 'bubble-incoming'}`;
        bubble.innerHTML = `
          <strong class="bubble-title">${m.title}</strong>
          <p class="bubble-text">${m.body}</p>
          <div class="bubble-meta">
            <span>${m.timestamp}</span>
            <span class="double-ticks">✓✓</span>
          </div>
        `;
        this.chatContainer.appendChild(bubble);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;

        if (idx < msgs.length - 1) {
          this.chatTyping.style.display = 'block';
        } else {
          // Auto reply by farmer after 1.8s
          setTimeout(() => {
            this.handleFarmerReply();
          }, 1800);
        }
      }, (idx + 1) * 750);
    });
  }

  handleFarmerReply() {
    if (this.hasReplied) return;
    this.hasReplied = true;

    const replyBubble = document.createElement('div');
    replyBubble.className = 'chat-bubble bubble-outgoing';
    replyBubble.innerHTML = `
      <p class="bubble-text"><strong>Aerator ON</strong></p>
      <div class="bubble-meta">
        <span>06:15</span>
        <span class="double-ticks blue">✓✓</span>
      </div>
    `;
    this.chatContainer.appendChild(replyBubble);

    setTimeout(() => {
      const confirmBubble = document.createElement('div');
      confirmBubble.className = 'chat-bubble bubble-incoming';
      confirmBubble.innerHTML = `
        <p class="bubble-text">Logged. Monitoring Pond 3 telemetry trajectory.</p>
        <div class="bubble-meta"><span>06:15</span><span>✓✓</span></div>
      `;
      this.chatContainer.appendChild(confirmBubble);
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;

      if (this.onFarmerConfirm) this.onFarmerConfirm();
    }, 600);
  }

  // Scene 3: Start Voice Call Sequence
  startVoiceCallSequence() {
    this.callIncomingView.style.display = 'flex';
    this.callConnectedView.style.display = 'none';

    // Play synthetic ringtone
    audioService.playRingTone();

    // Auto-answer after 2.4s
    this.answerTimeout = setTimeout(() => {
      this.answerCall();
    }, 2400);
  }

  answerCall() {
    clearTimeout(this.answerTimeout);
    this.callIncomingView.style.display = 'none';
    this.callConnectedView.style.display = 'flex';

    this.callSeconds = 1;
    this.callTimerDigits.textContent = '00:01';

    clearInterval(this.callTimerInterval);
    this.callTimerInterval = setInterval(() => {
      this.callSeconds++;
      const s = String(this.callSeconds).padStart(2, '0');
      this.callTimerDigits.textContent = `00:${s}`;
    }, 1000);

    // Auto press keypad 1 after 2.5s
    setTimeout(() => {
      this.pressKeypad1();
    }, 2500);
  }

  pressKeypad1() {
    audioService.playKeypadBeep();

    this.keypad1.classList.add('pressed');
    this.keypadStatusMsg.textContent = '✓ Action confirmed. Aerator dispatched.';
    this.keypadStatusMsg.style.color = CONFIG.palette.statusSafe;

    if (this.onFarmerConfirm) this.onFarmerConfirm();

    setTimeout(() => {
      this.keypad1.classList.remove('pressed');
    }, 600);
  }
}
