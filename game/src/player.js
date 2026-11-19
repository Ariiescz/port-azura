import { KEYS, PALETTE, PLAYER } from './config.js';

// Rico, built from a handful of primitives so he reads clearly from the
// chase camera: shirt torso, skin head/arms, trouser legs on swinging hips.
//
// Control convention shared across the game: forward (W) moves toward +z and
// right (D) toward +x, so heading is yaw = atan2(dx, dz). The chase camera
// uses the same yaw, which keeps on-foot and driving views consistent.
export function createPlayer(scene, layout) {
  const root = new THREE.Group();
  root.name = 'Rico';

  const shirtMat = new THREE.MeshLambertMaterial({ color: PALETTE.shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: PALETTE.skin });
  const trouserMat = new THREE.MeshLambertMaterial({ color: PALETTE.trousers });

  function part(geometry, material, parent, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  part(new THREE.BoxGeometry(0.62, 0.76, 0.36), shirtMat, root, 0, 1.17, 0);
  part(new THREE.SphereGeometry(0.27, 8, 6), skinMat, root, 0, 1.83, 0);

  const hips = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.17, 0.8, 0);
    root.add(hip);
    part(new THREE.BoxGeometry(0.24, 0.76, 0.29), trouserMat, hip, 0, -0.38, 0);
    part(new THREE.BoxGeometry(0.17, 0.67, 0.22), skinMat, root, side * 0.41, 1.13, 0);
    hips.push(hip);
  }

  const actor = {
    root,
    x: PLAYER.spawn.x,
    z: PLAYER.spawn.z,
    yaw: 0,
    inCar: null,
    update(input, dt) {
      if (actor.inCar) return;

      const strafe = (input.down(KEYS.right) ? 1 : 0) - (input.down(KEYS.left) ? 1 : 0);
      const drive = (input.down(KEYS.forward) ? 1 : 0) - (input.down(KEYS.back) ? 1 : 0);
      const magnitude = Math.hypot(strafe, drive);
      const walking = magnitude > 0;

      let phase = actor._phase || 0;
      if (walking) {
        const speed = KEYS.run.some(code => input.down(code)) ? PLAYER.run : PLAYER.walk;
        const step = (speed * dt) / magnitude;
        actor.x = Math.max(-140, Math.min(140, actor.x + strafe * step));
        actor.z = Math.max(-140, Math.min(140, actor.z + drive * step));
        actor.yaw = Math.atan2(strafe, drive);
        phase += dt * PLAYER.cadence * (speed / PLAYER.walk);
      } else {
        phase = 0;
      }
      actor._phase = phase;

      const swing = walking ? Math.sin(phase) : 0;
      hips[0].rotation.x = swing * 0.48;
      hips[1].rotation.x = -swing * 0.48;

      root.position.set(actor.x, Math.abs(swing) * PLAYER.bob, actor.z);
      root.rotation.y = actor.yaw;
    }
  };

  root.position.set(actor.x, 0, actor.z);
  scene.add(root);
  return actor;
}
