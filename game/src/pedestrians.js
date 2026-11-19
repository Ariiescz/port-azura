import { PALETTE, WORLD } from './config.js';

// ---------------------------------------------------------------------------
// Sidewalk pedestrians.
//
// Fourteen walkers pace the pavements that flank the grid roads. They are just
// a torso box under a sphere head, but a small vertical bob and a heading that
// follows the stride make them read as people rather than props.
// ---------------------------------------------------------------------------

const CROWD = 14;
const SHIRTS = ['#e0734d', '#508faa', '#e3bc55', '#9679b5', '#e4e4d5', '#589878'];
const EDGE = 140;

export function createPedestrians(scene, random) {
  const skin = new THREE.MeshLambertMaterial({ color: PALETTE.skin });
  const torsoShape = new THREE.BoxGeometry(0.56, 0.86, 0.36);
  const headShape = new THREE.SphereGeometry(0.24, 8, 6);

  // Face the way the walker is striding, then settle onto its bobbed height.
  function pose(walker) {
    const facing = Math.atan2(
      walker.axis === 'x' ? walker.dir : 0,
      walker.axis === 'z' ? walker.dir : 0
    );
    walker.root.rotation.y = facing;
    walker.root.position.set(walker.x, 0.035 + Math.abs(Math.sin(walker.phase)) * 0.06, walker.z);
  }

  const walkers = [];
  for (let index = 0; index < CROWD; index++) {
    const root = new THREE.Group();
    const torso = new THREE.Mesh(torsoShape,
      new THREE.MeshLambertMaterial({ color: SHIRTS[index % SHIRTS.length] }));
    torso.position.y = 0.95;
    const head = new THREE.Mesh(headShape, skin);
    head.position.y = 1.58;
    root.add(torso, head);

    // Pick a road, then step eight metres out onto one of its pavements.
    const axis = random() < 0.5 ? 'x' : 'z';
    const road = WORLD.grid[Math.floor(random() * WORLD.grid.length)];
    const lane = road + (random() < 0.5 ? -8 : 8);
    const start = random() * (EDGE * 2) - EDGE;

    const walker = {
      root, axis,
      x: axis === 'x' ? start : lane,
      z: axis === 'z' ? start : lane,
      dir: random() < 0.5 ? -1 : 1,
      speed: 0.7 + 0.5 * random(),
      phase: random() * Math.PI * 2
    };
    pose(walker);
    scene.add(root);
    walkers.push(walker);
  }

  function update(dt) {
    for (const walker of walkers) {
      const moved = walker[walker.axis] + walker.dir * walker.speed * dt;
      if (moved >= EDGE) walker.dir = -1;
      else if (moved <= -EDGE) walker.dir = 1;
      walker[walker.axis] = Math.min(EDGE, Math.max(-EDGE, moved));
      walker.phase += 7 * dt;
      pose(walker);
    }
  }

  return { walkers, update };
}
