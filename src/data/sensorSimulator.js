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

  // Update hero scenario based on timeline progress (0 to 75 seconds)
  updateTimelineState(currentTime) {
    const hero = this.pondsData[3];
    if (!hero) return;

    // Time chapters:
    // 0-14s: Normal/Observe (DO 4.0, Risk MEDIUM/HIGH)
    // 14-24s: DETECT (DO drops 4.0 -> 3.2, anomaly flag, marker amber)
    // 24-34s: EXPLAIN (DO drops 3.2 -> 2.6, underwater dive)
    // 34-44s: PREDICT (DO drops 2.6 -> 2.2, critical threshold crossed, risk red)
    // 44-54s: ALERT (DO stays critical 2.2, phone rings, banner)
    // 54-66s: SIMULATE & RECOMMEND (Aerator turns on, DO starts rising 2.2 -> 4.5)
    // 66-75s: LEARN (DO recovers 4.5 -> 6.5, risk LOW / SAFE, marker green)

    if (currentTime < 14) {
      hero.do = 4.0;
      hero.ph = 6.7;
      hero.temp = 30.2;
      hero.risk = 'HIGH';
      hero.anomaly = false;
      hero.timeToCritical = 42;
    } else if (currentTime < 24) {
      // Detect phase: DO drifts down out of baseline
      const t = (currentTime - 14) / 10;
      hero.do = 4.0 - t * 0.8; // 4.0 -> 3.2
      hero.ph = 6.7 - t * 0.2;
      hero.temp = 30.2 + t * 0.6;
      hero.risk = 'WARNING';
      hero.anomaly = true;
      hero.timeToCritical = Math.round(42 - t * 18);
    } else if (currentTime < 34) {
      // Explain phase
      const t = (currentTime - 24) / 10;
      hero.do = 3.2 - t * 0.6; // 3.2 -> 2.6
      hero.ph = 6.5 - t * 0.2;
      hero.temp = 30.8 + t * 0.5;
      hero.risk = 'HIGH';
      hero.anomaly = true;
      hero.timeToCritical = Math.round(24 - t * 12);
    } else if (currentTime < 54) {
      // Predict & Alert phase: Critical
      const t = (currentTime - 34) / 20;
      hero.do = 2.6 - Math.min(1, t * 1.5) * 0.4; // 2.6 -> 2.2
      hero.ph = 6.3;
      hero.temp = 31.6;
      hero.risk = 'CRITICAL';
      hero.anomaly = true;
      hero.timeToCritical = Math.max(2, Math.round(12 - t * 10));
    } else if (currentTime < 66) {
      // Simulate & Intervene phase: Aerator activates!
      const t = (currentTime - 54) / 12;
      hero.do = 2.2 + t * 2.6; // 2.2 -> 4.8
      hero.ph = 6.3 + t * 0.5;
      hero.temp = 31.6 - t * 1.8;
      hero.risk = t > 0.6 ? 'LOW' : 'WARNING';
      hero.anomaly = false;
      hero.timeToCritical = 0;
    } else {
      // Learn phase: Full recovery
      const t = (currentTime - 66) / 9;
      hero.do = 4.8 + t * 1.8; // 4.8 -> 6.6
      hero.ph = 6.8 + t * 0.3; // 7.1
      hero.temp = 29.8 - t * 1.4; // 28.4
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
