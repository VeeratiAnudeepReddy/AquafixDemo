/**
 * AquaGuard AI — Central Configuration
 * All tweakable values (colours, durations, fish counts, sensor readings, dimensions)
 */

export const CONFIG = {
  // Visual Palette — PART 1: strong water/land hue separation
  palette: {
    // Water is the ONLY blue in the scene
    waterShallow: '#38B6F0',
    waterMid: '#1E8FD6',
    waterDeep: '#0B5FA8',
    // Land: warm dry earth, sand, no green near ponds
    landBundTop: '#D8C3A0',
    landBundSide: '#B89B72',
    landGround: '#C9B48A',
    landDirtRoad: '#A98F66',
    // Concrete pond coping
    concreteCoping: '#E6E6E3',
    wetMudLine: '#6B5A3F',
    // Grass & trees — desaturated, sparse
    grassOlive: '#8F9A4F',
    palmFoliage: '#3F6B3A',
    // Buildings
    hutWallCream: '#F5EFE0',
    roofTerracotta: '#A0522D',
    shedWallWhite: '#EDEDED',
    shedRoofDarkGrey: '#4A4A4A',
    // Sky & UI
    skyPeach: '#F6C98B',
    skyBlue: '#7FB7E5',
    uiDarkNavy: '#101826',
    uiPurpleAccent: '#6B46C1',
    statusSafe: '#3DDC84',
    statusWarning: '#FFB020',
    statusCritical: '#FF3B30',
    white: '#FFFFFF',
    textMuted: '#94A3B8'
  },

  // Shared Water Colour Model — clear BLUE, never green
  water: {
    shallow: '#38B6F0',       // Clear blue in shallows
    mid: '#1E8FD6',           // Rich blue mid-depth
    deep: '#0B5FA8',          // Deep saturated blue
    silt: '#8A7B5E',          // Warm earthy pond silt floor
    underwaterFog: '#1479B8', // Clear blue underwater fog
    transparency: 0.80,       // 0.75 - 0.85 transparency
    heroRiskTint: '#7A9AB8',  // Duller blue-grey for hero pond risk (max 12%)
    foamWhite: '#F8FDFF'      // White foam
  },

  // Concrete coping dimensions
  coping: {
    width: 0.35,              // 0.35m wide concrete edge
    mudWidth: 0.15            // 0.15m dark wet-mud line
  },

  // Dimensions & Farm Layout
  farm: {
    pondWidth: 26,
    pondLength: 36,
    pondDepth: 3.5,
    bundWidth: 4.5,
    waterLevelY: -0.4,
    floorY: -3.5,
    gridSpacingX: 34,
    gridSpacingZ: 44,
    // 2x2 Grid Centers with explicit Hard Containment Swim Volumes:
    // Inset 0.6 m from walls; Y between floorY + 0.4 (-3.10) and surfaceY - 0.35 (-0.75)
    ponds: [
      {
        id: 1,
        name: 'POND 1',
        species: 'Tilapia (Nile)',
        color: '#7FB7E5',
        x: -17,
        z: -22,
        sensors: { do: 6.8, ph: 7.4, temp: 28.1, nh3: 0.02, risk: 'LOW' },
        swimVolume: {
          minX: -17 - 12.4, maxX: -17 + 12.4,
          minY: -3.10,      maxY: -0.75,
          minZ: -22 - 17.4, maxZ: -22 + 17.4
        }
      },
      {
        id: 2,
        name: 'POND 2',
        species: 'Rohu (Carp)',
        color: '#D4AF37',
        x: 17,
        z: -22,
        sensors: { do: 5.1, ph: 6.9, temp: 29.4, nh3: 0.15, risk: 'MEDIUM' },
        swimVolume: {
          minX: 17 - 12.4,  maxX: 17 + 12.4,
          minY: -3.10,      maxY: -0.75,
          minZ: -22 - 17.4, maxZ: -22 + 17.4
        }
      },
      {
        id: 3,
        name: 'POND 3',
        species: 'Tilapia (Nile)',
        color: '#1E8FD6',
        x: -17,
        z: 22,
        hero: true,
        // Starting hero readings:
        sensors: { do: 4.0, ph: 6.7, temp: 30.2, nh3: 0.02, risk: 'HIGH' },
        swimVolume: {
          minX: -17 - 12.4, maxX: -17 + 12.4,
          minY: -3.10,      maxY: -0.75,
          minZ: 22 - 17.4,  maxZ: 22 + 17.4
        }
      },
      {
        id: 4,
        name: 'POND 4',
        species: 'Tiger Shrimp',
        color: '#FF8A80',
        x: 17,
        z: 22,
        sensors: { do: 6.9, ph: 7.6, temp: 27.8, nh3: 0.03, risk: 'LOW' },
        swimVolume: {
          minX: 17 - 12.4,  maxX: 17 + 12.4,
          minY: -3.10,      maxY: -0.75, // Floor + 0.4m to Surface - 0.35m per Step 1
          minZ: 22 - 17.4,  maxZ: 22 + 17.4
        }
      }
    ]
  },

  // Fish Configuration & Steering Dynamics
  fish: {
    counts: {
      pond1: 52,
      pond2: 44,
      pond3: 64, // Hero pond
      pond4: 65  // Shrimp
    },
    speeds: {
      tilapia: { cruising: 1.1, max: 2.2, lowDO: 0.65 },
      rohu: { cruising: 0.9, max: 1.8, lowDO: 0.55 },
      shrimp: { cruising: 0.35, burst: 1.6, floorY: -2.95 }
    },
    gaspingDepth: -0.65 // surfaceY (-0.40) - 0.25m = -0.65m target center
  },

  // Species Critical Thresholds (Dissolved Oxygen mg/L)
  thresholds: {
    tilapia: { optimal: 5.0, warning: 3.5, critical: 2.8 },
    rohu: { optimal: 5.5, warning: 4.0, critical: 3.0 },
    shrimp: { optimal: 5.0, warning: 3.8, critical: 2.9 }
  },

  // 8-STEP WORKFLOW TIMELINE (Total ~106 seconds)
  // Matches AquaGuard AI Pond Management Workflow image exactly
  timeline: {
    totalDuration: 106,
    chapters: [
      { id: 0, title: 'INTRO', start: 0, end: 6, label: 'Intro',
        caption: 'Fish farmers lose fish when pond water quality changes suddenly. AquaGuard AI watches the water and warns the farmer early.' },
      { id: 1, title: 'MONITOR POND CONDITIONS', start: 6, end: 18, label: 'Monitor',
        caption: 'Sensors continuously measure oxygen, temperature and pH in every pond.' },
      { id: 2, title: 'ANALYZE WITH AQUAGUARD AI', start: 18, end: 30, label: 'Analyze',
        caption: 'AquaGuard AI studies the data to spot patterns, predict risks and find anything unusual.' },
      { id: 3, title: 'DETECT ISSUE OR RISK', start: 30, end: 42, label: 'Detect',
        caption: 'Problem found in Pond 3: oxygen is dropping fast and the fish are stressed.' },
      { id: 4, title: 'ACTION RECOMMENDATION', start: 42, end: 54, label: 'Recommend',
        caption: 'The AI tells the farmer exactly what to do.' },
      { id: 5, title: 'FARMER-FIRST MOBILE APP', start: 54, end: 66, label: 'Mobile App',
        caption: 'Everything is in one simple app, made for farmers.' },
      { id: 6, title: 'NOTIFY FARMER', start: 66, end: 78, label: 'Notify',
        caption6A: 'If internet is available, the farmer gets WhatsApp, app and voice call alerts.',
        caption6B: 'Even without internet, the app shows saved alerts and syncs later.',
        caption: 'The farmer is notified through multiple channels, online and offline.' },
      { id: 7, title: 'FARMER TAKES ACTION', start: 78, end: 90, label: 'Take Action',
        caption: 'The farmer follows the steps and confirms the action.' },
      { id: 8, title: 'TRACK OUTCOME', start: 90, end: 100, label: 'Track',
        caption: 'The pond recovers, and every result makes the system smarter.' },
      { id: 9, title: 'OUTRO', start: 100, end: 106, label: 'Outro',
        caption: 'AquaGuard AI — Hawkins Crew' }
    ]
  },

  // Camera Waypoints for GSAP Transitions (new 8-step layout)
  camera: {
    intro: {
      position: { x: 0, y: 85, z: 95 },
      target: { x: 0, y: 0, z: 0 },
      fov: 42
    },
    monitor: {
      position: { x: 0, y: 52, z: 62 },
      target: { x: 0, y: 0, z: 0 },
      fov: 45
    },
    analyze: {
      position: { x: 0, y: 42, z: 55 },
      target: { x: 0, y: 8, z: 0 },
      fov: 44
    },
    detect: {
      position: { x: -28, y: 32, z: 46 },
      target: { x: -17, y: 0, z: 22 },
      fov: 40
    },
    underwater: {
      position: { x: -17, y: -1.6, z: 22 },
      target: { x: -13, y: -1.4, z: 20 },
      fov: 55
    },
    recommend: {
      position: { x: -26, y: 38, z: 52 },
      target: { x: -17, y: 0, z: 22 },
      fov: 42
    },
    mobileApp: {
      position: { x: -22, y: 26, z: 42 },
      target: { x: -17, y: 0, z: 22 },
      fov: 38
    },
    notify: {
      position: { x: -22, y: 26, z: 42 },
      target: { x: -17, y: 0, z: 22 },
      fov: 38
    },
    takeAction: {
      position: { x: 0, y: 46, z: 56 },
      target: { x: -17, y: 0, z: 22 },
      fov: 42
    },
    track: {
      position: { x: 0, y: 55, z: 65 },
      target: { x: -17, y: 0, z: 22 },
      fov: 44
    },
    outro: {
      position: { x: 0, y: 65, z: 75 },
      target: { x: 0, y: 4, z: 0 },
      fov: 44
    }
  },

  // Realistic Sky & Sun Elevation parameters
  sky: {
    turbidity: 3.5,
    rayleigh: 2.2,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.82,
    elevation: 4.5, // degrees above horizon (golden hour)
    azimuth: 145, // sun azimuth angle
    exposure: 0.85
  },

  // Audio settings (Web Audio API synthetic tones)
  audio: {
    enabled: false, // Muted by default, toggled with 'M'
    ringFrequency: 440,
    keypadFrequency: 1209
  },

  // Phone App Mockup Configuration
  phone: {
    farmName: 'Godavari Delta Aquafarm #04',
    farmerName: 'Farmer Ramesh',
    languages: ['EN', 'తెలుగు', 'हिन्दी'],
    currentLanguage: 'EN',
    callDurationSeconds: 21,
    chatMessages: [
      {
        id: 1,
        timeSec: 44.5,
        type: 'alert',
        title: 'Pond 3 — Dissolved oxygen falling',
        body: 'Now 3.1 mg/L, down 0.4 per hour. Estimated 42 min to critical for Tilapia.',
        timestamp: '06:14'
      },
      {
        id: 2,
        timeSec: 46.0,
        type: 'info',
        title: 'Why it matters',
        body: 'Low oxygen stresses fish and can cause mortality.',
        timestamp: '06:14'
      },
      {
        id: 3,
        timeSec: 47.5,
        type: 'action',
        title: 'Check now',
        body: 'Aerator status, feeding, water colour.',
        timestamp: '06:15'
      },
      {
        id: 4,
        timeSec: 49.0,
        type: 'telugu',
        title: 'ముఖ్యమైన సమాచారం',
        body: 'చెరువు 3లో ఆక్సిజన్ వేగంగా తగ్గుతోంది. వెంటనే ఏరేటర్ ఆన్ చేయండి.',
        timestamp: '06:15'
      }
    ],
    callTranscript: {
      telugu: 'చెరువు 3లో ఆక్సిజన్ స్థాయి పడిపోతోంది. దయచేసి వెంటనే ఏరేటర్‌ను ఆన్ చేయండి. నిర్ధారించడానికి 1 నొక్కండి.',
      english: 'Pond 3 oxygen is falling fast. It may reach a critical level in about 40 minutes. Please switch on the aerator now. Press 1 to confirm.'
    }
  }
};

