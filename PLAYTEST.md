# PLAYTEST — make.fun entry `gta6-01` (Phase 4: real browser capture)

Agent: recorded build agent. Session date: 2026-11-19 (UTC). Repo:
`/home/hatch/workspace/makefun/gta6`. Every number below was produced by a command
run in this session; nothing is carried over from an earlier report.

## Method (Phase 4 capture)

- Server: `node serve.ts --port 8081` (the repo's own server), run detached with
  `setsid nohup`. Verified `HTTP 200`, `8467` bytes for `/` and `608081` bytes
  for `/vendor/three.min.js`.
- Browser: the Playwright Chromium headless shell at
  `/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`
  (`HeadlessChrome/159.0.8154.6`), launched **per shot** with a fresh
  `--user-data-dir` under `/tmp` and
  `--headless`-equivalent `chrome-headless-shell` plus
  `--no-sandbox --disable-gpu --use-gl=angle --use-angle=swiftshader
  --enable-unsafe-swiftshader --window-size=1280,720 --hide-scrollbars
  --disable-dev-shm-usage --no-default-browser-check about:blank`.
- CDP: a purpose-written Node 24 script
  (`~/workspace/makefun/gta6-build/capture-shots.mjs`, no dependencies, global
  `WebSocket` + `node:http`/`node:fs`) connects to the page target from
  `http://127.0.0.1:<port>/json/list`, enables `Page`, `Runtime`, `Log` and
  `Network`, sets device metrics `1280x720 @1x`, navigates, waits **2.5 s of
  real time** after load, then `Page.captureScreenshot {format:'png'}`. Each
  target is closed and its profile removed after the shot.
- The page is loaded from `http://127.0.0.1:8081/...` because `serve.ts` binds
  IPv4 only while this container's `localhost` resolves to `::1` first; Chromium
  then got `ERR_CONNECTION_REFUSED` on the `localhost` form. This is a harness
  addressing detail, not a game change.
- PNG → JPEG quality 80 via Pillow only (format conversion, no crop/resize/edit)
  into `screenshots/<name>.jpg`, overwriting the Fase 3 files.

## Shot list and live DOM values (measured)

Values read from the live DOM via `Runtime.evaluate` after the 2.5 s settle, in
this order: `1-chase`, `2-steal`, `3-fare`, `4-sunset`.

### 1-chase (`?shot=chase&seed=1`)
- cash `25,010`; wanted stars `★★★☆☆` (`WANTED 3`); speed `86` KM/H
- banner `FARE 4/4 · HIDEOUT · GETAWAY`; objective `Lose the Azura Police, then reach the hideout`
- `SCORE 25`; toast `NEAR MISS +$10` (toast visible)
- response lists **4** cruisers `UNIT 7 · 9m · RAMMING`, `UNIT 12 · 7m · RAMMING`,
  `UNIT 23 · 9m · RAMMING`, `UNIT 31 · 8m · RAMMING`, plus `AIR 1 · OVERHEAD · SEARCHLIGHT`
- MARA line `Rico, lose the Azura Police before you come home.`
- world: `policeCars=4`, helicopter active/visible, `trafficCars=10`,
  `pedestrians=14`, player in car, active vehicle is the taxi.

### 2-steal (`?shot=steal&seed=1`)
- toast `VEHICLE STOLEN` (visible); wanted stars `★☆☆☆☆` (`WANTED 1`)
- cash `250`; `SCORE 50`; speed `0` KM/H
- banner `FARE 1/4 · PICKUP · FIRST FARE`; objective `Pick up the fare at the amber marker`
- MARA line `Rico, take the cab. Your fare is waiting at the amber marker.`
- world: player **not** in car and visible (beside the parked car), active vehicle null;
  `policeCars=2` (both `SEARCHING`), `trafficCars=10`, `pedestrians=14`.

### 3-fare (`?shot=fare&seed=1`)
- cash `2,600`; wanted `WANTED 0`; speed `65` KM/H
- banner `FARE 3/4 · DESTINATION · PALM BOULEVARD`; timer `01:15 · STAGE 2/4`
- MARA line `Passenger aboard. Keep moving, Rico.`
- world: player in taxi, `trafficCars=10`, `pedestrians=14`; minimap draws the
  dashed route to the target.

### 4-sunset (`?shot=sunset&seed=1`)
- cash `5,200`; wanted `WANTED 0`; speed `72` KM/H
- banner `FARE 3/4 · DESTINATION · PALM BOULEVARD`
- MARA line `Passenger aboard. Keep moving, Rico.`
- world: player in taxi, `trafficCars=10`, `pedestrians=14`; scene background
  set to the sunset orange.

All four values match the previous build's expected values (chase 25010 / 3 /
86 / 4 police + AIR 1; steal VEHICLE STOLEN / 1 / SCORE 50; fare 65 / 2600 /
FARE 3/4; sunset 72 / 5200). No deviation had to be forced.

## Console / network

Per shot, collected during navigation + settle:

| shot | console errors | uncaught exceptions | external requests | total requests |
| --- | --- | --- | --- | --- |
| 1-chase | 0 | 0 | 0 | 18 |
| 2-steal | 0 | 0 | 0 | 18 |
| 3-fare | 0 | 0 | 0 | 18 |
| 4-sunset | 0 | 0 | 0 | 18 |

All 18 requests per shot are same-origin `127.0.0.1:8081` document/module/asset
loads. No bare `data:`/external fetches were observed. (Chromium emits a
performance-only WebGL driver notice, `GPU stall due to ReadPixels`, as an
`INFO` console line; it is not an error and was excluded from the error count.)

## Image verification

Byte-identity and blank checks (Pillow): all four PNGs have distinct MD5s and
very different colour histograms; the most common colour is 24.2–37.5 % of
pixels (never near-white, never ~97 % white). No image is blank.

Final JPEGs (all `1280x720`, quality 80, no resizing/cropping):

| file | bytes | dimensions | ≤256 KiB |
| --- | --- | --- | --- |
| `screenshots/1-chase.jpg` | 107088 | 1280x720 | yes |
| `screenshots/2-steal.jpg` | 104304 | 1280x720 | yes |
| `screenshots/3-fare.jpg` | 94984 | 1280x720 | yes |
| `screenshots/4-sunset.jpg` | 68725 | 1280x720 | yes |

No quality reduction below 80 was needed. Each JPEG MD5 is unique:
`42a22c23…`, `b6306847…`, `654d7ad1…`, `f9c2f6e9…`. The steal JPEG was
re-rendered in the Phase 5a fix below; its earlier MD5 was `f08a2ee2…`.

## Build gate

Command: `MAKEFUN_OUTPUT_DIR=out node main.ts`
Result: **PASS** — exit code `0`. It copied `game/` and the four new
screenshots into `out/` and wrote `out/dossier.json` (`580678` bytes).

## Dossier check

`/tmp/rebuild_dossier.mjs` imports `buildDossier` from
`vendor/makefun-game.ts`, calls it on `out/` with the same caps `main.ts` uses
(`text_max_bytes: 163840`, `screenshots: { max: 4, max_bytes: 262144 }`,
`game_max_files: 993`, `game_max_bytes: 50331648`, `game_path_max_bytes: 1000`)
and compares bytes:
```
rebuilt bytes: 580678
on-disk bytes: 580678
IDENTICAL: true
```
Result: **PASS**.

## Manual gate counts (RULES.txt limits)

- game/ entries: `21` (`19` files + `2` dirs) — limit `≤993`. **PASS**
- game/ total bytes: `694453` (≈0.66 MiB) — limit `≤50331648` (48 MiB). **PASS**
- symlinks in `game/` and `screenshots/`: `0`. **PASS**
- longest path under `game/`: well under 1000 bytes. **PASS**
- `game/index.html` bytes: `8467` (< 1 MiB). **PASS**
- Largest game file: `game/vendor/three.min.js` = `608081` bytes.
- screenshots/: `4` JPEGs, each `1280x720`, all `≤262144` bytes. **PASS**

## js_parses

Command: `for f in game/src/*.js; do node --check "$f"; done`
Result: **PASS** — all `16` files report OK.

## FARE-LOOP-OK / SAVE-OK

**NOT RE-RUN in this phase.** The Phase 4 task is limited to the four named
shots (`chase`, `steal`, `fare`, `sunset`). The `?shot=loop` and `?shot=getaway`
harnesses exist in `game/src/shots.js` and were exercised in the earlier
session's capture path, but are not part of this capture run.

## Actual visual review

I opened all four saved JPEGs with the image viewer in this session and looked
at them. They show the open world: buildings, roads, palms, HUD, minimap,
mission banner, MARA dialogue, traffic/pedestrians, police cruisers and the AIR 1
helicopter in the chase shot, the stolen-car toast and Rico standing beside the
car in the steal shot, the passenger/destination HUD in the fare shot, and the
orange coastal sunset with taxi and traffic in the sunset shot. No image is
blank or composited.

## Deviations from the plan

- The capture script uses `127.0.0.1` instead of `localhost` in the navigation
  URL (IPv4-only server; `localhost` resolved to `::1` in Chromium and failed).
  No game source was changed.
- Chromium 159 required `--use-angle=swiftshader --enable-unsafe-swiftshader`
  (the older `--use-gl=swiftshader` alone produced `GL_VENDOR = Disabled` and a
  white frame). This is a launch-flag difference only.
- No game source file was edited for shot staging; the build gate was re-run
  after the captures regardless.

## Changed files this session

- `screenshots/1-chase.jpg`, `2-steal.jpg`, `3-fare.jpg`, `4-sunset.jpg`
  (new real renders).
- `PLAYTEST.md` (this evidence update).
- `out/` is gitignored.
- No commit, no recorder stop, no submit/seal.

## Phase 5a — steal-shot lamp-post fix (2026-11-19)

Only the `steal` staging and `screenshots/2-steal.jpg` changed. No other shot
staging or screenshot was touched.

### Staging change

`game/src/shots.js`, `stageShot('steal')`: the parked car moved from
`(-3.3, 25)` to `(-3.3, 14)` and Rico's starting spot from `(-6.1, 25)` to
`(-6.1, 14)`, i.e. midway between the lamp rows at `z = 0` and `z = 28`.
Nothing else in the case changed; the existing enter-car step still leaves Rico
beside the car at `(parked.x + 3.2, parked.z + 1)`, which becomes `(-0.1, 15)`.

### Sightline calculation

Scratch script `~/workspace/makefun/gta6-build/steal-sightline.mjs` (outside
the repo) computed the perpendicular distance from every lamp post to the
camera→Rico segment, using the exact `lookCamera` formulas:
`horizontal = distance * cos(pitch)`, `camX = target.x - horizontal * sin(yaw)`,
`camZ = target.z - horizontal * cos(yaw)`, `camY = 2 + distance * sin(pitch)`,
with `pitch = 0.08` and `distance = 15` (`VIEW.carDistance`), `yaw = PI/2`, as
requested. Lamp posts were tested on the task's `x/z ∈ grid ± 8` lattice and
again on the actual `pavementInset = 12/2 + 3/2 = 7.5` lattice.

| camera model | target | nearest lamp (task lattice) | nearest lamp (actual 7.5 lattice) | lamps < 2.5 |
| --- | --- | --- | --- | --- |
| old, carDistance 15 / yaw PI/2 | `(-6.1, 25)` | `(-8, 28)` — 3.000 | `(-7.5, 28)` — 3.500 | 0 |
| new, carDistance 15 / yaw PI/2 | `(-6.1, 14)` | `(0, 8)` — 8.556 | `(0, 7.5)` — 8.143 | 0 |
| old, **actual rendered** footDistance 12 / yaw `atan2(-3.2, -1)` | `(-0.1, 26)` | `(7.5, 28)` — **0.358** | same | **1** |
| new, **actual rendered** footDistance 12 / yaw `atan2(-3.2, -1)` | `(-0.1, 15)` | `(0, 7.5)` — 7.501 | same | 0 |

The requested z = 14 check **passes** (no lamp within 2.5). It also explains the
original artifact more precisely than the pre-stage model: after the steal step
Rico faces the car at yaw `atan2(-3.2, -1) ≈ -1.874` and the camera uses
`VIEW.footDistance = 12`, which put the old frame's sightline 0.358 m from the
lamp at `(7.5, 28)`. At z = 14 the same sightline is 7.501 m from the nearest
lamp. The staged z = 14 therefore clears both camera models, so no alternative
z/x offset was needed.

### Re-capture

One-shot script `~/workspace/makefun/gta6-build/capture-steal.mjs` (outside the
repo) used the proven Playwright Chromium headless shell
(`chromium_headless_shell-1255/…/chrome-headless-shell`) with
`--headless=new --remote-debugging-port=9333 --no-sandbox --disable-gpu
--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
--window-size=1280,720 --hide-scrollbars` and a fresh `/tmp` profile. It loaded
`http://127.0.0.1:8081/?shot=steal&seed=1` through the repo's
`node serve.ts --port 8081`, waited 2.5 s real time after load, then
`Page.captureScreenshot`. The PNG was converted to JPEG quality 80 with Pillow
only (no crop or resize).

- DOM after settle: toast `VEHICLE STOLEN` visible; `WANTED 1`; cash `250`;
  `SCORE 50`; `FARE 1/4 · PICKUP · FIRST FARE`; Rico visible, not in a car,
  `vehicles.active = null` — unchanged from the Phase 4 values.
- Console/network: 0 console errors, 0 uncaught exceptions, 0 external
  requests, 18 same-origin requests.
- Rico framing: root projects to `(640.0, 439.1)` px, chest to
  `(640.0, 386.6)` px; `playerInFrame = true`.
- Lamp check, occlusion-aware (`verify-steal.mjs`): 120 lamp posts, 360
  camera→post ray samples. Only **2** posts are visible in frame: one at
  `(828.8, 314.9)` px (`ndcX = +0.295`, 189 px right of centre) and one at the
  far-left edge `(20.5, 381.5)` px. **0 visible posts** fall in the centre band
  `|ndcX| < 0.12`. (The `(-28, 7.5)` post that projects near 659 px is fully
  occluded by a building; every ray to it hits a facade first.)
- File verification (Pillow): `screenshots/2-steal.jpg` is **1280×720**,
  **104304 bytes** (`≤ 262144`), MD5 `b6306847acd7ec951ee014711d0f3713`,
  different from the old `f08a2ee2fb01b4fcd45ff67664b670d3`. Mean RGB
  `(154.5, 163.2, 157.4)`; most common colour 14.1 % of pixels; near-white
  9.2 % — not blank and not white.
- Visual check: the new JPEG was opened and inspected; Rico and the stolen car
  are centred and unobstructed, with no lamp post running through the frame
  centre.

### Build gate

`MAKEFUN_OUTPUT_DIR=out node main.ts` → **exit code 0**; `out/dossier.json`
written (`587794` bytes). `node --check game/src/shots.js` passes.
No commit, no recorder stop, no submit/seal.

## Phase 5b — Getaway proof attempt (2026-11-19): **GETAWAY-FAIL**

Run through the proven Playwright Chromium headless shell
(`chromium_headless_shell-1255/…/chrome-headless-shell`) with
`--headless=new --remote-debugging-port=9222 --no-sandbox --disable-gpu
--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
--window-size=1280,720 --hide-scrollbars`, a fresh `/tmp` profile, and the
repo's `node serve.ts --port 8081`. CDP (Node global `WebSocket`) enabled
`Runtime`, `Page` and `Log`, collected every console line, and navigated to
`http://127.0.0.1:8081/?shot=getaway&seed=1`. Script:
`~/workspace/makefun/gta6-build/run-getaway.mjs`; raw console:
`~/workspace/makefun/gta6-build/getaway-console.log`. Wall-clock wait cap: 330 s.

### Run 1 (before any source fix)

Terminal console line:

```
GETAWAY-FAIL steps=9000 phase=pickup wanted=0 fares=3
```

The trace showed the taxi orbiting `(-112,0)` for the full 9000 steps with
`wanted=0`, `nearestPolice=Infinity`, `phase=pickup`, and no fares completed.
Diagnosis: `world.reset()` did `missions.state = initialMission()`, replacing the
object exposed to staging, while `createMissions()`'s `update` closure kept
reading the original state object. `stageShot('getaway')` therefore staged
`fares: 3` / `getaway: true` on an object the simulation never read, so the
getaway never started.

### The one source fix

`game/src/main.js`, `reset()`:

```diff
-    missions.state = initialMission();
+    // Mutate the existing mission state: createMissions' update closure holds
+    // this object, so replacing it would stage a state the simulation ignores.
+    Object.assign(missions.state, initialMission());
```

This is a state-plumbing fix, not a rules change: it keeps the mission object
identity stable so the real simulation, save/restore and shot staging all see
the same state. `missions.js` success conditions were not touched (hideout
still requires close + `wanted === 0`; the getaway still completes only after
`fares === 4`). No toast/state injection was added to `stageShot`.

### Run 2 (the single re-test after the fix)

The chase now starts (`phase=hideout`, `wanted=1`) and the full captured trace
is:

```
GETAWAY-TRACE step=600 car=-109.5,-67.8 yaw=3.16 speed=6.7 target=112,56 wanted=1 nearestPolice=51.4 phase=hideout
GETAWAY-ROUTE step=600 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=1200 car=-110.6,-81.8 yaw=3.81 speed=0.1 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=1200 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=1800 car=-140.0,-91.2 yaw=4.33 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=1800 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=2400 car=-140.0,-91.8 yaw=4.29 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=2400 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=3000 car=-140.0,-92.6 yaw=4.18 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=3000 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=3600 car=-140.0,-93.5 yaw=4.06 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=3600 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=4200 car=-140.0,-94.6 yaw=3.92 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=4200 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=4800 car=-140.0,-95.9 yaw=3.79 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=4800 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=5400 car=-140.0,-97.3 yaw=3.67 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=5400 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=6000 car=-140.0,-98.8 yaw=3.57 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=6000 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=6600 car=-140.0,-100.3 yaw=3.48 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=6600 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=7200 car=-140.0,-101.9 yaw=3.41 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=7200 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=7800 car=-140.0,-103.5 yaw=3.36 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=7800 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=8400 car=-140.0,-105.1 yaw=3.32 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=8400 waypoint=-112,-112 quiet=0.00
GETAWAY-TRACE step=9000 car=-140.0,-106.8 yaw=3.28 speed=0.0 target=112,56 wanted=1 nearestPolice=6.0 phase=hideout
GETAWAY-ROUTE step=9000 waypoint=-112,-112 quiet=0.00
GETAWAY-FAIL steps=9000 phase=hideout wanted=1 fares=3
```

Post-run live state confirmed the same:
`{"cash":10,"wanted":1,"quiet":0,"phase":"hideout","fares":3,
"car":{"x":-140,"z":-106.795…,"speed":0},"police":[three units ≈(-139.4,-100.8)]}`.

Diagnosis: after the chase starts, the taxi is pushed to the western world
clamp (`x=-140`) by the three pursuing cruisers; `vehicles.drive()` zeroes
speed on every clamped step, while the autopilot's peel-away branch only holds
`KeyW` because the cruiser sits almost directly behind. The cruisers hold
their 6 m `STANDOFF`, so `wanted` never falls below 1 and the taxi never
reaches the hideout. This is the same boundary/box-in stall described in the
task background, now reproduced with a complete trace.

Per the session's explicit one-fix-only rule, no second fix was attempted and
this is the final result: **GETAWAY-FAIL**. No `GETAWAY-OK` line was ever
emitted; nothing was injected or staged to fake one.

### Build gate after the fix

`MAKEFUN_OUTPUT_DIR=out node main.ts` → **exit code 0**.
`node --check game/src/main.js` passes.

Changed files: `game/src/main.js` (the one fix), `PLAYTEST.md` (this record).
No commit, no recorder stop, no submit/seal.

## Phase 5c — Adversarial self-review, final gates, commit (2026-11-19)

Final build phase. No speculative rework; every number below comes from a command
run in this phase.

### Adversarial self-review (scored by the build agent, no judge skill read)

| category | score | notes |
| --- | --- | --- |
| Rule Compliance | 9.0 / 10 | Deliverables, gate, offline-only, original content, real renders all satisfied (evidence below). |
| Originality / Hook | 8.5 / 10 | Own city (Port Azura), cast (Rico, MARA dispatch, Azura Police), brands (RADIO AZURA 101.9), a low-poly coastal art direction and a taxi-fare-to-getaway hook. |
| Clarity / Impact | 8.5 / 10 | HUD, mission banner, MARA dialogue and minimap read at a glance; the open world (traffic, pedestrians, police, helicopter, sunset coast) is visible in the shots. |

**Clarity fix (the one sub-8.5 issue found).** Before the fix, shots 3-fare and
4-sunset showed an empty "AZURA POLICE RESPONSE" panel — a lone header with no
units, which reads as a broken HUD rather than a quiet city (original Clarity
score 8.0). The single highest-impact safe change: hide the response panel when
no unit is reporting.

`game/src/hud.js`, `update()`:

```diff
-    write('response', ['AZURA POLICE RESPONSE'].concat(reports).join('\n'));
+    // Keep the panel off the screen while no unit is responding: a lone header
+    // reads as a broken HUD rather than as a quiet city.
+    nodes.response.hidden = reports.length === 0;
+    write('response', reports.length ? ['AZURA POLICE RESPONSE'].concat(reports).join('\n') : '');
```

The panel now appears only when there is a cruiser or helicopter to list
(still present and populated in 1-chase and 2-steal, gone in 3-fare and
4-sunset). The affected shots (all four, recaptured for consistency) were
re-rendered and re-verified; Clarity re-scores to 8.5.

### main.ts authored line

Exactly one comment line added to `main.ts`, nothing else in that file:

```diff
+// Port Azura rebuild: this entrypoint copies game/ and screenshots/ and writes the dossier.
```

### Final gates

1. `node --check` on every `game/src/*.js` — **PASS** (16 files, exit 0).
2. `MAKEFUN_OUTPUT_DIR=out node main.ts` — **PASS** (exit 0; `out/dossier.json` 541778 bytes).
3. Dossier rebuild byte-identical — **PASS**:
   ```
   rebuilt bytes: 541778
   on-disk bytes: 541778
   IDENTICAL: true
   ```
4. Screenshots — **PASS**: exactly 4 JPGs, each 1280x720, all ≤ 262144 bytes:

   | file | bytes | dimensions | ≤256 KiB |
   | --- | --- | --- | --- |
   | `screenshots/1-chase.jpg` | 98999 | 1280x720 | yes |
   | `screenshots/2-steal.jpg` | 97369 | 1280x720 | yes |
   | `screenshots/3-fare.jpg` | 85146 | 1280x720 | yes |
   | `screenshots/4-sunset.jpg` | 58784 | 1280x720 | yes |

5. `git diff --check` — **PASS** (clean).
6. `?shot=loop` in the browser — **PASS**:
   ```
   [log] FARE-LOOP-OK cash=40 fares=1
   [log] SAVE-OK
   ```

### Fresh capture (Phase 5c)

All four shots recaptured with the proven Playwright Chromium headless shell
(`chromium_headless_shell-1255/…/chrome-headless-shell`), `--headless=new
--remote-debugging-port=9222 --no-sandbox --disable-gpu --use-gl=angle
--use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720
--hide-scrollbars`, a fresh `/tmp` profile, served by the repo's
`node serve.ts --port 8081`, navigated at `http://127.0.0.1:8081`. PNG→JPEG
quality 80 with Pillow only (no crop/resize).

| shot | console errors | uncaught exceptions | external requests | total requests |
| --- | --- | --- | --- | --- |
| 1-chase | 0 | 0 | 0 | 18 |
| 2-steal | 0 | 0 | 0 | 18 |
| 3-fare | 0 | 0 | 0 | 18 |
| 4-sunset | 0 | 0 | 0 | 18 |

Live DOM values matched the Phase 4 expectations (chase 25010 / WANTED 3 / 86 /
4 cruisers + AIR 1; steal VEHICLE STOLEN / WANTED 1 / SCORE 50; fare 2600 / 65 /
FARE 3/4; sunset 5200 / 72). New screenshot MD5s: `146e2b62…`, `c44a9120…`,
`b85f37dc…`, `601bd497…` — all distinct.

### Getaway status

**GETAWAY-FAIL**, unchanged from Phase 5b and honestly reported. The
`?shot=getaway` autopilot still pins the taxi against the western world clamp
while the pursuit holds a 6 m stand-off, so `wanted` never clears and the
hideout is never reached. The full trace and diagnosis are in the Phase 5b
section above. This limitation does not block submission; it was not re-fixed
in this phase.

### Changed files this phase

- `game/src/hud.js` (response panel hidden when empty).
- `main.ts` (one authored comment line).
- `screenshots/1-chase.jpg`, `2-steal.jpg`, `3-fare.jpg`, `4-sunset.jpg`
  (recaptured real renders).
- `PLAYTEST.md` (this record).
- No commit, no recorder stop, no submit/seal.
