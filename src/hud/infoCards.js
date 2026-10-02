import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { CONFIG } from '../config.js';

export function createPondInfoCards(scene, buoys, onCardClick) {
  const cards = [];

  CONFIG.farm.ponds.forEach((p) => {
    const buoy = buoys.find((b) => b.pondId === p.id);
    if (!buoy) return;

    const container = document.createElement('div');
    container.className = 'css2d-pond-card';
    container.id = `card-pond-${p.id}`;

    // Enterprise Restrained Card Structure
    container.innerHTML = `
      <div class="css2d-card-header">
        <span class="css2d-pond-name">${p.name}</span>
        <span class="css2d-risk-chip chip-low" id="chip-pond-${p.id}">${p.sensors.risk}</span>
      </div>
      <div class="css2d-metric-grid">
        <div class="metric-item">
          <span class="metric-label">Dissolved Oxygen</span>
          <span class="metric-value"><span id="val-do-${p.id}">${p.sensors.do.toFixed(1)}</span> mg/L</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Acidity</span>
          <span class="metric-value"><span id="val-ph-${p.id}">${p.sensors.ph.toFixed(1)}</span> pH</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Water Temp</span>
          <span class="metric-value"><span id="val-temp-${p.id}">${p.sensors.temp.toFixed(1)}</span> °C</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Ammonia</span>
          <span class="metric-value"><span id="val-nh3-${p.id}">${p.sensors.nh3.toFixed(2)}</span> mg/L</span>
        </div>
      </div>
      <div class="css2d-sparkline-row">
        <svg class="sparkline-svg" id="sparkline-pond-${p.id}" viewBox="0 0 105 20">
          <rect x="0" y="4" width="105" height="9" fill="rgba(148, 163, 184, 0.12)" rx="2" />
          <path id="sparkline-path-${p.id}" d="M 0 10 Q 50 10 105 10" />
        </svg>
        <span class="anomaly-flag" id="flag-pond-${p.id}">ANOMALY</span>
      </div>
      <div class="css2d-footer">
        <span>${p.species}</span>
        <span>Updated 2s ago</span>
      </div>
      <div class="leader-line"></div>
      <div class="leader-dot" id="leader-dot-${p.id}"></div>
    `;

    container.addEventListener('click', () => {
      if (onCardClick) onCardClick(p.id);
    });

    const c2dObject = new CSS2DObject(container);
    // Base position slightly elevated above buoy
    c2dObject.position.set(buoy.basePos.x, buoy.basePos.y + 4.6, buoy.basePos.z);
    scene.add(c2dObject);

    cards.push({
      pondId: p.id,
      hero: !!p.hero,
      object: c2dObject,
      dom: container,
      basePos: new THREE.Vector3(buoy.basePos.x, buoy.basePos.y + 4.6, buoy.basePos.z),
      chip: container.querySelector(`#chip-pond-${p.id}`),
      valDo: container.querySelector(`#val-do-${p.id}`),
      valPh: container.querySelector(`#val-ph-${p.id}`),
      valTemp: container.querySelector(`#val-temp-${p.id}`),
      valNh3: container.querySelector(`#val-nh3-${p.id}`),
      sparklineSvg: container.querySelector(`#sparkline-pond-${p.id}`),
      sparklinePath: container.querySelector(`#sparkline-path-${p.id}`),
      anomalyFlag: container.querySelector(`#flag-pond-${p.id}`),
      leaderDot: container.querySelector(`#leader-dot-${p.id}`)
    });
  });

  return {
    cards,
    updateTelemetry: (sensorSim, camera) => {
      // 1. Update Telemetry readings & sparklines
      cards.forEach((c) => {
        const data = sensorSim.getPondData(c.pondId);
        if (!data) return;

        c.valDo.textContent = data.currentDisplayDo || data.do.toFixed(1);
        c.valPh.textContent = data.currentDisplayPh || data.ph.toFixed(1);
        c.valTemp.textContent = data.currentDisplayTemp || data.temp.toFixed(1);
        c.valNh3.textContent = data.currentDisplayNh3 || data.nh3.toFixed(2);

        const risk = data.risk;
        c.chip.textContent = risk;
        c.chip.className = 'css2d-risk-chip';
        c.sparklineSvg.className.baseVal = 'sparkline-svg';

        if (risk === 'LOW') {
          c.chip.classList.add('chip-low');
          c.leaderDot.style.background = CONFIG.palette.statusSafe;
        } else if (risk === 'MEDIUM' || risk === 'WARNING') {
          c.chip.classList.add('chip-warning');
          c.sparklineSvg.classList.add('warning');
          c.leaderDot.style.background = CONFIG.palette.statusWarning;
        } else if (risk === 'HIGH' || risk === 'CRITICAL') {
          c.chip.classList.add('chip-critical');
          c.sparklineSvg.classList.add('critical');
          c.leaderDot.style.background = CONFIG.palette.statusCritical;
        }

        if (data.anomaly) {
          c.anomalyFlag.classList.add('active');
        } else {
          c.anomalyFlag.classList.remove('active');
        }

        // Generate SVG Sparkline Path
        if (data.history && data.history.length > 2) {
          const pts = data.history;
          const w = 105;
          const h = 20;
          const minVal = 1.0;
          const maxVal = 8.0;

          const step = w / (pts.length - 1);
          let d = `M 0 ${(1 - (pts[0] - minVal) / (maxVal - minVal)) * h}`;

          for (let i = 1; i < pts.length; i++) {
            const x = i * step;
            const y = THREE.MathUtils.clamp((1 - (pts[i] - minVal) / (maxVal - minVal)) * h, 2, h - 2);
            d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
          }
          c.sparklinePath.setAttribute('d', d);
        }
      });

      // 2. Collision avoidance: check 2D distance between cards in screen space and apply subtle Y offset
      if (camera) {
        const screenPositions = cards.map((c) => {
          const v = c.basePos.clone().project(camera);
          return { card: c, sx: v.x, sy: v.y, sz: v.z };
        });

        for (let i = 0; i < screenPositions.length; i++) {
          for (let j = i + 1; j < screenPositions.length; j++) {
            const c1 = screenPositions[i];
            const c2 = screenPositions[j];
            const dx = Math.abs(c1.sx - c2.sx);
            const dy = Math.abs(c1.sy - c2.sy);

            // If cards are overlapping in screen space, offset vertically
            if (dx < 0.18 && dy < 0.22 && c1.sz > 0 && c2.sz > 0) {
              c1.card.object.position.y = c1.card.basePos.y + 0.8;
              c2.card.object.position.y = c2.card.basePos.y - 0.8;
            }
          }
        }
      }
    },
    setVisible: (v) => {
      cards.forEach((c) => {
        c.dom.style.display = v ? 'block' : 'none';
      });
    }
  };
}
