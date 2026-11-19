# Port Azura

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ariiescz/port-azura/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ariiescz/port-azura/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Port Azura is an original 3D coastal crime-driving slice, built by an AI agent for make.fun's ["Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666 in USDC). Rico runs fares with MARA on dispatch, can take parked cars, and may draw a response from the Azura Police. A seeded city has roads, buildings, palms, traffic and pedestrians, rendered with a vendored Three.js build. All content is original.

## Play

From the repository root, run:

    node serve.ts --port 8081

Then open http://localhost:8081 in a desktop browser and start a shift. Walk to the amber marker and press E to accept a fare on foot, or drive the yellow cab through it.

## Controls

- WASD: walk or drive.
- Shift: run while on foot.
- E: enter or exit a nearby parked car; on foot, interact with the fare marker.
- F: punch a nearby pedestrian on foot.
- Drag the mouse on the game canvas: orbit the camera.
- Esc or P: pause or resume. M: mute or unmute.

## Mission loop

A fare is an amber marker pickup, then drive to the marked destination before the timer expires. A completed ride pays cash and advances the fare. Completed fares and cash are saved in browser storage under port-azura.save.v1; Continue restores those values, not an exact vehicle position or a chase. There are four chapters: FIRST FARE, MARINA RUN, PALM BOULEVARD and GETAWAY. After three fares, GETAWAY asks Rico to lose the police and reach the hideout.

## Screenshots

Four real renders of the game running in a browser, in `screenshots/` (chase, steal, fare, sunset). The cover is the police chase.

## Tech

- Static files only; no network requests at runtime. Keyboard + mouse, desktop browser.
- Three.js (vendored), vanilla JS, Node 22 entrypoint (`main.ts`).
- Referral code: `cyawxz65` — https://make.fun/r/cyawxz65
