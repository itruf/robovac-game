import * as THREE from 'three';

/* ============================================================
   RoboVac: Home Sweet Home
   A 3D robot-vacuum game. Drive, clean, befriend the pets.
   ============================================================ */

// ---------- Renderer / Scene / Camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c2233);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Lights ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6b5a44, 0.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
sun.position.set(9, 16, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
sun.shadow.camera.far = 50;
sun.shadow.bias = -0.0004;
scene.add(sun);

// ---------- Helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * clamp(t, 0, 1);
}

// ---------- Audio (tiny WebAudio synth, no assets) ----------
let AC = null, humGain = null;
function initAudio() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  const osc = AC.createOscillator();
  osc.type = 'triangle'; osc.frequency.value = 72;
  humGain = AC.createGain(); humGain.gain.value = 0;
  osc.connect(humGain).connect(AC.destination);
  osc.start();
}
function beep(freq = 880, dur = 0.08, type = 'square', vol = 0.05, delay = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(AC.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  pickup: () => beep(rand(900, 1100), 0.06, 'square', 0.035),
  horn: () => { beep(620, 0.12, 'square', 0.06); beep(520, 0.14, 'square', 0.06, 0.1); },
  pet: () => { beep(700, 0.1, 'sine', 0.05); beep(900, 0.12, 'sine', 0.05, 0.09); },
  bump: () => beep(160, 0.08, 'sawtooth', 0.04),
  mission: () => { [660, 880, 1100, 1320].forEach((f, i) => beep(f, 0.12, 'triangle', 0.06, i * 0.11)); },
  lowBatt: () => beep(300, 0.15, 'sine', 0.05),
  dock: () => { beep(440, 0.1, 'sine', 0.05); beep(660, 0.12, 'sine', 0.05, 0.1); },
};

// ---------- Text sprites (speech bubbles & floaty scores) ----------
const texCache = new Map();
function bubbleTexture(text) {
  if (texCache.has(text)) return texCache.get(text);
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = '600 42px -apple-system, "Segoe UI", sans-serif';
  const w = Math.max(120, ctx.measureText(text).width + 56);
  c.width = w; c.height = 110;
  const x = ctx;
  x.font = '600 42px -apple-system, "Segoe UI", sans-serif';
  // bubble
  x.fillStyle = 'rgba(255,255,255,0.95)';
  const r = 26;
  x.beginPath();
  x.roundRect(4, 4, w - 8, 76, r);
  x.fill();
  // tail
  x.beginPath();
  x.moveTo(w / 2 - 12, 78); x.lineTo(w / 2 + 12, 78); x.lineTo(w / 2, 104);
  x.fill();
  x.fillStyle = '#1c2233';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, w / 2, 44);
  const tex = new THREE.CanvasTexture(c);
  tex.userData = { aspect: w / 110 };
  texCache.set(text, tex);
  return tex;
}
function floatTexture(text, color = '#ffd86b') {
  const key = 'f:' + text + color;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.font = '800 64px -apple-system, "Segoe UI", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 10; x.strokeStyle = 'rgba(0,0,0,0.55)';
  x.strokeText(text, 128, 64);
  x.fillStyle = color;
  x.fillText(text, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  texCache.set(key, tex);
  return tex;
}

// floating particles (+10, hearts, etc.)
const floaters = [];
function spawnFloater(text, pos, color) {
  const mat = new THREE.SpriteMaterial({ map: floatTexture(text, color), transparent: true, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.position.copy(pos);
  s.scale.set(0.9, 0.45, 1);
  scene.add(s);
  floaters.push({ s, life: 1.1 });
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt;
    f.s.position.y += dt * 0.9;
    f.s.material.opacity = clamp(f.life / 0.5, 0, 1);
    if (f.life <= 0) { scene.remove(f.s); f.s.material.dispose(); floaters.splice(i, 1); }
  }
}

// ---------- Collision world ----------
const solids = []; // {x0,x1,z0,z1}
function addSolid(cx, cz, w, d) {
  solids.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
}
function collideCircle(p, r) {
  for (const s of solids) {
    const cx = clamp(p.x, s.x0, s.x1);
    const cz = clamp(p.z, s.z0, s.z1);
    let dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      } else {
        // center inside box — push out the nearest face
        const pl = p.x - s.x0, pr = s.x1 - p.x, pt = p.z - s.z0, pb = s.z1 - p.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) p.x = s.x0 - r;
        else if (m === pr) p.x = s.x1 + r;
        else if (m === pt) p.z = s.z0 - r;
        else p.z = s.z1 + r;
      }
    }
  }
  // house bounds
  p.x = clamp(p.x, -9.85 + r, 9.85 - r);
  p.z = clamp(p.z, -6.85 + r, 6.85 - r);
}
function pointClear(x, z, r) {
  if (x < -9.6 + r || x > 9.6 - r || z < -6.6 + r || z > 6.6 - r) return false;
  for (const s of solids) {
    const cx = clamp(x, s.x0, s.x1), cz = clamp(z, s.z0, s.z1);
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) return false;
  }
  return true;
}

// ---------- Rooms ----------
const rooms = {
  living:  { x0: -10, x1: 0,  z0: -7, z1: 1, name: 'Living Room', floor: 0xb08968 },
  kitchen: { x0: 0,   x1: 10, z0: -7, z1: 0, name: 'Kitchen',     floor: 0xd8cfc0 },
  bedroom: { x0: 0,   x1: 10, z0: 0,  z1: 7, name: 'Bedroom',     floor: 0xa58fa0 },
  bath:    { x0: -10, x1: -4, z0: 1,  z1: 7, name: 'Bathroom',    floor: 0x9fc4cc },
  hall:    { x0: -4,  x1: 0,  z0: 1,  z1: 7, name: 'Hallway',     floor: 0xb59b73 },
};
function roomAt(x, z) {
  for (const k in rooms) {
    const r = rooms[k];
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return k;
  }
  return null;
}
const anchors = {
  living:  [[-7.5, -4.5], [-2, -5.5], [-8, 0.2], [-1.5, -0.3], [-2.7, -3]],
  kitchen: [[2, -4.5], [7, -4], [1.5, -1.2], [8.3, -1.5], [6.5, -2.6]],
  bedroom: [[1.5, 1.5], [5, 5.3], [3.2, 3.8], [6.2, 1.4]],
  bath:    [[-8, 2.5], [-6, 5.6], [-5.5, 3]],
  hall:    [[-2.2, 2.4], [-1, 5]],
};
const allAnchors = Object.values(anchors).flat();

// ---------- House ----------
const house = new THREE.Group();
scene.add(house);

// base floor slab
{
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(21.2, 0.3, 15.2),
    new THREE.MeshStandardMaterial({ color: 0x6e5a45 })
  );
  slab.position.y = -0.15;
  slab.receiveShadow = true;
  house.add(slab);
}
// per-room floors
for (const k in rooms) {
  const r = rooms[k];
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0),
    new THREE.MeshStandardMaterial({ color: r.floor, roughness: 0.9 })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set((r.x0 + r.x1) / 2, 0.001, (r.z0 + r.z1) / 2);
  m.receiveShadow = true;
  house.add(m);
}
// rugs (no colliders)
function addRug(x, z, rad, color) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(rad, 36),
    new THREE.MeshStandardMaterial({ color, roughness: 1 })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.005, z);
  m.receiveShadow = true;
  house.add(m);
}
addRug(-5, -3.2, 2.0, 0x8c4f6f);
addRug(4.8, 3.2, 1.6, 0x4f6f8c);

// walls — dollhouse style (low), [cx, cz, w, d]
const WALL_H = 1.15;
const wallMat = new THREE.MeshStandardMaterial({ color: 0xeae3d2, roughness: 0.85 });
const wallTopMat = new THREE.MeshStandardMaterial({ color: 0xd6cdb8 });
const wallDefs = [
  [0, -7, 20.3, 0.3], [0, 7, 20.3, 0.3], [-10, 0, 0.3, 14.3], [10, 0, 0.3, 14.3], // outer
  [0, -5.5, 0.3, 3.0],    // living/kitchen (door z -4..-2.4)
  [0, -1.2, 0.3, 2.4],
  [0, 0.5, 0.3, 1.4],     // junction living/bedroom
  [0, 2.0, 0.3, 2.0],     // hall/bedroom (door z 3..4.6)
  [0, 5.8, 0.3, 2.4],
  [2, 0, 4.3, 0.3],       // kitchen/bedroom (door x 4..5.6)
  [7.8, 0, 4.4, 0.3],
  [-6.25, 1, 7.5, 0.3],   // living/hall+bath (door x -2.5..-0.9)
  [-0.45, 1, 1.2, 0.3],
  [-4, 2.25, 0.3, 2.5],   // bath/hall (door z 3.5..5.1)
  [-4, 6.05, 0.3, 1.9],
];
for (const [cx, cz, w, d] of wallDefs) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wallMat);
  m.position.set(cx, WALL_H / 2, cz);
  m.castShadow = true; m.receiveShadow = true;
  house.add(m);
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.06, d + 0.06), wallTopMat);
  top.position.set(cx, WALL_H + 0.03, cz);
  house.add(top);
  addSolid(cx, cz, w, d);
}

// ---------- Furniture ----------
function mat(color, rough = 0.8) { return new THREE.MeshStandardMaterial({ color, roughness: rough }); }
function box(parent, w, h, d, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function furniture(cx, cz, w, d, build) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  build(g);
  house.add(g);
  addSolid(cx, cz, w, d);
  return g;
}

// Living room
furniture(-5, -6.3, 2.4, 0.7, g => { // TV stand + TV
  box(g, 2.4, 0.5, 0.7, 0, 0.25, 0, mat(0x5a4632));
  box(g, 1.9, 1.0, 0.08, 0, 1.1, 0, mat(0x10131c, 0.4));
  box(g, 1.7, 0.85, 0.02, 0, 1.1, 0.045, new THREE.MeshStandardMaterial({ color: 0x2a4a6a, emissive: 0x1a3a5a, emissiveIntensity: 0.7 }));
});
furniture(-5, -1.6, 3.0, 1.2, g => { // sofa (faces TV / north)
  const c = mat(0xc26d4f);
  box(g, 3.0, 0.5, 1.2, 0, 0.25, 0, c);
  box(g, 3.0, 0.55, 0.35, 0, 0.75, 0.42, c);          // backrest (south side)
  box(g, 0.32, 0.4, 1.2, -1.34, 0.68, 0, c);
  box(g, 0.32, 0.4, 1.2, 1.34, 0.68, 0, c);
  box(g, 1.3, 0.14, 0.95, -0.7, 0.57, -0.08, mat(0xd58a6a));
  box(g, 1.3, 0.14, 0.95, 0.7, 0.57, -0.08, mat(0xd58a6a));
});
furniture(-5, -3.9, 1.6, 0.8, g => { // coffee table
  box(g, 1.6, 0.1, 0.8, 0, 0.42, 0, mat(0x7a5c3e));
  box(g, 0.1, 0.42, 0.1, -0.7, 0.21, -0.3, mat(0x5a4632));
  box(g, 0.1, 0.42, 0.1, 0.7, 0.21, -0.3, mat(0x5a4632));
  box(g, 0.1, 0.42, 0.1, -0.7, 0.21, 0.3, mat(0x5a4632));
  box(g, 0.1, 0.42, 0.1, 0.7, 0.21, 0.3, mat(0x5a4632));
  box(g, 0.5, 0.06, 0.34, 0.2, 0.5, 0, mat(0xddaa44)); // book
});
furniture(-9.45, -3.5, 0.55, 2.2, g => { // bookshelf
  box(g, 0.55, 1.1, 2.2, 0, 0.55, 0, mat(0x6a4f36));
  for (let i = 0; i < 5; i++) box(g, 0.4, 0.32, 0.3, 0.05, 0.78, -0.8 + i * 0.4, mat([0xaa4444, 0x44aa66, 0x4466aa, 0xaa8844, 0x8844aa][i]));
});
furniture(-0.8, -6.2, 0.66, 0.66, g => { // plant
  box(g, 0.5, 0.4, 0.5, 0, 0.2, 0, mat(0xa8552f));
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat(0x3f7d44, 1));
  leaves.position.y = 0.78; leaves.castShadow = true;
  g.add(leaves);
});

// Kitchen
furniture(4.2, -6.45, 6.2, 0.95, g => { // counter
  box(g, 6.2, 0.85, 0.95, 0, 0.425, 0, mat(0x8a93a0));
  box(g, 6.3, 0.07, 1.02, 0, 0.89, 0, mat(0xd8d2c8, 0.4));
  box(g, 0.55, 0.06, 0.4, -1.6, 0.95, 0.05, mat(0x333a44, 0.3)); // stove top
  box(g, 0.55, 0.06, 0.4, -0.9, 0.95, 0.05, mat(0x333a44, 0.3));
});
furniture(8.9, -6.3, 1.15, 1.1, g => { // fridge
  box(g, 1.1, 1.9, 1.0, 0, 0.95, 0, mat(0xcfd6dd, 0.35));
  box(g, 0.08, 0.5, 0.06, -0.45, 1.2, 0.52, mat(0x8a93a0));
});
furniture(4.8, -2.8, 1.5, 1.5, g => { // kitchen table
  box(g, 1.5, 0.08, 1.5, 0, 0.72, 0, mat(0x9a7449));
  box(g, 0.12, 0.72, 0.12, 0, 0.36, 0, mat(0x7a5c3e));
});
furniture(4.8, -1.45, 0.55, 0.55, g => { // chair
  box(g, 0.5, 0.08, 0.5, 0, 0.42, 0, mat(0x9a7449));
  box(g, 0.5, 0.55, 0.07, 0, 0.78, 0.22, mat(0x9a7449));
});
furniture(4.8, -4.15, 0.55, 0.55, g => { // chair 2
  box(g, 0.5, 0.08, 0.5, 0, 0.42, 0, mat(0x9a7449));
  box(g, 0.5, 0.55, 0.07, 0, 0.78, -0.22, mat(0x9a7449));
});

// Bedroom
furniture(8.3, 4.8, 2.4, 3.2, g => { // bed
  box(g, 2.4, 0.35, 3.2, 0, 0.3, 0, mat(0x7a5c3e));
  box(g, 2.2, 0.28, 2.9, 0, 0.6, 0.05, mat(0xe8e4da, 0.95));
  box(g, 2.2, 0.22, 1.7, 0, 0.66, 0.6, mat(0x6f8fb4, 0.95)); // blanket
  box(g, 0.9, 0.18, 0.55, -0.5, 0.78, -1.05, mat(0xffffff, 1)); // pillows
  box(g, 0.9, 0.18, 0.55, 0.55, 0.78, -1.05, mat(0xffffff, 1));
  box(g, 2.4, 0.9, 0.15, 0, 0.55, -1.62, mat(0x6a4f36)); // headboard
});
furniture(2.2, 6.45, 2.1, 0.85, g => { // wardrobe
  box(g, 2.1, 1.6, 0.85, 0, 0.8, 0, mat(0x8a6a48));
  box(g, 0.05, 1.4, 0.05, 0, 0.8, 0.44, mat(0x5a4632));
});
furniture(9.45, 2.4, 0.7, 0.7, g => { // nightstand
  box(g, 0.65, 0.55, 0.65, 0, 0.275, 0, mat(0x8a6a48));
  const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.25, 10), mat(0xf2d98a, 1));
  lamp.position.y = 0.78; lamp.castShadow = true; g.add(lamp);
});

// Bathroom
furniture(-8.9, 5.2, 1.75, 3.0, g => { // bathtub
  box(g, 1.75, 0.6, 3.0, 0, 0.3, 0, mat(0xe8eef2, 0.4));
  box(g, 1.35, 0.1, 2.6, 0, 0.58, 0, mat(0x9fd4e8, 0.2));
});
furniture(-5.3, 1.7, 1.3, 0.85, g => { // sink cabinet
  box(g, 1.3, 0.8, 0.85, 0, 0.4, 0, mat(0xd8d2c8));
  box(g, 0.55, 0.12, 0.45, 0, 0.9, 0, mat(0xe8eef2, 0.3));
});
furniture(-4.75, 6.3, 0.95, 0.95, g => { // washing machine
  box(g, 0.9, 0.95, 0.9, 0, 0.475, 0, mat(0xdde2e8, 0.35));
  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 18), mat(0x4a5568, 0.2));
  door.rotation.x = Math.PI / 2; door.position.set(0, 0.5, 0.46); g.add(door);
});

// Hall
furniture(-0.6, 6.35, 1.1, 0.6, g => { // shoe rack
  box(g, 1.1, 0.5, 0.6, 0, 0.25, 0, mat(0x7a5c3e));
  box(g, 0.3, 0.12, 0.45, -0.25, 0.56, 0, mat(0xaa4444));
  box(g, 0.3, 0.12, 0.45, 0.2, 0.56, 0, mat(0x4466aa));
});

// ---------- Charging dock ----------
const DOCK = { x: -2.6, z: 6.35 };
{
  const g = new THREE.Group();
  g.position.set(DOCK.x, 0, DOCK.z);
  const base = box(g, 0.9, 0.05, 0.8, 0, 0.025, 0, mat(0x2b2f3a, 0.5));
  base.receiveShadow = true;
  box(g, 0.9, 0.45, 0.18, 0, 0.225, 0.34, mat(0x2b2f3a, 0.5));
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x66ff99, emissive: 0x33ff77, emissiveIntensity: 2 }));
  led.position.set(0, 0.38, 0.26); g.add(led);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 32),
    new THREE.MeshBasicMaterial({ color: 0x46ffa6, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; g.add(ring);
  house.add(g);
}

// ---------- Robot vacuum ----------
const ROBOT_R = 0.34;
const robot = {
  pos: new THREE.Vector3(DOCK.x, 0, DOCK.z),
  theta: Math.PI,            // facing -z (into the house)
  vel: 0,
  pushVel: new THREE.Vector2(0, 0),
  battery: 100, bag: 0, bagCap: 25,
  disabled: false,
  mesh: null, brushes: [],
};
{
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x39404e, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(ROBOT_R, ROBOT_R, 0.13, 28), bodyMat);
  body.position.y = 0.085; body.castShadow = true;
  g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.32, 0.07, 28),
    new THREE.MeshStandardMaterial({ color: 0x4d5668, roughness: 0.4 }));
  top.position.y = 0.185; top.castShadow = true;
  g.add(top);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 16),
    new THREE.MeshStandardMaterial({ color: 0x6affc2, emissive: 0x2a9a6a, emissiveIntensity: 0.8 }));
  button.position.y = 0.235;
  g.add(button);
  // bumper (front = +z)
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x222732, roughness: 0.6 }));
  bumper.position.set(0, 0.07, ROBOT_R - 0.005);
  g.add(bumper);
  // eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x9adfff, emissive: 0x55c8ff, emissiveIntensity: 1.6 });
  for (const sx of [-0.09, 0.09]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), eyeMat);
    e.position.set(sx, 0.16, ROBOT_R - 0.04);
    g.add(e);
  }
  // spinning side brushes
  for (const sx of [-0.2, 0.2]) {
    const b = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const bristle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.16),
        new THREE.MeshStandardMaterial({ color: 0xcccccc }));
      bristle.rotation.y = (i / 3) * Math.PI * 2;
      bristle.position.y = 0.02;
      b.add(bristle);
    }
    b.position.set(sx, 0, 0.18);
    g.add(b);
    robot.brushes.push(b);
  }
  robot.mesh = g;
  scene.add(g);
}

// ---------- Dust / crumbs / mud ----------
const DIRT_TYPES = {
  dust:  { score: 10, color: 0x9aa0ab, r: 0.09 },
  crumb: { score: 15, color: 0xd9a441, r: 0.07 },
  mud:   { score: 25, color: 0x5e4326, r: 0.13 },
};
const dirtGeo = new THREE.IcosahedronGeometry(1, 0);
const dirtMats = Object.fromEntries(Object.entries(DIRT_TYPES).map(([k, v]) =>
  [k, new THREE.MeshStandardMaterial({ color: v.color, roughness: 1 })]));
const dirts = []; // {mesh, type}
const stats = { dust: 0, crumb: 0, mud: 0, totalCleaned: 0 };

function spawnDirt(type, x = null, z = null, roomKey = null) {
  if (x === null) {
    if (!roomKey) roomKey = pick(Object.keys(rooms));
    const r = rooms[roomKey];
    for (let i = 0; i < 30; i++) {
      const tx = rand(r.x0 + 0.6, r.x1 - 0.6), tz = rand(r.z0 + 0.6, r.z1 - 0.6);
      if (pointClear(tx, tz, 0.22) && new THREE.Vector2(tx - robot.pos.x, tz - robot.pos.z).length() > 1.5) {
        x = tx; z = tz; break;
      }
    }
    if (x === null) return;
  }
  const def = DIRT_TYPES[type];
  const m = new THREE.Mesh(dirtGeo, dirtMats[type]);
  m.scale.set(def.r, def.r * 0.4, def.r);
  m.position.set(x, def.r * 0.35, z);
  m.rotation.y = rand(0, Math.PI * 2);
  m.castShadow = true;
  scene.add(m);
  dirts.push({ mesh: m, type });
}
function countDirt(type) { return dirts.filter(d => d.type === type).length; }
for (let i = 0; i < 22; i++) spawnDirt('dust');
for (let i = 0; i < 4; i++) spawnDirt('crumb');

// ---------- NPCs ----------
const npcs = [];

function makeSpeech(parentGroup, height) {
  const m = new THREE.SpriteMaterial({ transparent: true, depthTest: false, opacity: 0 });
  const s = new THREE.Sprite(m);
  s.position.y = height;
  s.renderOrder = 10;
  parentGroup.add(s);
  return s;
}
function npcSay(npc, text, dur = 2.2) {
  const tex = bubbleTexture(text);
  npc.speech.material.map = tex;
  npc.speech.material.opacity = 1;
  npc.speech.scale.set(tex.userData.aspect * 0.55, 0.55, 1);
  npc.speechT = dur;
}

function baseNPC(group, opts) {
  const npc = {
    mesh: group,
    pos: group.position,
    radius: opts.radius, speed: opts.speed,
    theta: rand(0, Math.PI * 2),
    state: 'idle', target: null, waitT: rand(0.5, 2),
    stuckT: 0, lastPos: new THREE.Vector2(group.position.x, group.position.z),
    speech: makeSpeech(group, opts.speechH), speechT: 0,
    sayCooldown: 0, petCooldown: 0,
    ...opts.extra,
  };
  npc.type = opts.type;
  npcs.push(npc);
  return npc;
}

function npcMoveToward(npc, tx, tz, speed, dt) {
  const dx = tx - npc.pos.x, dz = tz - npc.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.12) return true;
  const step = Math.min(speed * dt, dist);
  npc.pos.x += (dx / dist) * step;
  npc.pos.z += (dz / dist) * step;
  collideCircle(npc.pos, npc.radius);
  npc.theta = angleLerp(npc.theta, Math.atan2(dx, dz), 10 * dt);
  npc.mesh.rotation.y = npc.theta;
  // stuck detection
  const moved = Math.hypot(npc.pos.x - npc.lastPos.x, npc.pos.z - npc.lastPos.y);
  if (moved < speed * dt * 0.25) npc.stuckT += dt; else npc.stuckT = 0;
  npc.lastPos.set(npc.pos.x, npc.pos.z);
  if (npc.stuckT > 1.4) { npc.stuckT = 0; return 'stuck'; }
  return false;
}
function pickWanderTarget(npc, anchorSet = allAnchors) {
  for (let i = 0; i < 12; i++) {
    const a = pick(anchorSet);
    const tx = a[0] + rand(-0.7, 0.7), tz = a[1] + rand(-0.7, 0.7);
    if (pointClear(tx, tz, npc.radius + 0.05)) { npc.target = [tx, tz]; return; }
  }
  npc.target = [pick(anchorSet)[0], pick(anchorSet)[1]];
}
function distToRobot(npc) {
  return Math.hypot(npc.pos.x - robot.pos.x, npc.pos.z - robot.pos.z);
}
function separateFromRobot(npc) {
  const d = distToRobot(npc);
  const min = npc.radius + ROBOT_R;
  if (d < min && d > 1e-4) {
    npc.pos.x = robot.pos.x + (npc.pos.x - robot.pos.x) / d * min;
    npc.pos.z = robot.pos.z + (npc.pos.z - robot.pos.z) / d * min;
    collideCircle(npc.pos, npc.radius);
  }
}

// --- Cat ---
function buildCat() {
  const g = new THREE.Group();
  const fur = mat(0xd98e4a, 0.9);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 10), fur);
  body.rotation.x = Math.PI / 2; body.position.y = 0.14; body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), fur);
  head.position.set(0, 0.22, 0.18); head.castShadow = true;
  g.add(head);
  for (const sx of [-0.05, 0.05]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 6), fur);
    ear.position.set(sx, 0.3, 0.16);
    g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.2, 3, 6), fur);
  tail.position.set(0, 0.22, -0.18);
  tail.rotation.x = -0.7;
  g.add(tail);
  // eyes
  const eyeMat = mat(0x2f4f2f, 0.3);
  for (const sx of [-0.035, 0.035]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), eyeMat);
    e.position.set(sx, 0.235, 0.255);
    g.add(e);
  }
  g.position.set(6, 0, 4);
  scene.add(g);
  return { g, tail };
}
const catParts = buildCat();
const cat = baseNPC(catParts.g, {
  type: 'cat', radius: 0.16, speed: 1.5, speechH: 0.62,
  extra: { tail: catParts.tail, fleeT: 0, rideT: 0, rideTotal: 0, rideCooldown: 0, hopChanceT: 0 },
});

// --- Dog ---
function buildDog() {
  const g = new THREE.Group();
  const fur = mat(0x8a6743, 0.95);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.32, 4, 10), fur);
  body.rotation.x = Math.PI / 2; body.position.y = 0.24; body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), fur);
  head.position.set(0, 0.4, 0.28); head.castShadow = true;
  g.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.12), mat(0x6e5235, 0.95));
  snout.position.set(0, 0.36, 0.4);
  g.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), mat(0x21180f, 0.4));
  nose.position.set(0, 0.37, 0.465);
  g.add(nose);
  for (const sx of [-0.1, 0.1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), mat(0x6e5235, 0.95));
    ear.position.set(sx, 0.42, 0.24);
    ear.rotation.z = sx > 0 ? -0.35 : 0.35;
    g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.18, 3, 6), fur);
  tail.position.set(0, 0.34, -0.26);
  tail.rotation.x = -0.9;
  g.add(tail);
  for (const [sx, sz] of [[-0.09, 0.12], [0.09, 0.12], [-0.09, -0.12], [0.09, -0.12]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 6), fur);
    leg.position.set(sx, 0.07, sz);
    g.add(leg);
  }
  const eyeMat = mat(0x1a120a, 0.3);
  for (const sx of [-0.055, 0.055]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), eyeMat);
    e.position.set(sx, 0.44, 0.38);
    g.add(e);
  }
  g.position.set(-7, 0, -5);
  scene.add(g);
  return { g, tail };
}
const dogParts = buildDog();
const dog = baseNPC(dogParts.g, {
  type: 'dog', radius: 0.28, speed: 1.7, speechH: 0.85,
  extra: { tail: dogParts.tail, chaseT: 0, nextChase: rand(14, 24), scaredT: 0, mudT: 0 },
});

// --- Humans ---
function buildHuman(shirt, pants, skin = 0xe8b48a) {
  const g = new THREE.Group();
  const legs = box(g, 0.3, 0.52, 0.17, 0, 0.26, 0, mat(pants, 0.95));
  const torso = box(g, 0.38, 0.5, 0.21, 0, 0.78, 0, mat(shirt, 0.95));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), mat(skin, 0.8));
  head.position.y = 1.18; head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x4a3526, 1));
  hair.position.y = 1.2;
  g.add(hair);
  for (const sx of [-0.25, 0.25]) box(g, 0.09, 0.46, 0.12, sx, 0.79, 0, mat(shirt, 0.95));
  void legs; void torso;
  scene.add(g);
  return g;
}
const gary = baseNPC(buildHuman(0x3e8e7e, 0x39455e), {
  type: 'human', radius: 0.27, speed: 1.0, speechH: 1.55,
  extra: { name: 'Gary', crumbT: rand(8, 14), snacking: false, reactT: 0, scripted: null },
});
gary.pos.set(-6.5, 0, -0.5);
const maya = baseNPC(buildHuman(0xd9b23c, 0x6e4a6e), {
  type: 'human', radius: 0.27, speed: 1.1, speechH: 1.55,
  extra: { name: 'Maya', crumbT: rand(10, 18), snacking: false, reactT: 0, scripted: null },
});
maya.pos.set(3, 0, 3);

// ---------- Story: Gary's secret fiancée plan ----------
// Gary is secretly planning to propose to Maya. The robot finds the hidden
// ring box, must deliver it without Maya seeing, and preps the proposal.
const RING_SPOT = { x: -3.05, z: -1.75 }; // beside the sofa
let ringState = 'none'; // none | hidden | robot | gary
let ringDelivered = false;
let ringMesh = null;
let sparkleT = 0;
let mayaCaughtCooldown = 0;
let proposalT = -1;
let proposalPrep = false;
const proposalFlags = {};

function spawnRingBox() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x8e1f3a, roughness: 0.55 }));
  base.position.y = 0.05; base.castShadow = true;
  g.add(base);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.025, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xf2c14e, emissive: 0x8a6a1a, emissiveIntensity: 0.6, roughness: 0.3 }));
  band.position.y = 0.05;
  g.add(band);
  g.position.set(RING_SPOT.x, 0, RING_SPOT.z);
  scene.add(g);
  ringMesh = g;
  ringState = 'hidden';
}
function livingDirtCount() {
  return dirts.filter(d => roomAt(d.mesh.position.x, d.mesh.position.z) === 'living').length;
}

// ---------- HUD ----------
const $ = id => document.getElementById(id);
const ui = {
  missionTag: $('missionTag'), missionTitle: $('missionTitle'), missionDesc: $('missionDesc'),
  missionBar: $('missionBar'), missionProgressText: $('missionProgressText'),
  batteryBar: $('batteryBar'), batteryPct: $('batteryPct'),
  bagBar: $('bagBar'), bagPct: $('bagPct'),
  scoreVal: $('scoreVal'), roomName: $('roomName'),
  toast: $('toast'), overlay: $('overlay'), startBtn: $('startBtn'), pauseLabel: $('pauseLabel'),
};
let score = 0;
function addScore(n, pos, label) {
  score += n;
  ui.scoreVal.textContent = score;
  if (pos) spawnFloater(label || (n >= 0 ? `+${n}` : `${n}`), pos.clone().add(new THREE.Vector3(0, 0.5, 0)), n >= 0 ? '#ffd86b' : '#ff7b7b');
}
let toastTimer = null;
function toast(text, dur = 2600) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), dur);
}

// ---------- Missions ----------
const visitedRooms = new Set();
let bagFullToastShown = false;
const missions = [
  {
    title: 'First Spin', desc: 'Time to earn your keep. Vacuum 10 dust bunnies anywhere in the house.',
    max: 10, base: 0,
    onStart() { this.base = stats.dust; },
    cur() { return stats.dust - this.base; },
  },
  {
    title: 'Grand Tour', desc: 'Map the territory. Visit every room of the house: living room, kitchen, bedroom, bathroom and hallway.',
    max: 5,
    onStart() {
      visitedRooms.clear();
      const r = roomAt(robot.pos.x, robot.pos.z);
      if (r) visitedRooms.add(r);
    },
    cur() { return visitedRooms.size; },
  },
  {
    title: 'Something Sparkly', desc: 'Wait... something is glinting under the sofa in the living room. Roll over and investigate!',
    max: 1,
    onStart() {
      spawnRingBox();
      npcSay(gary, '*looks around nervously*', 3);
    },
    cur() { return (ringState === 'robot' || ringState === 'gary') ? 1 : 0; },
  },
  {
    title: 'Crumb Crisis', desc: 'Gary has been stress-snacking in the kitchen ever since you found that box. Clean up 8 crumbs before Maya gets suspicious.',
    max: 8, base: 0,
    onStart() {
      this.base = stats.crumb;
      gary.snacking = true;
      gary.crumbT = 1.5;
      npcSay(gary, '*nervous munching*', 3);
    },
    onEnd() { gary.snacking = false; },
    cur() { return stats.crumb - this.base; },
  },
  {
    title: 'Make a Friend', desc: 'The cat is curious about you. Approach it SLOWLY and let it hop aboard, then give it a ride for 8 seconds total.',
    max: 8,
    onStart() { cat.rideTotal = 0; toast('Tip: drive up to the cat slowly — no sudden moves!', 4000); },
    cur() { return Math.floor(cat.rideTotal); },
  },
  {
    title: 'Keep It Secret', desc: 'Gary is going to PROPOSE to Maya! Deliver the ring box to him — but Maya must not see it. Reach Gary while Maya is far away from him.',
    max: 1,
    onStart() {
      ringDelivered = false;
      npcSay(gary, "Psst! Bring it over when Maya isn't looking!", 3.5);
      toast('🤫 Watch out — Maya gets curious if you drive too close to her.', 4000);
    },
    cur() { return ringDelivered ? 1 : 0; },
  },
  {
    title: 'Muddy Paws', desc: 'Of all the days! The dog tracked mud through the house right before the big night. Clean 6 mud spots.',
    max: 6, base: 0,
    onStart() {
      this.base = stats.mud;
      const trail = [[-1.4, 5.2], [-1.5, 3.8], [-1.6, 2.4], [-1.7, 0.55], [-2.0, -0.8], [-2.3, -2.3], [-2.6, -3.7], [-2.9, -5.0]];
      for (const [x, z] of trail) if (pointClear(x, z, 0.18)) spawnDirt('mud', x, z);
      npcSay(dog, '*innocent look*', 3);
    },
    cur() { return stats.mud - this.base; },
  },
  {
    title: 'Full Cycle', desc: 'The proposal dinner is tonight! Deep clean: fill your dust bag to 20 without docking, then return to the dock to empty it.',
    max: 20, manual: true,
    onStart() { bagFullToastShown = false; },
    cur() { return Math.min(robot.bag, 20); },
  },
  {
    title: 'Operation Proposal', desc: "Tonight's the night! Make the living room SPOTLESS — vacuum every last speck of dirt in there, then watch the magic happen.",
    max: 1,
    onStart() {
      proposalPrep = true;
      for (let i = 0; i < 8; i++) spawnDirt('dust', null, null, 'living');
      this.max = Math.max(1, livingDirtCount());
      npcSay(gary, 'Deep breaths, Gary. Deep breaths.', 3);
      npcSay(maya, 'Why is Gary acting so weird?', 3);
    },
    onEnd() {
      // the proposal scene
      proposalT = 0;
      gary.scripted = [-5.6, -2.9];
      maya.scripted = [-4.4, -2.9];
      gary.target = null; maya.target = null;
    },
    cur() { return clamp(this.max - livingDirtCount(), 0, this.max); },
  },
];
let missionIndex = 0;
let allDone = false;
let missionTransition = 0;

function refreshMissionHUD() {
  if (allDone) {
    ui.missionTag.textContent = 'ALL MISSIONS COMPLETE';
    ui.missionTitle.textContent = 'Happily Ever After 🏆';
    ui.missionDesc.textContent = 'Gary and Maya are engaged — and it\'s all thanks to you. Keep the house spotless for the wedding planning!';
    ui.missionBar.style.width = '100%';
    ui.missionProgressText.textContent = `Score: ${score}`;
    return;
  }
  const m = missions[missionIndex];
  ui.missionTag.textContent = `MISSION ${missionIndex + 1}/${missions.length}`;
  ui.missionTitle.textContent = m.title;
  ui.missionDesc.textContent = m.desc;
  const c = clamp(m.cur(), 0, m.max);
  ui.missionBar.style.width = (c / m.max * 100) + '%';
  ui.missionProgressText.textContent = `${c} / ${m.max}`;
}
function completeMission() {
  const m = missions[missionIndex];
  if (m.onEnd) m.onEnd();
  sfx.mission();
  addScore(100, robot.pos, '+100');
  toast(`✅ Mission complete: ${m.title}! +100`, 3200);
  missionIndex++;
  missionTransition = 2.0;
  if (missionIndex >= missions.length) {
    allDone = true; // the proposal finale plays out via updateStory
  }
}
function updateMissions(dt) {
  if (allDone) { refreshMissionHUD(); return; }
  if (missionTransition > 0) {
    missionTransition -= dt;
    if (missionTransition <= 0 && missionIndex < missions.length) {
      const m = missions[missionIndex];
      if (m.onStart) m.onStart();
      toast(`📋 New mission: ${m.title}`, 3000);
    }
    refreshMissionHUD();
    return;
  }
  const m = missions[missionIndex];
  // mission 6 helper toast
  if (m.manual && robot.bag >= 20 && !bagFullToastShown) {
    bagFullToastShown = true;
    toast('Bag is full enough — return to the dock! 🏠', 3500);
  }
  if (!m.manual && m.cur() >= m.max) completeMission();
  refreshMissionHUD();
}

// ---------- Input ----------
const keys = new Set();
let started = false, paused = false;
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyP' && started) {
    paused = !paused;
    ui.pauseLabel.style.display = paused ? 'flex' : 'none';
  }
  if (e.code === 'KeyR') location.reload();
  if (e.code === 'Space' && started && !paused) hornBeep();
  if (e.code === 'KeyE' && started && !paused) interact();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

ui.startBtn.addEventListener('click', () => {
  initAudio();
  started = true;
  ui.overlay.style.display = 'none';
  // dev shortcut: ?mission=N starts at mission N (runs skipped missions' side effects)
  const skipTo = clamp((parseInt(new URLSearchParams(location.search).get('mission'), 10) || 1) - 1, 0, missions.length - 1);
  for (let i = 0; i < skipTo; i++) {
    const sm = missions[i];
    if (sm.onStart) sm.onStart();
    if (sm.onEnd) sm.onEnd();
    missionIndex++;
  }
  const m = missions[missionIndex];
  if (m.onStart) m.onStart();
  toast(`📋 Mission ${missionIndex + 1}: ${m.title}`, 3000);
});

// debug handle for testing
window.__robovac = {
  state: () => ({ missionIndex, ringState, ringDelivered, bag: robot.bag, battery: robot.battery, score, proposalT }),
  completeMission: () => completeMission(),
  teleport: (x, z) => { robot.pos.set(x, 0, z); },
};

// ---------- Interactions ----------
function hornBeep() {
  sfx.horn();
  spawnFloater('📢', robot.pos.clone().add(new THREE.Vector3(0, 0.4, 0)), '#ffffff');
  // scare nearby pets
  if (distToRobot(cat) < 3) {
    if (cat.state === 'ride') dismountCat(true);
    cat.state = 'flee'; cat.fleeT = 1.6;
    npcSay(cat, 'Hisss!', 1.5);
  }
  if (distToRobot(dog) < 3.5) {
    if (dog.state === 'chase') { dog.state = 'wander'; dog.target = null; dog.nextChase = rand(12, 20); }
    dog.scaredT = 2.5;
    npcSay(dog, 'Yip!', 1.5);
  }
  for (const h of [gary, maya]) {
    if (distToRobot(h) < 2.5 && h.sayCooldown <= 0) {
      npcSay(h, pick(['Oh! Hello there.', 'Yes yes, I see you.', 'Busy little thing.']), 2.2);
      h.sayCooldown = 4;
    }
  }
}
function interact() {
  let best = null, bestD = 1.35;
  for (const n of npcs) {
    const d = distToRobot(n);
    if (d < bestD) { bestD = d; best = n; }
  }
  if (!best) return;
  if (best.petCooldown > 0) return;
  best.petCooldown = 6;
  sfx.pet();
  if (best.type === 'cat') {
    npcSay(best, pick(['Purrrr~', 'Mrrp?', '😻']), 2.2);
    spawnFloater('❤', best.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), '#ff6b9a');
    addScore(5, best.pos, '+5');
  } else if (best.type === 'dog') {
    npcSay(best, pick(['Woof!', 'Bork bork!', '*happy tail*']), 2.2);
    spawnFloater('❤', best.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), '#ff6b9a');
    best.scaredT = 0;
    addScore(5, best.pos, '+5');
  } else {
    npcSay(best, pick(['Good robot!', "Who's a clean boy?", 'Keep it up, buddy.', 'My floors sparkle!']), 2.4);
    addScore(5, best.pos, '+5');
  }
}
function dismountCat(scared = false) {
  if (cat.state !== 'ride') return;
  cat.state = scared ? 'flee' : 'wander';
  cat.fleeT = scared ? 1.5 : 0;
  cat.rideCooldown = 9;
  cat.target = null;
  // hop off to the side
  const side = robot.theta + Math.PI / 2;
  cat.pos.set(robot.pos.x + Math.sin(side) * 0.6, 0, robot.pos.z + Math.cos(side) * 0.6);
  collideCircle(cat.pos, cat.radius);
}

// ---------- Robot update ----------
let rescueT = 0;
let lowBattWarned = false;
let charging = false;

function updateRobot(dt) {
  if (robot.disabled) {
    rescueT -= dt;
    if (rescueT <= 0) {
      robot.disabled = false;
      robot.pos.set(DOCK.x, 0, DOCK.z);
      robot.theta = Math.PI;
      robot.battery = 35;
      addScore(-50, null);
      toast('Gary carried you back to the dock. -50 pts 😅', 3500);
    }
    return;
  }

  const fwdKey = keys.has('KeyW') || keys.has('ArrowUp');
  const bckKey = keys.has('KeyS') || keys.has('ArrowDown');
  const lKey = keys.has('KeyA') || keys.has('ArrowLeft');
  const rKey = keys.has('KeyD') || keys.has('ArrowRight');
  const boost = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && fwdKey;

  const turnSpeed = 2.9;
  if (lKey) robot.theta += turnSpeed * dt;
  if (rKey) robot.theta -= turnSpeed * dt;

  let targetVel = 0;
  if (fwdKey) targetVel = boost ? 3.6 : 2.2;
  if (bckKey) targetVel = -1.4;
  if (cat.state === 'ride') targetVel *= 0.78;
  robot.vel += (targetVel - robot.vel) * Math.min(1, 8 * dt);

  const fx = Math.sin(robot.theta), fz = Math.cos(robot.theta);
  const prevX = robot.pos.x, prevZ = robot.pos.z;
  robot.pos.x += fx * robot.vel * dt + robot.pushVel.x * dt;
  robot.pos.z += fz * robot.vel * dt + robot.pushVel.y * dt;
  robot.pushVel.multiplyScalar(Math.exp(-5 * dt));
  collideCircle(robot.pos, ROBOT_R);

  const actualSpeed = Math.hypot(robot.pos.x - prevX, robot.pos.z - prevZ) / Math.max(dt, 1e-4);
  // bump sound on hitting walls
  if (Math.abs(robot.vel) > 1.4 && actualSpeed < Math.abs(robot.vel) * 0.3) {
    if (!robot._bumped) { sfx.bump(); robot._bumped = true; }
  } else robot._bumped = false;

  robot.mesh.position.copy(robot.pos);
  robot.mesh.rotation.y = robot.theta;
  for (const b of robot.brushes) b.rotation.y += dt * (4 + Math.abs(robot.vel) * 6);

  // hum volume
  if (humGain) humGain.gain.value = started && !paused ? 0.008 + Math.abs(robot.vel) * 0.006 : 0;

  // battery
  charging = Math.hypot(robot.pos.x - DOCK.x, robot.pos.z - DOCK.z) < 0.55;
  if (charging) {
    robot.battery = Math.min(100, robot.battery + 13 * dt);
    if (robot.bag > 0) {
      const hadBag = robot.bag;
      addScore(hadBag, robot.pos);
      robot.bag = 0;
      sfx.dock();
      toast('🗑️ Dust bag emptied!');
      // mission 6: bag had to be >= 20 when reaching the dock
      if (!allDone && missions[missionIndex] && missions[missionIndex].manual && missionTransition <= 0 && hadBag >= 20) {
        completeMission();
      }
    }
    lowBattWarned = false;
  } else {
    const drain = Math.abs(robot.vel) > 0.2 ? (Math.abs(robot.vel) > 2.6 ? 2.4 : 1.0) : 0.25;
    robot.battery = Math.max(0, robot.battery - drain * dt);
    if (robot.battery < 20 && !lowBattWarned) {
      lowBattWarned = true;
      sfx.lowBatt();
      toast('⚠️ Battery low — head to the dock!', 3000);
    }
    if (robot.battery <= 0) {
      robot.disabled = true;
      rescueT = 3;
      robot.vel = 0;
      toast('🔌 Battery dead! Waiting for rescue...', 3000);
      npcSay(gary, 'Oh, not again...', 2.5);
    }
  }

  // visited rooms
  const rm = roomAt(robot.pos.x, robot.pos.z);
  if (rm) {
    visitedRooms.add(rm);
    ui.roomName.textContent = rooms[rm].name + (charging ? ' · ⚡ charging' : '');
  }

  // vacuum dirt
  if (robot.bag < robot.bagCap) {
    for (let i = dirts.length - 1; i >= 0; i--) {
      const d = dirts[i];
      const dist = Math.hypot(d.mesh.position.x - robot.pos.x, d.mesh.position.z - robot.pos.z);
      if (dist < ROBOT_R + 0.16) {
        const def = DIRT_TYPES[d.type];
        scene.remove(d.mesh);
        dirts.splice(i, 1);
        stats[d.type]++;
        stats.totalCleaned++;
        robot.bag++;
        sfx.pickup();
        addScore(def.score, d.mesh.position, `+${def.score}`);
        if (robot.bag >= robot.bagCap) toast('🗑️ Dust bag FULL — empty it at the dock!', 3000);
      }
    }
  }
}

// ---------- NPC updates ----------
function updateCat(dt) {
  cat.fleeT = Math.max(0, cat.fleeT - dt);
  cat.rideCooldown = Math.max(0, cat.rideCooldown - dt);
  const d = distToRobot(cat);
  const robotSpeed = Math.abs(robot.vel);

  if (cat.state === 'ride') {
    cat.pos.set(robot.pos.x, 0.26, robot.pos.z);
    cat.mesh.rotation.y = robot.theta;
    cat.rideT -= dt;
    cat.rideTotal += dt;
    if (robotSpeed > 3.0) { dismountCat(true); npcSay(cat, '😾!', 1.5); return; }
    if (cat.rideT <= 0) { dismountCat(false); npcSay(cat, 'Mrrp.', 1.5); return; }
    return;
  }
  cat.pos.y = 0;

  // flee from fast robot
  if (cat.state !== 'flee' && d < 1.4 && robotSpeed > 1.6) {
    cat.state = 'flee'; cat.fleeT = 1.6;
    if (cat.sayCooldown <= 0) { npcSay(cat, 'Hisss!', 1.4); cat.sayCooldown = 3; }
  }
  if (cat.state === 'flee') {
    if (cat.fleeT <= 0) { cat.state = 'wander'; cat.target = null; }
    else {
      const ax = cat.pos.x - robot.pos.x, az = cat.pos.z - robot.pos.z;
      const len = Math.hypot(ax, az) || 1;
      const r = npcMoveToward(cat, cat.pos.x + ax / len * 2, cat.pos.z + az / len * 2, 3.1, dt);
      if (r === 'stuck') cat.fleeT = 0;
      return;
    }
  }

  // hop on the robot if approached gently
  if (d < 1.0 && robotSpeed < 0.9 && cat.rideCooldown <= 0 && !robot.disabled) {
    cat.hopChanceT += dt;
    const chance = (!allDone && missions[missionIndex] && missions[missionIndex].title === 'Make a Friend') ? 0.9 : 0.25;
    if (cat.hopChanceT > 1.2 && Math.random() < chance * dt * 2) {
      cat.state = 'ride';
      cat.rideT = rand(10, 18);
      cat.hopChanceT = 0;
      npcSay(cat, '😺 *hops on*', 2);
      spawnFloater('❤', robot.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), '#ff6b9a');
    }
  } else cat.hopChanceT = 0;

  // wander / idle
  if (cat.state === 'wander' || cat.state === 'idle') {
    if (!cat.target) {
      if (cat.waitT > 0) { cat.waitT -= dt; }
      else pickWanderTarget(cat);
    } else {
      const r = npcMoveToward(cat, cat.target[0], cat.target[1], cat.speed, dt);
      if (r === true || r === 'stuck') { cat.target = null; cat.waitT = rand(2, 6); }
    }
  }
  separateFromRobot(cat);
  // tail sway
  cat.tail.rotation.z = Math.sin(performance.now() * 0.004) * 0.4;
}

function updateDog(dt) {
  dog.scaredT = Math.max(0, dog.scaredT - dt);
  dog.mudT = Math.max(0, dog.mudT - dt);
  const d = distToRobot(dog);

  if (dog.state !== 'chase') {
    dog.nextChase -= dt;
    if (dog.nextChase <= 0 && dog.scaredT <= 0) {
      dog.state = 'chase';
      dog.chaseT = rand(5, 8);
      npcSay(dog, pick(['Woof woof!', 'BORK!', '*zoomies*']), 2);
    }
  }

  if (dog.state === 'chase') {
    dog.chaseT -= dt;
    npcMoveToward(dog, robot.pos.x, robot.pos.z, 2.7, dt);
    // bump the robot
    if (d < dog.radius + ROBOT_R + 0.08) {
      const px = robot.pos.x - dog.pos.x, pz = robot.pos.z - dog.pos.z;
      const len = Math.hypot(px, pz) || 1;
      robot.pushVel.set(px / len * 2.4, pz / len * 2.4);
      if (dog.sayCooldown <= 0) {
        npcSay(dog, 'Woof!', 1.4);
        dog.sayCooldown = 2;
        sfx.bump();
      }
      // sometimes the dog sheds a mud spot (time-gated)
      if (dog.mudT <= 0 && countDirt('mud') < 6) {
        dog.mudT = rand(3, 6);
        const mx = dog.pos.x + rand(-0.5, 0.5), mz = dog.pos.z + rand(-0.5, 0.5);
        if (pointClear(mx, mz, 0.18)) spawnDirt('mud', mx, mz);
      }
    }
    if (dog.chaseT <= 0) {
      dog.state = 'wander';
      dog.target = null;
      dog.nextChase = rand(16, 30);
      npcSay(dog, '*pant pant*', 2);
    }
    dog.tail.rotation.z = Math.sin(performance.now() * 0.02) * 0.7;
  } else {
    if (!dog.target) {
      if (dog.waitT > 0) dog.waitT -= dt;
      else pickWanderTarget(dog);
    } else {
      const r = npcMoveToward(dog, dog.target[0], dog.target[1], dog.scaredT > 0 ? 2.6 : dog.speed, dt);
      if (r === true || r === 'stuck') { dog.target = null; dog.waitT = rand(1.5, 4); }
    }
    dog.tail.rotation.z = Math.sin(performance.now() * 0.006) * 0.4;
    separateFromRobot(dog);
  }
}

function updateHuman(h, dt) {
  // story scenes override normal behavior
  if (h.scripted) {
    npcMoveToward(h, h.scripted[0], h.scripted[1], h.speed * 1.2, dt);
    return;
  }
  h.reactT = Math.max(0, h.reactT - dt);
  const d = distToRobot(h);

  // step away + comment if the robot is about to hit them
  if (d < 0.95 && Math.abs(robot.vel) > 1.0 && h.reactT <= 0) {
    h.reactT = 4;
    npcSay(h, pick(['Whoa! Watch it!', 'Oop—pardon me!', 'Hey, I\'m walking here!']), 2.2);
    const ax = h.pos.x - robot.pos.x, az = h.pos.z - robot.pos.z;
    const len = Math.hypot(ax, az) || 1;
    const tx = h.pos.x + ax / len * 1.4, tz = h.pos.z + az / len * 1.4;
    h.target = pointClear(tx, tz, h.radius) ? [tx, tz] : null;
  }

  // crumb dropping
  h.crumbT -= dt;
  if (h.crumbT <= 0) {
    const rm = roomAt(h.pos.x, h.pos.z);
    const canDrop = !proposalPrep &&
      ((h.snacking && rm === 'kitchen') || (!h.snacking && (rm === 'kitchen' || rm === 'living')));
    if (canDrop && countDirt('crumb') < 14) {
      const cx = h.pos.x + rand(-0.6, 0.6), cz = h.pos.z + rand(-0.6, 0.6);
      if (pointClear(cx, cz, 0.15)) spawnDirt('crumb', cx, cz);
    }
    h.crumbT = h.snacking ? rand(1.5, 2.5) : rand(9, 16);
  }

  // movement
  if (!h.target) {
    if (h.waitT > 0) h.waitT -= dt;
    else {
      if (h.snacking) pickWanderTarget(h, anchors.kitchen);
      else pickWanderTarget(h);
    }
  } else {
    const r = npcMoveToward(h, h.target[0], h.target[1], h.speed, dt);
    if (r === true || r === 'stuck') { h.target = null; h.waitT = rand(2.5, 7); }
    // walk bob
    h.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.008)) * 0.035;
  }
  separateFromRobot(h);
}

function updateNPCCommon(npc, dt) {
  npc.sayCooldown = Math.max(0, npc.sayCooldown - dt);
  npc.petCooldown = Math.max(0, npc.petCooldown - dt);
  if (npc.speechT > 0) {
    npc.speechT -= dt;
    if (npc.speechT <= 0) npc.speech.material.opacity = 0;
    else if (npc.speechT < 0.4) npc.speech.material.opacity = npc.speechT / 0.4;
  }
}

// ---------- Story update ----------
function updateStory(dt) {
  mayaCaughtCooldown = Math.max(0, mayaCaughtCooldown - dt);

  // ring glinting under the sofa, waiting to be found
  if (ringState === 'hidden' && ringMesh) {
    sparkleT -= dt;
    if (sparkleT <= 0) {
      sparkleT = 1.3;
      spawnFloater('✨', ringMesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)), '#ffe9a8');
    }
    if (Math.hypot(robot.pos.x - RING_SPOT.x, robot.pos.z - RING_SPOT.z) < 0.55) {
      ringState = 'robot';
      sfx.pet();
      addScore(50, robot.pos, '+50');
      toast("💍 A velvet ring box?! So THAT's what Gary has been hiding...", 4200);
      npcSay(gary, 'You found it! Shhh... guard it for me!', 3.2);
    }
  }
  // ring riding on the robot
  if (ringState === 'robot' && ringMesh) {
    const fx = Math.sin(robot.theta), fz = Math.cos(robot.theta);
    ringMesh.position.set(robot.pos.x + fx * 0.16, 0.235, robot.pos.z + fz * 0.16);
    ringMesh.rotation.y = robot.theta;
    sparkleT -= dt;
    if (sparkleT <= 0) {
      sparkleT = 2.6;
      spawnFloater('✨', ringMesh.position.clone().add(new THREE.Vector3(0, 0.25, 0)), '#ffe9a8');
    }
  }

  // delivery mission: sneak the ring to Gary past Maya
  const m = (!allDone && missionTransition <= 0) ? missions[missionIndex] : null;
  if (m && m.title === 'Keep It Secret' && ringState === 'robot') {
    const dMaya = distToRobot(maya);
    if (dMaya < 2.2 && !maya.scripted) maya.target = [robot.pos.x, robot.pos.z]; // Maya gets curious
    if (dMaya < 0.95 && mayaCaughtCooldown <= 0) {
      mayaCaughtCooldown = 6;
      addScore(-30, maya.pos, '-30');
      npcSay(maya, 'Wait... is that a RING box?!', 2.5);
      toast('😬 Maya almost saw it! Lead her away and try again.', 3200);
      pickWanderTarget(maya);
      maya.waitT = 0;
    }
    const dGary = Math.hypot(gary.pos.x - robot.pos.x, gary.pos.z - robot.pos.z);
    const garyMaya = Math.hypot(gary.pos.x - maya.pos.x, gary.pos.z - maya.pos.z);
    if (dGary < 1.15) {
      if (garyMaya > 3.0) {
        ringState = 'gary';
        ringDelivered = true;
        scene.remove(ringMesh);
        ringMesh = null;
        npcSay(gary, "Perfect. You're the best wingbot ever. 🤫", 3);
        spawnFloater('💍', gary.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), '#ffe9a8');
      } else if (gary.sayCooldown <= 0) {
        npcSay(gary, "Not now — she's right there!", 2);
        gary.sayCooldown = 3;
      }
    }
  }

  // the proposal finale
  if (proposalT >= 0) {
    proposalT += dt;
    const mid = new THREE.Vector3((gary.pos.x + maya.pos.x) / 2, 1.2, (gary.pos.z + maya.pos.z) / 2);
    if (proposalT > 2.5) {
      gary.theta = Math.atan2(maya.pos.x - gary.pos.x, maya.pos.z - gary.pos.z);
      gary.mesh.rotation.y = gary.theta;
      maya.theta = Math.atan2(gary.pos.x - maya.pos.x, gary.pos.z - maya.pos.z);
      maya.mesh.rotation.y = maya.theta;
    }
    if (proposalT > 3.2 && !proposalFlags.ask) {
      proposalFlags.ask = true;
      npcSay(gary, 'Maya... will you marry me? 💍', 3.2);
      spawnFloater('💍', gary.pos.clone().add(new THREE.Vector3(0, 1.7, 0)), '#ffe9a8');
    }
    if (proposalT > 5.8 && !proposalFlags.yes) {
      proposalFlags.yes = true;
      npcSay(maya, 'YES!! A thousand times yes! 💖', 3.5);
      sfx.mission();
      addScore(500, mid, '+500');
      for (let i = 0; i < 12; i++) {
        setTimeout(() => spawnFloater(pick(['❤', '💖', '🎉', '✨']),
          new THREE.Vector3(mid.x + rand(-1.2, 1.2), rand(0.4, 1.6), mid.z + rand(-1.2, 1.2)), '#ff6b9a'), i * 140);
      }
      npcSay(cat, '😺', 2); npcSay(dog, 'WOOF WOOF!', 2);
    }
    if (proposalT > 7.5 && !proposalFlags.toast) {
      proposalFlags.toast = true;
      toast('💍 She said YES! Engagement secured — best wingbot ever. 🏆', 5000);
    }
    if (proposalT > 10.5) {
      proposalT = -1;
      gary.scripted = null; maya.scripted = null;
      gary.target = null; maya.target = null;
      proposalPrep = false;
    }
  }
}

// ---------- Dust respawn ----------
let dustRespawnT = 4;
function updateDirtSpawning(dt) {
  dustRespawnT -= dt;
  if (dustRespawnT <= 0) {
    dustRespawnT = 3.5;
    // no fresh dust while prepping the proposal room
    if (!proposalPrep && countDirt('dust') < 30) spawnDirt('dust');
  }
}

// ---------- Camera ----------
let camYaw = robot.theta;
function updateCamera(dt) {
  camYaw = angleLerp(camYaw, robot.theta, Math.min(1, 3.2 * dt));
  const dist = 6.4, height = 4.5;
  const cx = robot.pos.x - Math.sin(camYaw) * dist;
  const cz = robot.pos.z - Math.cos(camYaw) * dist;
  camera.position.lerp(new THREE.Vector3(cx, height, cz), Math.min(1, 5 * dt));
  camera.lookAt(robot.pos.x, 0.55, robot.pos.z);
}
// initial camera placement
camera.position.set(DOCK.x - Math.sin(robot.theta) * 6.4, 4.5, DOCK.z - Math.cos(robot.theta) * 6.4);
camera.lookAt(robot.pos.x, 0.55, robot.pos.z);

// ---------- HUD refresh ----------
function updateHUD() {
  ui.batteryBar.style.width = robot.battery + '%';
  ui.batteryPct.textContent = Math.round(robot.battery) + '%';
  ui.batteryBar.className = charging ? 'charging' : (robot.battery < 25 ? 'low' : '');
  ui.bagBar.style.width = (robot.bag / robot.bagCap * 100) + '%';
  ui.bagPct.textContent = `${robot.bag}/${robot.bagCap}`;
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (started && !paused) {
    updateRobot(dt);
    updateCat(dt);
    updateDog(dt);
    updateHuman(gary, dt);
    updateHuman(maya, dt);
    for (const n of npcs) updateNPCCommon(n, dt);
    updateDirtSpawning(dt);
    updateStory(dt);
    updateMissions(dt);
    updateFloaters(dt);
    updateHUD();
  } else if (humGain) {
    humGain.gain.value = 0;
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}
refreshMissionHUD();
updateHUD();
tick();
