// ---------------------------------------------------------------------------
// Fare missions.
//
// Each shift is a short chain of four jobs: three ordinary pick-up and drop-off
// runs, then a getaway in which the passenger is dropped off and Rico must
// shake the police before returning to the hideout. The mission owns the amber
// marker and the small block of state the HUD and minimap read back.
// ---------------------------------------------------------------------------

// Fares 1..3 are pick-up / destination pairs; the fourth point doubles as the
// getaway hideout destination.
export const FARES = [
  { pickup: { x: 56, z: -34 }, destination: { x: -56, z: 0 } },
  { pickup: { x: -56, z: 56 }, destination: { x: 0, z: -112 } },
  { pickup: { x: 112, z: 0 }, destination: { x: 56, z: 112 } },
  { pickup: { x: -112, z: 0 }, destination: { x: 112, z: 56 } }
];

const TAXI_SPAWN = { x: 6.5, z: -22 };
const ARRIVAL = 7;          // metres that count as reaching a marker
const PICKUP_WINDOW = 90;   // seconds allowed for pick-up / drop-off
const HIDEOUT_WINDOW = 120; // seconds allowed for the getaway chase
const BASE_FARE = 25;       // dollars plus distance pay for a completed run
const HIDEOUT_PAY = 100;

export function createMissions(scene) {
  const state = {
    fares: 0,
    job: 1,
    phase: 'pickup',
    target: { ...TAXI_SPAWN },
    timer: PICKUP_WINDOW,
    distance: 0,
    active: true,
    getaway: false,
    started: false
  };

  // The marker: an amber post with a pulsing ball on top.
  const amber = new THREE.MeshBasicMaterial({ color: '#ffc342' });
  const marker = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.6, 8), amber);
  stem.position.y = 1.3;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 8), amber);
  ball.position.y = 2.8;
  marker.add(stem, ball);
  scene.add(marker);

  let pulse = 0;

  // The fare record for the current job (jobs 4+ wrap back over the list).
  function fare() {
    return FARES[(state.job - 1) % FARES.length];
  }

  function moveMarker() {
    marker.position.set(state.target.x, 0, state.target.z);
  }

  function beginFare() {
    state.job = state.fares + 1;
    state.phase = 'pickup';
    state.getaway = state.job === 4;
    state.started = false;
    state.distance = 0;
    state.timer = PICKUP_WINDOW;
    state.target = state.job === 1 ? { ...TAXI_SPAWN } : { ...fare().pickup };
    moveMarker();
  }

  // Bank the reward, announce it, then roll straight into the next job.
  function complete(world, amount) {
    state.fares += 1;
    world.state.cash += amount;
    world.toast = `Fare complete +$${amount}`;
    world.toastTime = 4;
    beginFare();
  }

  function update(world, dt) {
    if (!state.active) return;

    pulse += dt;
    ball.scale.setScalar(1 + Math.sin(pulse * 6) * 0.18);
    moveMarker();

    // A pick-up or drop-off is on the clock; the hideout stage is not.
    if (state.phase === 'pickup' || state.phase === 'destination') {
      state.timer -= dt;
      if (state.timer <= 0) {
        world.toast = 'The passenger left. Another fare is waiting.';
        world.toastTime = 3;
        beginFare();
        return;
      }
    }

    // On the getaway the first pick-up sets the whole chase in motion.
    if (state.getaway && state.phase === 'pickup' && !state.started) {
      state.started = true;
      state.phase = 'hideout';
      state.timer = HIDEOUT_WINDOW;
      state.target = { ...FARES[3].destination };
      world.wanted.raise(2);
      world.wanted.decaySeconds = 6;
      world.objective = 'Lose the police, then reach the hideout';
      moveMarker();
      return;
    }

    const car = world.vehicles.active;
    const actor = car || world.player;
    const close = Math.hypot(actor.x - state.target.x, actor.z - state.target.z) < ARRIVAL;

    if (state.phase === 'pickup') {
      world.objective = 'Pick up the fare at the amber marker';
      if (close && (car || world.input.consume('KeyE'))) {
        state.phase = 'destination';
        state.timer = PICKUP_WINDOW;
        state.distance = 0;
        state.target = { ...fare().destination };
        world.toast = 'Passenger aboard. Follow the amber marker.';
        world.toastTime = 3;
      }
    } else if (state.phase === 'destination') {
      world.objective = 'Drive to the amber destination';
      state.distance += Math.abs(car ? car.speed : 0) * dt;
      if (close) complete(world, BASE_FARE + Math.floor(state.distance / 10));
    } else {
      world.objective = 'Lose the police, then reach the hideout';
      if (close && world.wanted.level === 0) complete(world, HIDEOUT_PAY);
    }

    moveMarker();
  }

  moveMarker();
  return { state, marker, update };
}
