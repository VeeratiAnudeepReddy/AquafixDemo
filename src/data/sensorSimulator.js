import { CONFIG } from '../config.js';

export class SensorSimulator {
  constructor() {
    this.pondsData = {};

    CONFIG.farm.ponds.forEach((p) => {
      // Historical buffer for sparklines
      const historyLength = 20;
      const initialDo = p.sensors.do;
      const history = [];

      for (let i = 0; i < historyLength; i++) {
        // slight variations
        const noise = (Math.sin(i * 0.5) * 0.15);
        history.push(Math.max(1.0, initialDo + noise));
      }

      this.pondsData[p.id] = {
        id: p.id,
        name: p.name,
        species: p.species,
        hero: !!p.hero,
        do: p.sensors.do,
        ph: p.sensors.ph,
        temp: p.sensors.temp,
        nh3: p.sensors.nh3,
        risk: p.sensors.risk,
        history,
        baselineMin: 5.2,
        baselineMax: 7.2,
        anomaly: false,
        forecastMinutes: 42,
        timeToCritical: 42
      };
    });
  }

  // Update hero scenario based on 8-step timeline progress (0 to 106 seconds)
  updateTimelineState(currentTime) {
    const hero = this.pondsData[3];
    if (!hero) return;

    // 8-STEP TIMELINE MAPPING:
    // 0-6s:   INTRO (DO 4.0, Risk HIGH)
    // 6-18s:  MONITOR (DO 4.0, Risk HIGH, sensors active)
    // 18-30s: ANALYZE (DO drifts 4.0->3.6, anomaly detected)
    // 30-42s: DETECT (DO drops 3.6->2.6, fish gasping, CRITICAL)
    // 42-54s: RECOMMEND (DO stays critical 2.4, checklist shown)
    // 54-66s: MOBILE APP (DO 2.2, phone panels)
    // 66-78s: NOTIFY (DO critical 2.2, alerts dispatched)
    // 78-90s: TAKE ACTION (Aerator ON at 84s, DO 2.2->3.8)
    // 90-100s: TRACK OUTCOME (DO recovers 3.8->6.6)
    // 100-106s: OUTRO

    if (currentTime < 18) {
      // Intro + Monitor: stable high risk
      hero.do = 4.0;
      hero.ph = 6.7;
      hero.temp = 30.2;
      hero.risk = 'HIGH';
      hero.anomaly = false;
      hero.timeToCritical = 42;
    } else if (currentTime < 30) {
      // Analyze: DO drifts down
      const t = (currentTime - 18) / 12;
      hero.do = 4.0 - t * 0.4; // 4.0 -> 3.6
      hero.ph = 6.7 - t * 0.1;
      hero.temp = 30.2 + t * 0.3;
      hero.risk = 'WARNING';
      hero.anomaly = true;
      hero.timeToCritical = Math.round(42 - t * 14);
    } else if (currentTime < 42) {
      // Detect: DO drops fast, fish gasping
      const t = (currentTime - 30) / 12;
      hero.do = 3.6 - t * 1.0; // 3.6 -> 2.6
      hero.ph = 6.6 - t * 0.2;
      hero.temp = 30.5 + t * 0.8;
      hero.risk = 'CRITICAL';
      hero.anomaly = true;
      hero.timeToCritical = Math.round(28 - t * 16);
    } else if (currentTime < 66) {
      // Recommend + Mobile App: stays critical
      const t = (currentTime - 42) / 24;
      hero.do = 2.6 - Math.min(1, t * 1.5) * 0.4; // 2.6 -> 2.2
      hero.ph = 6.4;
      hero.temp = 31.3;
      hero.risk = 'CRITICAL';
      hero.anomaly = true;
      hero.timeToCritical = Math.max(2, Math.round(12 - t * 10));
    } else if (currentTime < 78) {
      // Notify: still critical, alerts going out
      hero.do = 2.2;
      hero.ph = 6.3;
      hero.temp = 31.6;
      hero.risk = 'CRITICAL';
      hero.anomaly = true;
      hero.timeToCritical = 2;
    } else if (currentTime < 90) {
      // Take Action: Aerator activates, DO starts rising
      const t = (currentTime - 78) / 12;
      hero.do = 2.2 + t * 2.0; // 2.2 -> 4.2
      hero.ph = 6.3 + t * 0.4;
      hero.temp = 31.6 - t * 1.5;
      hero.risk = t > 0.5 ? 'WARNING' : 'CRITICAL';
      hero.anomaly = t < 0.5;
      hero.timeToCritical = 0;
    } else if (currentTime < 100) {
      // Track Outcome: full recovery
      const t = (currentTime - 90) / 10;
      hero.do = 4.2 + t * 2.4; // 4.2 -> 6.6
      hero.ph = 6.7 + t * 0.4;
      hero.temp = 30.1 - t * 1.6;
      hero.risk = 'LOW';
      hero.anomaly = false;
      hero.timeToCritical = 0;
    } else {
      // Outro: stable safe
      hero.do = 6.6;
      hero.ph = 7.1;
      hero.temp = 28.5;
      hero.risk = 'LOW';
      hero.anomaly = false;
      hero.timeToCritical = 0;
    }

    // Add tiny live micro-jitter
    Object.values(this.pondsData).forEach((pond) => {
      const jitter = (Math.sin(currentTime * 3.0 + pond.id) * 0.04);
      pond.currentDisplayDo = Math.max(0.5, (pond.do + jitter)).toFixed(1);
      pond.currentDisplayPh = (pond.ph + (Math.cos(currentTime * 2 + pond.id) * 0.02)).toFixed(1);
      pond.currentDisplayTemp = (pond.temp + (Math.sin(currentTime * 1.5 + pond.id) * 0.05)).toFixed(1);
      pond.currentDisplayNh3 = pond.nh3.toFixed(2);

      // Keep history updated
      if (Math.random() < 0.08) {
        pond.history.push(parseFloat(pond.currentDisplayDo));
        if (pond.history.length > 20) pond.history.shift();
      }
    });
  }

  getPondData(id) {
    return this.pondsData[id];
  }

  getAllPonds() {
    return Object.values(this.pondsData);
  }
}
