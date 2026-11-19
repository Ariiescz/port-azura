import { CAR, HUD, WORLD } from './config.js';

const CHAPTERS = ['FIRST FARE', 'MARINA RUN', 'PALM BOULEVARD', 'GETAWAY'];
const IDS = [
  'hud', 'resume', 'title', 'minimap', 'banner', 'objective', 'timer',
  'progress', 'stars', 'wanted-text', 'cash', 'score', 'response', 'kmh',
  'gauge', 'speaker', 'line', 'location', 'toast'
];

export function createHUD() {
  const nodes = {};
  for (const id of IDS) nodes[id] = document.getElementById(id);

  const buffer = nodes.progress.querySelector('i');
  const mapSize = HUD.mapSize;
  const scale = mapSize / (WORLD.half * 2 + 24);
  const project = value => mapSize / 2 + value * scale;

  nodes.minimap.width = mapSize;
  nodes.minimap.height = mapSize;
  const pen = nodes.minimap.getContext('2d');

  const write = (id, text) => { nodes[id].textContent = text; };

  function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
  }

  function clockText(seconds) {
    const whole = Math.max(0, Math.floor(seconds));
    const minutes = String(Math.floor(whole / 60)).padStart(2, '0');
    const rest = String(whole % 60).padStart(2, '0');
    return `${minutes}:${rest}`;
  }

  function minimap(world) {
    if (!pen) return;
    pen.clearRect(0, 0, mapSize, mapSize);
    pen.save();
    pen.beginPath();
    pen.arc(mapSize / 2, mapSize / 2, mapSize / 2, 0, Math.PI * 2);
    pen.clip();
    pen.fillStyle = '#1b3438';
    pen.fillRect(0, 0, mapSize, mapSize);

    pen.strokeStyle = '#68797a';
    pen.lineWidth = WORLD.road * scale;
    pen.beginPath();
    for (const line of WORLD.grid) {
      const at = project(line);
      pen.moveTo(at, 0);
      pen.lineTo(at, mapSize);
      pen.moveTo(0, at);
      pen.lineTo(mapSize, at);
    }
    pen.stroke();

    const target = world.missions.state.target;
    if (target) {
      pen.strokeStyle = '#ffc342';
      pen.lineWidth = 1.5;
      pen.setLineDash([5, 3]);
      pen.beginPath();
      pen.moveTo(project(world.player.x), project(world.player.z));
      pen.lineTo(project(target.x), project(target.z));
      pen.stroke();
      pen.setLineDash([]);
      pen.save();
      pen.translate(project(target.x), project(target.z));
      pen.rotate(Math.PI / 4);
      pen.fillStyle = '#ffc342';
      pen.fillRect(-3, -3, 6, 6);
      pen.restore();
    }

    const dot = (actor, radius, colour) => {
      pen.fillStyle = colour;
      pen.beginPath();
      pen.arc(project(actor.x), project(actor.z), radius, 0, Math.PI * 2);
      pen.fill();
    };
    for (const car of world.vehicles.cars.concat(world.traffic.cars)) {
      if (car !== world.vehicles.active) dot(car, 2, '#ece3c8');
    }
    for (const unit of world.police.cars) dot(unit, 3, '#469eff');
    dot(world.player, 3, '#ffffff');
    pen.restore();
  }

  function update(world, playing) {
    const job = world.missions.state;
    const heat = clamp(Math.floor(world.wanted.level), 0, HUD.stars);
    const stage = job.phase === 'pickup' ? 1 : job.phase === 'destination' ? 2 : heat ? 3 : 4;
    const chapter = CHAPTERS[((job.job - 1) % 4 + 4) % 4];

    write('banner', `FARE ${job.job}/4 · ${job.phase.toUpperCase()} · ${chapter}`);
    write('objective', world.objective);
    write('timer', `${clockText(job.timer)} · STAGE ${stage}/4`);
    buffer.style.width = `${stage * 25}%`;

    write('stars', '★'.repeat(heat) + '☆'.repeat(HUD.stars - heat));
    write('wanted-text', `WANTED ${heat}`);

    write('cash', world.state.cash.toLocaleString('en-US'));
    write('score', `SCORE ${world.score}`);

    const reports = world.police.cars.map(unit => {
      const distance = Math.hypot(unit.x - world.player.x, unit.z - world.player.z);
      const state = distance <= 10 ? 'RAMMING' : distance <= 30 ? 'PURSUIT' : 'SEARCHING';
      return `${unit.callsign} · ${Math.round(distance)}m · ${state}`;
    });
    if (world.helicopter.active && world.helicopter.root.visible) {
      reports.push('AIR 1 · OVERHEAD · SEARCHLIGHT');
    }
    // Keep the panel off the screen while no unit is responding: a lone header
    // reads as a broken HUD rather than as a quiet city.
    nodes.response.hidden = reports.length === 0;
    write('response', reports.length ? ['AZURA POLICE RESPONSE'].concat(reports).join('\n') : '');

    const speed = Math.abs(world.vehicles.active ? world.vehicles.active.speed : 0);
    write('kmh', Math.round(speed * HUD.kmh));
    nodes.gauge.style.width = `${Math.min(100, speed / CAR.max * 100)}%`;

    write('speaker', 'MARA — DISPATCH');
    let line = 'Rico, take the cab. Your fare is waiting at the amber marker.';
    if (job.getaway) line = 'Rico, lose the Azura Police before you come home.';
    if (job.phase === 'destination') line = 'Passenger aboard. Keep moving, Rico.';
    write('line', line);

    write('location', world.player.z < -45 ? 'MARINA ROW' : world.player.x > 48 ? 'PALM BOULEVARD' : 'SUNSET QUAY');

    write('toast', world.toast);
    nodes.toast.hidden = !world.toast;
    nodes.hud.dataset.playing = String(playing);

    minimap(world);
  }

  return {
    update,
    hideTitle() { nodes.title.classList.add('hidden'); },
    onResume(callback) { nodes.resume.onclick = callback; }
  };
}
