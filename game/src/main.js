import { STEP, MAX_FRAME, VIEW, KEYS, PLAYER, CAR, HUD } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createRenderer, lookCamera } from './render.js';
import { buildCity } from './city.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createHUD } from './hud.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createWanted } from './wanted.js';
import { createMissions, FARES } from './missions.js';
import { initAudio, playSiren, playPickup, toggleMute, playEngine, playFootstep, playEnter } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? 1);
const shot = params.get('shot');

const random = createRandom(Number.isFinite(seed) ? seed : 1);
const renderer = createRenderer();
const layout = buildCity(renderer.scene, random);
const player = createPlayer(renderer.scene, layout);
const vehicles = createVehicles(renderer.scene, layout);
const traffic = createTraffic(renderer.scene, layout, random);
const pedestrians = createPedestrians(renderer.scene, random);
const police = createPolice(renderer.scene, random);
const wanted = createWanted();
const missions = createMissions(renderer.scene);
const input = createInput(renderer.renderer.domElement);
const hud = createHUD();

const SAVE_KEY = 'port-azura.save.v1';
const id = name => document.getElementById(name);

function initialMission() {
  return {
    active: true,
    fares: 0,
    job: 1,
    phase: 'pickup',
    started: false,
    getaway: false,
    timer: 90,
    distance: 0,
    target: { x: 6.5, z: -22 }
  };
}

let state = 'title';
let orbit = 0;
let pitch = 0.08;
let accumulator = 0;
let driftTime = 0;
let driftActive = false;
let punchDown = false;
let sirenOn = false;
let soundTime = 0;
let nearMissCooldown = new WeakMap();
let lastActive = null;
let savedShift = null;

function safeAudio() {
  try { initAudio(); } catch { /* Audio is optional. */ }
}
safeAudio();
window.addEventListener('pointerdown', safeAudio);
window.addEventListener('keydown', safeAudio);

function syncRoot(actor) {
  actor.root.position.set(actor.x, 0, actor.z);
  actor.root.rotation.y = actor.yaw;
}

function syncDriver() {
  const car = vehicles.active;
  if (!car) return;
  player.x = car.x;
  player.z = car.z;
  player.yaw = car.yaw;
  syncRoot(player);
}

function reward(message, points, cash, seconds = 2) {
  world.score += points;
  world.state.cash += cash;
  world.toast = message;
  world.toastTime = seconds;
}

function save() {
  const record = { cash: world.state.cash, fares: missions.state.fares };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(record)); } catch { /* Storage can be denied. */ }
  savedShift = record;
}

function restoreSave() {
  if (!savedShift) return;
  const job = savedShift.fares + 1;
  const fare = FARES[(job - 1) % FARES.length];
  const target = job === 1 ? { ...PLAYER.spawn } : { ...fare.pickup };
  world.state.cash = savedShift.cash;
  Object.assign(missions.state, {
    fares: savedShift.fares,
    job,
    phase: 'pickup',
    target,
    timer: 90,
    distance: 0,
    active: true,
    getaway: job === 4,
    started: false
  });
  missions.marker.position.set(target.x, 0, target.z);
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const record = JSON.parse(raw);
    if (!record || typeof record !== 'object') return;
    const cash = record.cash;
    const fares = record.fares;
    if (!Number.isFinite(cash) || !Number.isFinite(fares) || cash < 0 || fares < 0) return;
    savedShift = { cash, fares: Math.floor(fares) };
  } catch { /* A bad save simply means a fresh shift. */ }
}

function collideWithCity(car) {
  for (const block of layout.buildings) {
    const dx = car.x - block.x;
    const dz = car.z - block.z;
    const overlapX = block.w + 1.1 - Math.abs(dx);
    const overlapZ = block.d + 2 - Math.abs(dz);
    if (overlapX <= 0 || overlapZ <= 0) continue;
    if (overlapX < overlapZ) car.x += Math.sign(dx || 1) * overlapX;
    else car.z += Math.sign(dz || 1) * overlapZ;
    car.speed *= 0.35;
  }
}

function collideWithCars(car) {
  const officers = new Set(police.cars);
  const nearby = [...vehicles.cars, ...traffic.cars, ...police.cars];
  for (const other of nearby) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const distance = Math.hypot(dx, dz);
    if (distance >= 4.5) continue;
    const nx = distance > 0 ? dx / distance : Math.cos(car.yaw);
    const nz = distance > 0 ? dz / distance : -Math.sin(car.yaw);
    const correction = (4.5 - distance) / 2;
    const isPolice = officers.has(other);
    car.x -= nx * correction * (isPolice ? 0.25 : 1);
    car.z -= nz * correction * (isPolice ? 0.25 : 1);
    other.x += nx * correction * (isPolice ? 1.75 : 1);
    other.z += nz * correction * (isPolice ? 1.75 : 1);
    car.speed *= isPolice ? 0.9 : 0.25;
    syncRoot(other);
  }
}

const world = {
  layout,
  player,
  vehicles,
  traffic,
  pedestrians,
  police,
  helicopter: police.helicopter,
  wanted,
  missions,
  input,
  renderer,
  state: { cash: HUD.cash, wanted: 0, seen: false },
  toast: '',
  toastTime: 0,
  objective: 'Pick up the fare at the amber marker',
  score: 0,

  reset() {
    vehicles.active = null;
    vehicles.cars.forEach((car, index) => {
      const spot = index === 0 ? CAR.spawn : CAR.parked[(index - 1) % CAR.parked.length];
      car.x = spot.x;
      car.z = spot.z;
      car.yaw = index === 0 ? 0 : ((index - 1) % 2 === 0 ? 0 : Math.PI);
      car.speed = 0;
      syncRoot(car);
      car.root.visible = true;
    });

    Object.assign(player, { x: PLAYER.spawn.x, z: PLAYER.spawn.z, yaw: 0, inCar: null });
    player.root.visible = true;
    syncRoot(player);

    Object.assign(wanted, { level: 0, seen: false, quiet: 0, decaySeconds: 10 });
    police.update(0, player, 0);
    police.helicopter.root.visible = false;

    world.state = { cash: HUD.cash, wanted: 0, seen: false };
    // Mutate the existing mission state: createMissions' update closure holds
    // this object, so replacing it would stage a state the simulation ignores.
    Object.assign(missions.state, initialMission());
    missions.marker.position.set(6.5, 0, -22);
    world.toast = '';
    world.toastTime = 0;
    world.objective = 'Pick up the fare at the amber marker';
    world.score = 0;

    driftTime = 0;
    driftActive = false;
    punchDown = false;
    soundTime = 0;
    sirenOn = false;
    nearMissCooldown = new WeakMap();
    playSiren(false);
    input.setSynthetic([]);
    input.consume(KEYS.enter);
    orbit = 0;
    pitch = 0.08;
    accumulator = 0;
    lastActive = null;
  },

  step(dt = STEP) {
    if (!vehicles.active) player.update(input, dt);

    const beforeCar = vehicles.active;
    vehicles.update(input, player, dt);
    if (vehicles.active && vehicles.active !== beforeCar) {
      playEnter();
      if (!vehicles.active.taxi) {
        wanted.raise();
        world.toast = 'VEHICLE STOLEN';
        world.toastTime = 4;
        world.score += 50;
      }
    }
    lastActive = vehicles.active;

    if (vehicles.active) syncDriver();

    if (!vehicles.active && input.consume('KeyF')) {
      punchDown = true;
      let target = null;
      let best = 3;
      for (const walker of pedestrians.walkers) {
        const distance = Math.hypot(walker.x - player.x, walker.z - player.z);
        if (distance < best) {
          best = distance;
          target = walker;
        }
      }
      if (target) {
        target.dir *= -1;
        target[target.axis] += target.dir * 2;
        world.toast = 'Rico throws a quick punch.';
        world.toastTime = 1;
      }
    } else {
      punchDown = false;
    }

    traffic.update(player, dt);
    pedestrians.update(dt);

    const car = vehicles.active;
    if (car) {
      collideWithCity(car);

      const now = performance.now();
      for (const other of [...traffic.cars, ...police.cars]) {
        const distance = Math.hypot(other.x - car.x, other.z - car.z);
        if (Math.abs(car.speed) > 15 && distance >= 2.5 && distance <= 4.5
          && now - (nearMissCooldown.get(other) ?? -Infinity) >= 3000) {
          nearMissCooldown.set(other, now);
          reward('NEAR MISS +$10', 25, 10);
        }
      }

      collideWithCars(car);
      for (const person of pedestrians.walkers) {
        if (Math.abs(car.speed) > 9
          && Math.hypot(person.x - car.x, person.z - car.z) < 2.8) wanted.raise();
      }
      syncRoot(car);
      syncDriver();
    }

    const steering = input.down(KEYS.left) || input.down(KEYS.right);
    if (!car) {
      driftTime = 0;
      driftActive = false;
    } else if (steering) {
      if (Math.abs(car.speed) > 18) {
        driftTime += dt;
        if (driftTime >= 1.2) driftActive = true;
      } else {
        driftTime = 0;
        driftActive = false;
      }
    } else {
      if (driftActive) reward('DRIFT +$15', 30, 15);
      driftTime = 0;
      driftActive = false;
    }

    const actor = car || player;
    police.update(wanted.level, actor, dt);
    wanted.update(actor, police, dt);
    world.state.wanted = wanted.level;
    world.state.seen = wanted.seen;

    const faresBefore = missions.state.fares;
    missions.update(world, dt);
    if (missions.state.fares > faresBefore) {
      playPickup();
      save();
    }

    const siren = wanted.level > 0;
    if (siren !== sirenOn) {
      sirenOn = siren;
      playSiren(siren);
    }

    soundTime -= dt;
    if (soundTime <= 0) {
      soundTime = 0.2;
      if (car) playEngine(Math.abs(car.speed));
      else if (KEYS.run.some(code => input.down(code))
        || input.down(KEYS.forward) || input.down(KEYS.back)
        || input.down(KEYS.left) || input.down(KEYS.right)) playFootstep();
    }

    if (world.toastTime > 0) {
      world.toastTime -= dt;
      if (world.toastTime <= 0) world.toast = '';
    }
  }
};

loadSave();
if (savedShift) {
  id('continue').classList.remove('hidden');
  id('save-summary').textContent = `Saved shift: $${savedShift.cash.toLocaleString('en-US')} · ${savedShift.fares} fares`;
}

function play() {
  state = 'playing';
  accumulator = 0;
  safeAudio();
  hud.hideTitle();
  id('pause').classList.add('hidden');
  id('over').classList.add('hidden');
}

id('start').onclick = () => { world.reset(); play(); };
id('continue').onclick = () => { world.reset(); restoreSave(); play(); };
id('restart').onclick = () => { world.reset(); play(); };
hud.onResume(play);

window.__azura = {
  get state() { return state; },
  player,
  carCount: vehicles.cars.length,
  world,
  renderer
};

if (shot !== null) {
  state = stageShot(shot, world).screen;
  if (state !== 'title') hud.hideTitle();
  missions.marker.position.set(missions.state.target.x, 0, missions.state.target.z);
  const actor = vehicles.active || player;
  const distance = vehicles.active ? VIEW.carDistance : VIEW.footDistance;
  lookCamera(renderer.camera, actor, distance, actor.yaw, pitch, 1);
}

let lastFrame = performance.now();
function frame(timestamp) {
  const elapsed = Math.max(0, Math.min(MAX_FRAME, (timestamp - lastFrame) / 1000));
  lastFrame = timestamp;

  if (input.consumeAny(KEYS.pause) && state !== 'title') {
    if (state === 'paused') {
      play();
    } else {
      state = 'paused';
      accumulator = 0;
      id('pause').classList.remove('hidden');
    }
  }

  const drag = input.drag();
  orbit -= drag.x * VIEW.orbitSensitivity;
  pitch = Math.max(VIEW.pitchMin, Math.min(VIEW.pitchMax,
    pitch + drag.y * VIEW.orbitSensitivity));

  if (state === 'playing' && shot === null) {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      world.step(STEP);
      accumulator -= STEP;
    }
  } else {
    input.consume(KEYS.enter);
  }

  if (input.consume('KeyM')) {
    toggleMute();
    playSiren(false);
    playSiren(wanted.level > 0);
  }

  if (state === 'title') {
    renderer.camera.position.set(VIEW.titlePosition[0], VIEW.titlePosition[1], VIEW.titlePosition[2]);
    renderer.camera.lookAt(VIEW.titleLook[0], VIEW.titleLook[1], VIEW.titleLook[2]);
  } else {
    const actor = vehicles.active || player;
    const distance = vehicles.active ? VIEW.carDistance : VIEW.footDistance;
    lookCamera(renderer.camera, actor, distance, actor.yaw + orbit, pitch,
      1 - Math.exp(-VIEW.follow * elapsed));
  }

  hud.update(world, state === 'playing');
  renderer.renderer.render(renderer.scene, renderer.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
