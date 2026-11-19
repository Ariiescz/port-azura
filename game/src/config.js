// Port Azura tuning tables. All distances are metres, all times are seconds.
// Later phases import these names directly, so keep the shapes stable.

// Fixed simulation cadence and the largest frame we will ever integrate.
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

// The city is laid out on a square grid; the playable band stops short of
// the outer map edge so Rico never walks off the grass.
export const WORLD = {
  half: 150,
  beach: 18,
  grid: [-112, -56, 0, 56, 112],
  road: 12,
  sidewalk: 3,
  buildingMin: 7,
  buildingRange: 28,
  buildingWidth: 16,
  textureSize: 64,
  lampHeight: 6,
  palmHeight: 8
};

export const PLAYER = {
  spawn: { x: 6.5, z: -22 },
  radius: 0.45,
  walk: 4.5,
  run: 8,
  bob: 0.06,
  cadence: 10
};

// The cab is the star of the show; every value here is felt directly by
// whoever is driving it, so they are kept in one obvious block.
export const CAR = {
  spawn: { x: 3.3, z: -22 },
  parked: [
    { x: -3.3, z: 25 },
    { x: 59.3, z: -34 },
    { x: -52.7, z: 38 },
    { x: 115.3, z: 85 },
    { x: -108.7, z: -85 },
    { x: 3.3, z: 92 }
  ],
  radius: 2.5,
  acceleration: 10,
  brake: 22,
  drag: 2.2,
  max: 32,
  reverse: 10,
  steering: 1.7,
  steeringFalloff: 0.065,
  enterRange: 4,
  exitSpeed: 1,
  wheelRadius: 0.42,
  colours: ['#e96c57', '#42aab0', '#e9e4d5'],
  taxi: '#ffc342'
};

export const VIEW = {
  titlePosition: [200, 160, 220],
  titleLook: [0, 0, 0],
  fov: 58,
  near: 0.1,
  far: 1200,
  pixelRatio: 1.5,
  follow: 6,
  footDistance: 12,
  carDistance: 15,
  height: 2,
  orbitSensitivity: 0.005,
  pitchMin: -0.2,
  pitchMax: 0.65,
  fogNear: 160,
  fogFar: 650
};

export const PALETTE = {
  sky: '#9bd9ed',
  water: '#239fb6',
  sand: '#e5d1a1',
  grass: '#6e9b58',
  road: '#3a4550',
  sidewalk: '#c4bda9',
  stripe: '#f1ead0',
  buildings: ['#edb49e', '#f0dfba', '#a9d7ce', '#edc976', '#b7cad9'],
  window: '#42657a',
  trunk: '#a77d53',
  leaf: '#388a66',
  lamp: '#344b54',
  skin: '#b77b54',
  shirt: '#ecede0',
  trousers: '#35475b',
  rubber: '#25303c',
  glass: '#47748b',
  shadow: '#233b43',
  sunset: '#efb49a'
};

export const KEYS = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  run: ['ShiftLeft', 'ShiftRight'],
  enter: 'KeyE',
  pause: ['Escape', 'KeyP']
};

export const HUD = {
  cash: 0,
  stars: 5,
  mapSize: 180,
  toastSeconds: 3,
  kmh: 3.6
};

// Step budgets used by the headless screenshot/verification harness.
export const SHOTS = {
  startSteps: 120,
  driveSteps: 105,
  brakeSteps: 90,
  settleSteps: 90
};
