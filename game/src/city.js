import { PALETTE, PLAYER, WORLD } from './config.js';

// ---------------------------------------------------------------------------
// Port Azura city builder.
//
// Everything is assembled from THREE primitives plus a couple of procedural
// canvas textures, so the whole world is code with no external assets. The
// function returns a layout description (roads, pavements, building colliders
// and a set of navigation spawn points) that later systems read back.
// ---------------------------------------------------------------------------

export function buildCity(scene, random) {
  const layout = {
    roads: [],
    sidewalks: [],
    buildings: [],
    spawnPoints: [{ ...PLAYER.spawn }]
  };

  const span = WORLD.half * 2;
  const roadHalf = WORLD.road / 2;
  const pavementInset = roadHalf + WORLD.sidewalk / 2;

  // Material cache: one lambert material per colour keeps the draw list small.
  const materials = new Map();
  const facades = new Map();

  function materialFor(colour) {
    let found = materials.get(colour);
    if (!found) {
      found = new THREE.MeshLambertMaterial({ color: colour });
      materials.set(colour, found);
    }
    return found;
  }

  function addBox(width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  }

  // A building skin: the base colour tiled with a window grid and a sill line.
  function facadeFor(colour) {
    let found = facades.get(colour);
    if (found) return found;

    const size = WORLD.textureSize;
    const tile = document.createElement('canvas');
    tile.width = size;
    tile.height = size;
    const ctx = tile.getContext('2d');
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, size, size);

    const cell = size / 4;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const px = col * cell + cell * 0.26;
        const py = row * cell + cell * 0.2;
        ctx.fillStyle = PALETTE.window;
        ctx.fillRect(px, py, cell * 0.48, cell * 0.55);
        ctx.fillStyle = PALETTE.stripe;
        ctx.fillRect(px - 1, py + cell * 0.55, cell * 0.48 + 2, 1);
      }
    }

    const texture = new THREE.CanvasTexture(tile);
    texture.encoding = THREE.sRGBEncoding;
    texture.magFilter = THREE.NearestFilter;
    found = new THREE.MeshLambertMaterial({ map: texture });
    facades.set(colour, found);
    return found;
  }

  // A road strip runs the full map length along one axis. `across` is the
  // fixed coordinate (the grid line), `along` is the free coordinate.
  function stripRect(axis, across, along, acrossWidth, alongLength) {
    return axis === 0
      ? { x: across, z: along, w: acrossWidth, d: alongLength }
      : { x: along, z: across, w: alongLength, d: acrossWidth };
  }

  function pave(rect, thickness, colour) {
    addBox(rect.w, thickness, rect.d, rect.x, thickness / 2, rect.z, materialFor(colour));
  }

  function nearCrossing(coordinate, clearance) {
    return WORLD.grid.some(line => Math.abs(coordinate - line) < roadHalf + clearance);
  }

  // The gaps between crossings, used to slice pavement and dashes.
  const clearSpans = [];
  {
    const cuts = [-WORLD.half];
    for (const line of WORLD.grid) {
      cuts.push(line - roadHalf, line + roadHalf);
    }
    cuts.push(WORLD.half);
    for (let i = 0; i < cuts.length; i += 2) {
      clearSpans.push([cuts[i], cuts[i + 1]]);
    }
  }

  // --- Ground slabs ------------------------------------------------------
  // Water is the widest plate; sand is the shoreline ring; grass is the map.
  addBox(1000, 0.2, 1000, 0, -0.8, 0, materialFor(PALETTE.water));
  const shore = span + WORLD.beach * 2;
  addBox(shore, 0.3, shore, 0, -0.45, 0, materialFor(PALETTE.sand));
  addBox(span, 0.3, span, 0, -0.15, 0, materialFor(PALETTE.grass));

  // --- Roads, pavements, dashes, lamps -----------------------------------
  for (const axis of [0, 1]) {
    for (const line of WORLD.grid) {
      const road = stripRect(axis, line, 0, WORLD.road, span);
      layout.roads.push(road);
      pave(road, 0.06, PALETTE.road);

      for (const side of [-1, 1]) {
        const offset = line + side * pavementInset;

        // Pavement is split at every crossing so it never sits on asphalt.
        for (const [start, end] of clearSpans) {
          const pavement = stripRect(axis, offset, (start + end) / 2, WORLD.sidewalk, end - start);
          layout.sidewalks.push(pavement);
          pave(pavement, 0.16, PALETTE.sidewalk);
        }

        // Lamps stand every 28 m, skipping the junction mouths.
        for (let along = -140; along <= 140; along += 28) {
          if (nearCrossing(along, 3)) continue;
          const spot = axis === 0
            ? { x: offset, z: along }
            : { x: along, z: offset };
          addBox(0.16, WORLD.lampHeight, 0.16, spot.x, WORLD.lampHeight / 2, spot.z, materialFor(PALETTE.lamp));
          const head = axis === 0
            ? { w: 1.1, d: 0.45, x: offset - side * 0.4, z: along }
            : { w: 0.45, d: 1.1, x: along, z: offset - side * 0.4 };
          addBox(head.w, 0.2, head.d, head.x, WORLD.lampHeight, head.z, materialFor(PALETTE.stripe));
          layout.spawnPoints.push(spot);
        }
      }

      // Broken centre line, also interrupted at crossings.
      for (let along = -WORLD.half + 6; along < WORLD.half; along += 12) {
        if (nearCrossing(along, 4)) continue;
        const dash = stripRect(axis, line, along, 0.2, 4.5);
        addBox(dash.w, 0.012, dash.d, dash.x, 0.07, dash.z, materialFor(PALETTE.stripe));
      }
    }
  }

  // --- Buildings ---------------------------------------------------------
  // Each inter-road block holds four towers offset from the block centre.
  const blockCentres = [];
  for (let i = 0; i < WORLD.grid.length - 1; i++) {
    blockCentres.push((WORLD.grid[i] + WORLD.grid[i + 1]) / 2);
  }

  for (const centreZ of blockCentres) {
    for (const centreX of blockCentres) {
      const corners = [
        { dx: -9, dz: -9 },
        { dx: 9, dz: -9 },
        { dx: -9, dz: 9 },
        { dx: 9, dz: 9 }
      ];
      for (const corner of corners) {
        const x = centreX + corner.dx;
        const z = centreZ + corner.dz;
        const height = WORLD.buildingMin + WORLD.buildingRange * random();
        const width = WORLD.buildingWidth - 3 * random();
        const depth = WORLD.buildingWidth - 3 * random();
        const colour = PALETTE.buildings[Math.floor(random() * PALETTE.buildings.length)];

        addBox(width, height, depth, x, height / 2, z, facadeFor(colour));
        // Thin roof cap that overhangs the walls a touch.
        addBox(width + 0.35, 0.24, depth + 0.35, x, height + 0.12, z, materialFor(PALETTE.sidewalk));

        layout.buildings.push({ x, z, w: width / 2 + 1, d: depth / 2 + 1 });
      }
    }
  }

  // --- Palm ring ---------------------------------------------------------
  const trunkShape = new THREE.CylinderGeometry(0.19, 0.3, WORLD.palmHeight, 6);
  const frondShape = new THREE.BoxGeometry(3.7, 0.16, 0.8);
  const trunkMaterial = materialFor(PALETTE.trunk);
  const frondMaterial = materialFor(PALETTE.leaf);

  for (let i = 0; i < 18; i++) {
    const bearing = (i / 18) * Math.PI * 2;
    const palm = new THREE.Group();
    palm.position.set(Math.sin(bearing) * 140, 0, Math.cos(bearing) * 140);

    const trunk = new THREE.Mesh(trunkShape, trunkMaterial);
    trunk.position.y = WORLD.palmHeight / 2;
    palm.add(trunk);

    for (let f = 0; f < 5; f++) {
      const crown = new THREE.Group();
      crown.position.y = WORLD.palmHeight;
      crown.rotation.y = (f / 5) * Math.PI * 2;
      const frond = new THREE.Mesh(frondShape, frondMaterial);
      frond.position.set(1.6, -0.2, 0);
      frond.rotation.z = -0.18;
      crown.add(frond);
      palm.add(crown);
    }
    scene.add(palm);
  }

  return layout;
}
