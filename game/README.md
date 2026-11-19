Port Azura
==========

Port Azura is an original 3D coastal crime-driving slice. Rico runs fares with
MARA on dispatch, can take parked cars, and may draw a response from the Azura
Police. A seeded city has roads, buildings, palms, traffic and pedestrians,
rendered with a vendored Three.js build.

Play
----

From the repository root, run:

    node serve.ts --port 8081

Then open http://localhost:8081 in a desktop browser and start a shift. Walk to
the amber marker and press E to accept a fare on foot, or drive the yellow cab
through it.

Controls
--------

- WASD: walk or drive.
- Shift: run while on foot.
- E: enter or exit a nearby parked car; on foot, interact with the fare marker.
- F: punch a nearby pedestrian on foot.
- Drag the mouse on the game canvas: orbit the camera.
- Esc or P: pause or resume. M: mute or unmute.

Mission loop
------------

A fare is an amber marker pickup, then drive to the marked destination before
the timer expires. A completed ride pays cash and advances the fare. Completed
fares and cash are saved in browser storage under port-azura.save.v1; Continue
restores those values, not an exact vehicle position or a chase. There are four
chapters: FIRST FARE, MARINA RUN, PALM BOULEVARD and GETAWAY. After three fares,
GETAWAY asks Rico to lose the police and reach the hideout. The GETAWAY chapter
is UNPROVEN: it has not been completed by normal play in this session (see
PLAYTEST.md for what was actually run).

HUD
---

The HUD shows the fare, chapter, phase, objective, countdown and stage; wanted
stars; cash and score; police callsigns, distances and response; helicopter
state; speed; minimap route; location; dispatch dialogue and temporary messages.

Screenshots
-----------

?shot=chase|steal|fare|sunset&seed=1 are frozen staging fixtures: they place a
representative world state for composition. Values such as chase cash, wanted
level and speed are staged, not earned gameplay, and are not proof that the
represented mission or chase was completed by normal play.

Source map
----------

- index.html: HUD, title/pause/end panels and page styles.
- src/main.js: simulation loop, state wiring, collisions, rewards and save.
- src/config.js: world, player, vehicle, view, control and HUD tuning.
- src/random.js: deterministic seeded random values.
- src/render.js: Three.js scene, renderer sizing and follow/orbit camera.
- src/city.js: roads, sidewalks, buildings, palms, lamps and city colliders.
- src/player.js: Rico's on-foot movement and animation.
- src/input.js: keyboard edges, synthetic controls and pointer orbit input.
- src/vehicles.js: enterable cars, driving physics and exit behavior.
- src/traffic.js: ambient traffic movement and spacing.
- src/pedestrians.js: pedestrian creation and sidewalk walking.
- src/police.js: response vehicles, pursuit and helicopter movement.
- src/wanted.js: wanted level, police detection and decay.
- src/missions.js: fare progression, markers, timers and hideout goal.
- src/hud.js: live minimap, mission, response and status display.
- src/audio.js: synthesized engine, footstep, siren and interaction effects.
- src/shots.js: deterministic shot staging and loop/getaway test modes.
- vendor/three.min.js: vendored Three.js renderer library.
