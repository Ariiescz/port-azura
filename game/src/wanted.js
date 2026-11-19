// ---------------------------------------------------------------------------
// Wanted meter.
//
// Heat is a simple 0..5 star level. It only ever climbs when a crime is
// reported, and it bleeds back down once the police have lost sight of Rico.
// Sight is judged purely by distance (60 m): there is no raycasting, because
// the intended escape is to physically outrun the response.
// ---------------------------------------------------------------------------

const CEILING = 5;
const SIGHT_RANGE = 60;
const DEFAULT_DECAY = 10;

export function createWanted() {
  const wanted = {
    level: 0,
    seen: false,
    // Seconds elapsed since the police last had eyes on the player.
    quiet: 0,
    // How long that quiet must last before a star is shed.
    decaySeconds: DEFAULT_DECAY,
    raise,
    update
  };

  function raise(amount = 1) {
    wanted.level = Math.min(CEILING, Math.max(0, wanted.level + amount));
    wanted.quiet = 0;
  }

  function update(player, police, dt) {
    wanted.seen = police.cars.some(unit => {
      const dx = unit.x - player.x;
      const dz = unit.z - player.z;
      return dx * dx + dz * dz <= SIGHT_RANGE * SIGHT_RANGE;
    });

    // Being spotted resets the clock; staying hidden runs it down.
    if (wanted.seen) {
      wanted.quiet = 0;
      return;
    }

    wanted.quiet += dt;
    if (wanted.quiet < wanted.decaySeconds) return;
    wanted.level = Math.max(0, wanted.level - 1);
    wanted.quiet = 0;
  }

  return wanted;
}
