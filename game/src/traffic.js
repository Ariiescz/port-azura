import { PALETTE, WORLD } from './config.js';

// ---------------------------------------------------------------------------
// Ambient traffic.
//
// Ten background cars cruise the grid roads purely for atmosphere. They keep
// to a lane on one road, watch for the car in front, and recycle themselves
// near the map edge so the streets never empty out. The layout's extra argument
// is accepted to match the other systems' construction calls.
// ---------------------------------------------------------------------------

const FLEET_SIZE = 10;
const CRUISE = 7;
const CEILING = 9;
const BRAKE = 12;

// Six body paints, cycled over the fleet.
const PAINTS = ['#c95343', '#308eac', '#eee6cf', '#658b51', '#ad6493', '#d4a443'];

export function createTraffic(scene, layout, random) {
  function body(root, width, height, depth, y, colour) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshLambertMaterial({ color: colour }));
    mesh.position.y = y;
    root.add(mesh);
    return mesh;
  }

  // Which way a car points depends on both its axis and its direction.
  function heading(axis, dir) {
    return Math.atan2(axis === 'x' ? dir : 0, axis === 'z' ? dir : 0);
  }

  function place(car) {
    car.yaw = heading(car.axis, car.dir);
    car.root.rotation.y = car.yaw;
    car.root.position.set(car.x, 0, car.z);
  }

  const cars = [];
  for (let index = 0; index < FLEET_SIZE; index++) {
    const root = new THREE.Group();
    body(root, 2.1, 0.7, 4.1, 0.8, PAINTS[index % PAINTS.length]);
    body(root, 1.6, 0.6, 1.9, 1.45, PALETTE.glass);

    const axis = random() < 0.5 ? 'x' : 'z';
    const dir = random() < 0.5 ? -1 : 1;
    const line = WORLD.grid[Math.floor(random() * WORLD.grid.length)];
    const along = (random() * 2 - 1) * (WORLD.half - 10);

    const car = {
      root, axis, dir, line,
      x: axis === 'x' ? along : line,
      z: axis === 'z' ? along : line,
      yaw: 0,
      speed: 5 + 4 * random(),
      taxi: false,
      traffic: true
    };
    place(car);
    scene.add(root);
    cars.push(car);
  }

  // True when another car on the same road sits within nine metres ahead.
  function tailgated(car, other) {
    if (other === car || other.axis !== car.axis || other.line !== car.line) return false;
    const ahead = (other[car.axis] - car[car.axis]) * car.dir;
    return ahead > 0 && ahead < 9;
  }

  function recycle(car, player) {
    const distant = Math.abs(car[car.axis] - player[car.axis]) > 70;
    car.dir = -car.dir;
    if (distant) {
      // Nobody is watching this stretch, so drop it back in at the far end.
      car[car.axis] = car.dir * (WORLD.half - 10);
    } else {
      // Otherwise tuck it in ninety metres behind the player, on this road.
      const behind = player[car.axis] - 90 * car.dir;
      car[car.axis] = Math.min(140, Math.max(-140, behind));
    }
  }

  function update(player, dt) {
    // Sample every following distance before any car moves so the fleet all
    // reacts to the same snapshot of the world.
    const blocked = cars.map(car => cars.some(other => tailgated(car, other)));

    cars.forEach((car, index) => {
      const goal = blocked[index] ? -BRAKE : CRUISE - car.speed;
      car.speed = Math.min(CEILING, Math.max(0, car.speed + goal * dt));
      car[car.axis] += car.dir * car.speed * dt;
      if (Math.abs(car[car.axis]) >= WORLD.half - 8) recycle(car, player);
      place(car);
    });
  }

  return { cars, update };
}
