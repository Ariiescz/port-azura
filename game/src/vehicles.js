import { CAR, KEYS, PALETTE } from './config.js';

// ---------------------------------------------------------------------------
// Drivable fleet.
//
// Every car is a single THREE.Group of boxes and cylinders hung off the scene.
// The handling model is pure arcade: the throttle integrates a signed speed,
// steering turns the heading, and the body slides along that heading. The
// world convention (which the player and camera share) is that forward is +z
// and heading is yaw = atan2(dx, dz), so travel is
//
//     x += sin(yaw) * speed * dt
//     z += cos(yaw) * speed * dt
// ---------------------------------------------------------------------------

const BOUND = 140;

// Keep the whole playable band inside a fixed square so nobody drives to sea.
function clamp(value) {
  return Math.min(BOUND, Math.max(-BOUND, value));
}

// Dimensions are plain numbers so the silhouette of every part is readable.
const HULL = { w: 2.1, h: 0.72, d: 4.3 };
const CABIN = { w: 1.7, h: 0.62, d: 2.0 };
const LID = { w: 1.82, h: 0.14, d: 2.15 };

// A local builder: (scene, position, colour, isTaxi, yaw) -> car record.
function streetCar(scene, spot, paint, taxi, yaw) {
  const root = new THREE.Group();

  const body = new THREE.MeshLambertMaterial({ color: paint });
  const glass = new THREE.MeshLambertMaterial({ color: PALETTE.glass });
  const lamp = new THREE.MeshLambertMaterial({ color: '#fff2c8' });
  const brake = new THREE.MeshLambertMaterial({ color: '#e2403f' });

  const shell = new THREE.Mesh(new THREE.BoxGeometry(HULL.w, HULL.h, HULL.d), body);
  shell.position.y = 0.86;
  root.add(shell);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CABIN.w, CABIN.h, CABIN.d), glass);
  cabin.position.set(0, 1.5, -0.15);
  root.add(cabin);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(LID.w, LID.h, LID.d), body);
  lid.position.set(0, 1.86, -0.15);
  root.add(lid);

  // Headlights face the nose (+z), brake lights sit on the tail.
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.1), lamp);
    head.position.set(side * 0.66, 0.95, HULL.d / 2);
    root.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.1), brake);
    tail.position.set(side * 0.66, 0.95, -HULL.d / 2);
    root.add(tail);
  }

  // The cab is the only car with a roof sign.
  if (taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.3, 0.5), lamp);
    sign.position.set(0, 2.08, -0.15);
    root.add(sign);
  }

  const tyreShape = new THREE.CylinderGeometry(CAR.wheelRadius, CAR.wheelRadius, 0.3, 12);
  const rubber = new THREE.MeshLambertMaterial({ color: PALETTE.rubber });
  for (const axle of [-1, 1]) {
    for (const side of [-1, 1]) {
      const tyre = new THREE.Mesh(tyreShape, rubber);
      tyre.position.set(side * 1.05, CAR.wheelRadius + 0.05, axle * 1.4);
      tyre.rotation.z = Math.PI / 2;
      root.add(tyre);
    }
  }

  root.position.set(spot.x, 0, spot.z);
  root.rotation.y = yaw;
  scene.add(root);
  return { root, x: spot.x, z: spot.z, yaw, speed: 0, taxi };
}

export function createVehicles(scene, layout) {
  // Car 0 is the yellow cab; the rest fill the marked parking bays.
  const cars = [streetCar(scene, CAR.spawn, CAR.taxi, true, 0)];
  CAR.parked.forEach((spot, index) => {
    const paint = CAR.colours[index % CAR.colours.length];
    const heading = index % 2 === 0 ? 0 : Math.PI;
    cars.push(streetCar(scene, spot, paint, false, heading));
  });

  const fleet = { cars, active: null, update };

  // Step out of the driver's seat onto the pavement beside the car.
  function dismount(player, car) {
    car.speed = 0;
    player.x = clamp(car.x + Math.cos(car.yaw) * 3);
    player.z = clamp(car.z - Math.sin(car.yaw) * 3);
    player.yaw = car.yaw;
    player.root.position.set(player.x, 0, player.z);
    player.root.rotation.y = player.yaw;
    player.root.visible = true;
    player.inCar = null;
    fleet.active = null;
  }

  // Closest stationary car the player could climb into right now.
  function nearestCar(player) {
    let best = null;
    let reach = CAR.enterRange;
    for (const car of cars) {
      if (Math.abs(car.speed) >= CAR.exitSpeed) continue;
      const range = Math.hypot(player.x - car.x, player.z - car.z);
      if (range <= reach) {
        reach = range;
        best = car;
      }
    }
    return best;
  }

  function handleEnter(player) {
    if (player.inCar) {
      if (Math.abs(player.inCar.speed) < CAR.exitSpeed) dismount(player, player.inCar);
      return;
    }
    const car = nearestCar(player);
    if (!car) return;
    fleet.active = car;
    player.inCar = car;
    player.root.visible = false;
  }

  function drive(car, input, dt) {
    const throttle = Number(input.down(KEYS.forward)) - Number(input.down(KEYS.back));
    const opposing = throttle !== 0 && throttle * car.speed < 0;

    if (throttle !== 0 && !opposing) {
      car.speed += throttle * CAR.acceleration * dt;
    } else {
      // Braking when the pedals fight the motion, coasting otherwise.
      const slow = (opposing ? CAR.brake : CAR.drag) * dt;
      car.speed = Math.sign(car.speed) * Math.max(0, Math.abs(car.speed) - slow);
    }
    car.speed = Math.max(-CAR.reverse, Math.min(CAR.max, car.speed));

    const magnitude = Math.abs(car.speed);
    const steer = Number(input.down(KEYS.right)) - Number(input.down(KEYS.left));
    car.yaw += steer * CAR.steering * car.speed * dt
      / Math.max(3, magnitude)
      / (1 + magnitude * CAR.steeringFalloff);

    const aheadX = car.x + Math.sin(car.yaw) * car.speed * dt;
    const aheadZ = car.z + Math.cos(car.yaw) * car.speed * dt;
    car.x = clamp(aheadX);
    car.z = clamp(aheadZ);
    if (car.x !== aheadX || car.z !== aheadZ) car.speed = 0;

    car.root.position.set(car.x, 0, car.z);
    car.root.rotation.y = car.yaw;
  }

  function update(input, player, dt) {
    if (input.consume(KEYS.enter)) handleEnter(player);
    if (fleet.active) drive(fleet.active, input, dt);
  }

  return fleet;
}
