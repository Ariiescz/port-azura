import { WORLD } from './config.js';

// ---------------------------------------------------------------------------
// Azura Police response.
//
// A cruiser is a white sedan with a blue stripe and a light bar; units keep
// their callsigns and simply steer straight at the player. Once the heat is
// high enough a blue and white helicopter joins in and lazily orbits overhead.
// Chase speed is deliberately slow (8) so a fleeing driver can outrun it.
// ---------------------------------------------------------------------------

const CALLSIGNS = ['UNIT 7', 'UNIT 12', 'UNIT 23', 'UNIT 31'];
const CHASE_SPEED = 8;
const STANDOFF = 6;
const AIRSPACE = { radius: 24, height: 24, spin: 0.48, rotor: 18 };

export function createPolice(scene, random) {
  const cars = [];

  const paint = {
    white: new THREE.MeshLambertMaterial({ color: '#f1f3ee' }),
    blue: new THREE.MeshLambertMaterial({ color: '#266caf' }),
    red: new THREE.MeshLambertMaterial({ color: '#f14248' })
  };

  function block(parent, size, offset, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.position.set(offset[0], offset[1], offset[2]);
    parent.add(mesh);
    return mesh;
  }

  // Roll a new cruiser onto a random road at a random spot along it.
  function summon() {
    const root = new THREE.Group();
    const callsign = CALLSIGNS[cars.length];
    root.name = callsign;

    block(root, [2.2, 0.75, 4.2], [0, 0.85, 0], paint.white);
    block(root, [2.24, 0.22, 3.5], [0, 0.95, 0], paint.blue);
    block(root, [1.7, 0.55, 1.9], [0, 1.48, -0.1], paint.white);
    block(root, [1.2, 0.18, 0.35], [0, 1.86, -0.1], paint.red);

    const axis = random() < 0.5 ? 'x' : 'z';
    const road = WORLD.grid[Math.floor(random() * WORLD.grid.length)];
    const along = (random() * 2 - 1) * (WORLD.half - 10);

    const unit = {
      root, callsign, speed: CHASE_SPEED, yaw: 0,
      x: axis === 'x' ? along : road,
      z: axis === 'z' ? along : road
    };
    root.position.set(unit.x, 0, unit.z);
    scene.add(root);
    cars.push(unit);
  }

  // Rotor craft: blue fuselage, white cabin, two crossed blades.
  const aircraft = new THREE.Group();
  block(aircraft, [2.3, 1.15, 3.6], [0, 0, 0], paint.blue);
  block(aircraft, [1.9, 0.85, 1.7], [0, 0.4, 0.6], paint.white);
  const rotor = new THREE.Group();
  rotor.position.y = 1.1;
  for (const bearing of [0, Math.PI / 2]) {
    block(rotor, [6, 0.08, 0.18], [0, 0, 0], paint.white).rotation.y = bearing;
  }
  aircraft.add(rotor);
  aircraft.visible = false;
  scene.add(aircraft);

  let airborne = false;
  let orbit = 0;

  const helicopter = {
    root: aircraft,
    activate() {
      airborne = true;
      aircraft.visible = true;
    },
    get active() { return airborne; }
  };

  function chase(unit, player, dt) {
    const dx = player.x - unit.x;
    const dz = player.z - unit.z;
    const gap = Math.hypot(dx, dz);
    // Close the distance but never overlap the player's bumper.
    const step = Math.min(unit.speed * dt, Math.max(0, gap - STANDOFF));
    if (gap > 0) {
      unit.x += dx * step / gap;
      unit.z += dz * step / gap;
      unit.yaw = Math.atan2(dx, dz);
    }
    unit.root.rotation.y = unit.yaw;
    unit.root.position.set(unit.x, 0, unit.z);
  }

  function update(level, player, dt) {
    if (level === 0) {
      for (const unit of cars) scene.remove(unit.root);
      cars.length = 0;
    } else {
      const wanted = Math.min(4, level + 1);
      while (cars.length < wanted) summon();
    }

    for (const unit of cars) chase(unit, player, dt);

    if (level >= 3) helicopter.activate();
    if (!airborne) return;

    orbit += AIRSPACE.spin * dt;
    aircraft.position.set(
      player.x + AIRSPACE.radius * Math.sin(orbit),
      AIRSPACE.height,
      player.z + AIRSPACE.radius * Math.cos(orbit)
    );
    aircraft.rotation.y = orbit + Math.PI / 2;
    rotor.rotation.y += AIRSPACE.rotor * dt;
  }

  return { cars, helicopter, update };
}
