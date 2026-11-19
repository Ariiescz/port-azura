import { STEP, WORLD } from './config.js';
import { FARES } from './missions.js';

// Headless shot staging + the synthetic autopilot that drives the taxi.
//
// Each named shot freezes the world into a representative state so the
// screenshot harness can grab a frame, and the "loop"/"getaway" shots also run
// the real simulation with synthetic input until a goal is reached.

// Navigation caches. Both are keyed by the world object so successive shots
// never inherit a stale plan.
const navigation = new WeakMap();
const perimeter = new WeakMap();

const corners = [
  { x: -112, z: -112 }, { x: 112, z: -112 },
  { x: 112, z: 112 }, { x: -112, z: 112 }
];

const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angle = value => Math.atan2(Math.sin(value), Math.cos(value));
const nearest = value => WORLD.grid.reduce((a, b) => Math.abs(b - value) < Math.abs(a - value) ? b : a);

function show(actor) {
  actor.root.position.set(actor.x, 0, actor.z);
  actor.root.rotation.y = actor.yaw ?? 0;
}

// Snap both ends onto the nearest grid roads and stitch a route together:
// join the road, travel along it, turn, then close on the target.
function routeTo(car, target) {
  const verticalStart = Math.abs(car.x - nearest(car.x)) <= Math.abs(car.z - nearest(car.z));
  const verticalEnd = Math.abs(target.x - nearest(target.x)) <= Math.abs(target.z - nearest(target.z));
  const entry = verticalStart ? { x: nearest(car.x), z: car.z } : { x: car.x, z: nearest(car.z) };
  const exit = verticalEnd ? { x: nearest(target.x), z: target.z } : { x: target.x, z: nearest(target.z) };
  const points = [entry];
  if (verticalStart && verticalEnd) {
    if (entry.x !== exit.x) {
      const crossing = nearest(car.z);
      points.push({ x: entry.x, z: crossing }, { x: exit.x, z: crossing });
    }
  } else if (!verticalStart && !verticalEnd) {
    if (entry.z !== exit.z) {
      const crossing = nearest(car.x);
      points.push({ x: crossing, z: entry.z }, { x: crossing, z: exit.z });
    }
  } else {
    points.push(verticalStart ? { x: entry.x, z: exit.z } : { x: exit.x, z: entry.z });
  }
  points.push(exit, { ...target });
  return points.filter((point, index) => index === 0 || gap(point, points[index - 1]) > 0.01);
}

export function driveAutopilot(world) {
  const car = world.vehicles.active;
  if (!car) { world.input.setSynthetic(['KeyE']); return; }

  // If a cruiser has us boxed in and we are nearly stopped, peel away from it.
  const closest = world.police.cars.reduce((best, unit) => {
    const distance = gap(car, unit);
    return distance < best.distance ? { unit, distance } : best;
  }, { unit: null, distance: Infinity });
  if (closest.distance < 10 && car.speed < 5) {
    const error = angle(Math.atan2(car.x - closest.unit.x, car.z - closest.unit.z) - car.yaw);
    const controls = ['KeyW'];
    if (Math.abs(error) > 0.04) controls.push((error > 0) !== (car.speed < 0) ? 'KeyD' : 'KeyA');
    world.input.setSynthetic(controls);
    return;
  }

  let target = world.missions.state.target;
  if (world.missions.state.phase === 'hideout' && world.wanted.level > 0) {
    // Circle the block until the pursuit loses sight.
    let corner = perimeter.get(world) ?? 0;
    if (gap(car, corners[corner]) < 3) corner = (corner + 1) % corners.length;
    perimeter.set(world, corner);
    target = corners[corner];
  } else {
    perimeter.delete(world);
  }

  const signature = `${target.x}:${target.z}`;
  let plan = navigation.get(world);
  if (plan?.signature !== signature) {
    plan = { signature, points: routeTo(car, target), index: 0 };
    navigation.set(world, plan);
  }
  while (plan.index < plan.points.length - 1 && gap(car, plan.points[plan.index]) < 3) plan.index++;
  const waypoint = plan.points[plan.index];

  const distance = gap(car, waypoint);
  const error = angle(Math.atan2(waypoint.x - car.x, waypoint.z - car.z) - car.yaw);
  const turning = Math.abs(error);

  // Faster the further the waypoint is, but ease off into turns.
  let desiredSpeed = Math.min(30, Math.max(5, distance * 0.8));
  if (turning > 0.25) desiredSpeed = Math.min(desiredSpeed, 5);
  if (turning > 1.2) desiredSpeed = 3;

  const controls = [];
  if ((distance < 5 && car.speed > 4) || (turning > 1.2 && car.speed > 3.5)
    || car.speed > desiredSpeed + 1) controls.push('KeyS');
  else if (car.speed < desiredSpeed) controls.push('KeyW');
  if (turning > 0.04) controls.push((error > 0) !== (car.speed < 0) ? 'KeyD' : 'KeyA');
  world.input.setSynthetic(controls);
}

export function stageShot(name, world) {
  world.reset();
  navigation.delete(world);
  perimeter.delete(world);

  const mission = world.missions.state;
  const taxi = world.vehicles.cars[0];

  // Put Rico in the cab and park the pair at (x, z).
  function place(x, z) {
    Object.assign(taxi, { x, z, yaw: 0, speed: 0 });
    world.vehicles.active = taxi;
    Object.assign(world.player, { x, z, yaw: 0, inCar: taxi });
    world.player.root.visible = false;
    show(taxi);
    show(world.player);
  }

  // Step Rico out onto the pavement beside a car and make him visible.
  function stand(car, dx = 3, dz = 0) {
    world.vehicles.active = null;
    Object.assign(world.player, { x: car.x + dx, z: car.z + dz, inCar: null });
    world.player.yaw = Math.atan2(-dx, -dz);
    world.player.root.visible = true;
    show(world.player);
  }

  // Populate ambient traffic and pedestrians so a frame reads as a busy street.
  function extras(cars, walkers, axis) {
    cars.forEach(([x, z], index) => {
      const unit = world.traffic.cars[index];
      const dir = index ? -1 : 1;
      Object.assign(unit, {
        x, z, axis, dir, line: axis === 'x' ? z : x,
        yaw: Math.atan2(axis === 'x' ? dir : 0, axis === 'z' ? dir : 0)
      });
      show(unit);
    });
    walkers.forEach(([x, z], index) => {
      const person = world.pedestrians.walkers[index];
      Object.assign(person, { x, z, axis: 'z', dir: index ? -1 : 1, yaw: index ? Math.PI : 0 });
      show(person);
    });
  }

  switch (name) {
    case 'loop': {
      Object.assign(mission, { job: 1, fares: 0, phase: 'pickup', target: { x: 6.5, z: -22 } });
      world.state.cash = 0;
      place(0, -22);
      let count = 0;
      for (; count < 5400 && mission.fares < 1; count++) {
        driveAutopilot(world);
        world.step(STEP);
      }
      world.input.setSynthetic([]);
      console.log(mission.fares >= 1 ? `FARE-LOOP-OK cash=${world.state.cash} fares=${mission.fares}`
        : `FARE-LOOP-FAIL steps=${count} phase=${mission.phase} cash=${world.state.cash} fares=${mission.fares}`);
      try {
        const record = { cash: world.state.cash, fares: mission.fares };
        localStorage.setItem('port-azura.save.v1', JSON.stringify(record));
        const recovered = JSON.parse(localStorage.getItem('port-azura.save.v1'));
        console.log(recovered?.cash === record.cash && recovered?.fares === record.fares
          ? 'SAVE-OK' : 'SAVE-FAIL values differ');
      } catch (error) { console.log(`SAVE-FAIL ${error.message}`); }
      place(6.5, -22);
      break;
    }
    case 'getaway': {
      Object.assign(mission, {
        fares: 3, job: 4, phase: 'pickup', getaway: true,
        started: false, target: { ...FARES[3].pickup }, timer: 600
      });
      world.state.cash = 0;
      place(-112, 0);
      taxi.yaw = Math.PI / 2;
      show(taxi);
      let count = 0;
      for (; count < 9000 && mission.fares < 4; count++) {
        driveAutopilot(world);
        world.step(STEP);
        if ((count + 1) % 600 === 0) {
          const nearestPolice = Math.min(...world.police.cars.map(unit => gap(taxi, unit)));
          const plan = navigation.get(world);
          const point = plan?.points[plan.index];
          console.log(`GETAWAY-TRACE step=${count + 1} car=${taxi.x.toFixed(1)},${taxi.z.toFixed(1)} `
            + `yaw=${taxi.yaw.toFixed(2)} speed=${taxi.speed.toFixed(1)} `
            + `target=${mission.target.x},${mission.target.z} wanted=${world.wanted.level} `
            + `nearestPolice=${nearestPolice.toFixed(1)} phase=${mission.phase}`);
          console.log(`GETAWAY-ROUTE step=${count + 1} waypoint=${point?.x},${point?.z} `
            + `quiet=${world.wanted.quiet.toFixed(2)}`);
        }
      }
      world.input.setSynthetic([]);
      console.log(mission.fares >= 4 && world.state.cash > 0 && world.wanted.level === 0 ? 'GETAWAY-OK'
        : `GETAWAY-FAIL steps=${count} phase=${mission.phase} wanted=${world.wanted.level} fares=${mission.fares}`);
      break;
    }
    case 'chase': {
      place(0, 56);
      world.state.cash = 25000;
      world.wanted.raise(3);
      Object.assign(mission, {
        job: 4, fares: 3, getaway: true, phase: 'hideout',
        timer: 126, target: { x: 112, z: 56 }
      });
      world.objective = 'Lose the Azura Police, then reach the hideout';
      taxi.speed = 24;
      taxi.yaw = 0;
      show(taxi);
      world.helicopter.activate();
      world.police.update(3, world.player, 0);
      [[3, 48], [-3, 50], [8, 52], [-8, 56]].forEach(([x, z], index) => {
        const unit = world.police.cars[index];
        Object.assign(unit, { x, z, yaw: Math.atan2(world.player.x - x, world.player.z - z) });
        show(unit);
      });
      world.helicopter.root.position.set(-3, 9, 74);
      world.helicopter.root.scale.setScalar(1.8);
      world.toast = 'NEAR MISS +$10';
      world.toastTime = 4;
      world.score += 25;
      world.state.cash += 10;
      break;
    }
    case 'steal': {
      const parked = world.vehicles.cars[1];
      Object.assign(parked, { x: -3.3, z: 14, speed: 0 });
      show(parked);
      Object.assign(world.player, { x: -6.1, z: 14, yaw: Math.PI / 2, inCar: null });
      world.player.root.visible = true;
      show(world.player);
      world.state.cash = 250;
      world.objective = 'Take a car and evade the response';
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
      for (let tick = 0; tick < 120 && !world.toast; tick++) world.step(STEP);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
      if (world.toast === 'VEHICLE STOLEN') world.toastTime = 4;
      else console.log(`STEAL-FAIL toast=${world.toast}`);
      // Rico now stands beside the freshly stolen car, facing it.
      Object.assign(world.player, { x: parked.x + 3.2, z: parked.z + 1, inCar: null });
      world.player.yaw = Math.atan2(-3.2, -1);
      world.player.root.visible = true;
      show(world.player);
      world.vehicles.active = null;
      break;
    }
    case 'fare':
    case 'sunset': {
      const sunset = name === 'sunset';
      place(sunset ? 112 : 0, 0);
      Object.assign(mission, {
        fares: 2, job: 3, phase: 'destination',
        timer: 75, target: { x: sunset ? 140 : -56, z: 0 }
      });
      taxi.speed = sunset ? 20 : 18;
      taxi.yaw = sunset ? Math.PI / 2 : -Math.PI / 2;
      show(taxi);
      world.state.cash = sunset ? 5200 : 2600;
      world.objective = 'Follow the coastal road to Palm Boulevard';
      world.toast = '';
      extras(
        sunset ? [[112, 10], [112, -10]] : [[-18, -3], [-26, 3]],
        sunset ? [[104.5, 7], [104.5, -7]] : [[-10, 7.5], [-16, -7.5]],
        sunset ? 'z' : 'x'
      );
      if (sunset) {
        world.renderer.scene.background.set('#ef8d55');
        world.renderer.scene.fog.color.set('#efb49a');
        world.renderer.sunlight.color.set('#ffb347');
        world.renderer.sunlight.position.set(112, 18, -35);
        world.renderer.sunlight.intensity = 1.1;
        world.renderer.hemisphere.color.set('#ffd0a1');
        world.renderer.hemisphere.groundColor.set('#895846');
        world.renderer.hemisphere.intensity = 0.45;
      }
      break;
    }
    case 'end':
      place(0, -22);
      stand(taxi);
      break;
  }

  // Keep the driver glued to the cab for any shot that leaves it occupied.
  if (world.vehicles.active) {
    Object.assign(world.player, { x: taxi.x, z: taxi.z, yaw: taxi.yaw });
    show(world.player);
  }

  world.missions.marker.position.set(mission.target.x, 0, mission.target.z);
  world.state.wanted = world.wanted.level;
  return { screen: name === 'start' ? 'title' : 'playing' };
}
