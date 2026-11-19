import { PALETTE, VIEW } from './config.js';

// Build the renderer, scene, camera and the two lights the city relies on.
// The canvas is created here and dropped in front of the HUD so the page
// markup never has to know about WebGL setup.
export function createRenderer() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.sky, VIEW.fogNear, VIEW.fogFar);

  const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, VIEW.near, VIEW.far);
  camera.position.set(VIEW.titlePosition[0], VIEW.titlePosition[1], VIEW.titlePosition[2]);
  camera.lookAt(VIEW.titleLook[0], VIEW.titleLook[1], VIEW.titleLook[2]);

  const hemisphere = new THREE.HemisphereLight('#ecfaff', PALETTE.grass, 0.85);
  const sunlight = new THREE.DirectionalLight('#fff0d2', 0.85);
  sunlight.position.set(-90, 150, 70);
  scene.add(hemisphere, sunlight);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;

  const canvas = renderer.domElement;
  canvas.id = 'world-canvas';
  canvas.setAttribute('aria-label', 'Port Azura city');
  document.body.prepend(canvas);

  function resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(VIEW.pixelRatio, window.devicePixelRatio || 1));
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera, sunlight, hemisphere };
}

// Chase camera. Yaw zero faces +z, so the camera hangs on the -z side of the
// target; pitch lifts it up. The position is eased toward the goal so motion
// stays smooth, while the look target snaps.
export function lookCamera(camera, target, distance, yaw, pitch, smooth = 0.12) {
  const base = target.y ?? 0;
  const horizontal = distance * Math.cos(pitch);
  const goalX = target.x - horizontal * Math.sin(yaw);
  const goalY = base + VIEW.height + distance * Math.sin(pitch);
  const goalZ = target.z - horizontal * Math.cos(yaw);

  const blend = THREE.MathUtils.clamp(smooth, 0, 1);
  camera.position.x += (goalX - camera.position.x) * blend;
  camera.position.y += (goalY - camera.position.y) * blend;
  camera.position.z += (goalZ - camera.position.z) * blend;

  camera.lookAt(target.x, base + 1.5, target.z);
}
