import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const HEROES = [
  { id: 'rin', name: 'Rin', role: 'Duelista', color: '#63eaff', hp: 110, mp: 60, atk: 18, def: 6, speed: 8.5, skill: 'Patch Strike', skillCost: 20, skillCd: 3.5, desc: 'Ataque rápido e alta mobilidade. Ideal para quem gosta de combos e esquiva.', stats: { dano: 85, defesa: 45, magia: 40, vel: 90 } },
  { id: 'siren', name: 'Siren', role: 'Tanque', color: '#7ab0ff', hp: 170, mp: 50, atk: 14, def: 14, speed: 6.5, skill: 'Barreira', skillCost: 25, skillCd: 8, desc: 'Alta resistência e controle de campo. Aguenta dano e protege o avanço.', stats: { dano: 55, defesa: 95, magia: 35, vel: 45 } },
  { id: 'firon', name: 'Firon', role: 'Maga', color: '#ff9a5a', hp: 85, mp: 120, atk: 24, def: 4, speed: 7.2, skill: 'Glitch Storm', skillCost: 30, skillCd: 5, desc: 'Dano mágico em área à distância. Frágil, mas devastadora.', stats: { dano: 95, defesa: 30, magia: 100, vel: 65 } },
  { id: 'pyren', name: 'Pyren', role: 'Sacerdote', color: '#7fe0b0', hp: 100, mp: 110, atk: 12, def: 8, speed: 7, skill: 'Heal Pulse', skillCost: 35, skillCd: 7, desc: 'Cura e suporte. Mantém-se vivo e sustenta lutas longas.', stats: { dano: 45, defesa: 60, magia: 85, vel: 60 } },
];

const SAVE_KEY = 'bytequest_save_v1';
let selectedHero = null;
let game = null;

function buildRoster() {
  const roster = $('#roster');
  roster.innerHTML = HEROES.map(h => `
    <button class="hero" data-id="${h.id}" style="--c:${h.color}">
      <div class="hero__icon">${heroIcon(h.id)}</div>
      <div class="hero__role">${h.role}</div>
      <div class="hero__name">${h.name}</div>
      <div class="hero__desc">${h.desc}</div>
      <div class="hero__stats">
        ${statRow('Dano', h.stats.dano)}${statRow('Defesa', h.stats.defesa)}${statRow('Magia', h.stats.magia)}${statRow('Veloc.', h.stats.vel)}
      </div>
    </button>`).join('');
  roster.querySelectorAll('.hero').forEach(btn => btn.addEventListener('click', () => {
    roster.querySelectorAll('.hero').forEach(b => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');
    selectedHero = HEROES.find(h => h.id === btn.dataset.id);
    $('#selected-name').textContent = `${selectedHero.name} — ${selectedHero.role}`;
    $('#start-btn').disabled = false;
  }));
}
function statRow(label, val) { return `<div class="hstat"><span>${label}</span><div class="hstat__bar"><i style="width:${val}%"></i></div><span>${val}</span></div>`; }
function heroIcon(id) {
  const icons = {
    rin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 4l6 2-2 6-6-2z"/><path d="M12 10L4 18l2 2 8-8"/><path d="M16 14l2 2"/></svg>',
    siren: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"/></svg>',
    firon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v4M12 18v4M4 12H2M22 12h-2M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/><circle cx="12" cy="12" r="4"/></svg>',
    pyren: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M5 10h14"/><path d="M8 21h8"/><circle cx="12" cy="7" r="2"/></svg>',
  };
  return icons[id] || '';
}

// ---- GAME ----
class Game {
  constructor(heroDef) {
    this.heroDef = heroDef;
    this.canvas = $('#game');
    this.clock = new THREE.Clock();
    this.keys = {};
    this.mouseDown = false;
    this.paused = false;
    this.over = false;
    this.pointerLocked = false;
    this.yaw = 0; this.pitch = 0.35;
    this.camDist = 9;
    this.skillCdLeft = 0;
    this.attackCd = 0;
    this.kills = 0;
    this.targetKills = 8;
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.pickups = [];
    this.dmgTexts = [];
    this.spawnTimer = 0;
    this.time = 0;

    this.player = {
      hp: heroDef.hp, maxHp: heroDef.hp, mp: heroDef.mp, maxMp: heroDef.mp,
      xp: 0, xpNext: 100, lvl: 1, atk: heroDef.atk, def: heroDef.def, speed: heroDef.speed,
      pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(), radius: 0.7, alive: true,
      shield: 0, invuln: 0,
    };
    this.init();
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x0a0d14);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a1018, 0.012);

    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
    this.scene.add(this.camera);

    // lights
    this.scene.add(new THREE.HemisphereLight(0x8ec8ff, 0x1a2030, 0.75));
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.2);
    sun.position.set(30, 50, 20); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60; sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
    sun.shadow.camera.far = 150;
    this.scene.add(sun);

    this.buildWorld();
    this.buildPlayer();
    for (let i = 0; i < 6; i++) this.spawnEnemy();

    this.bindEvents();
    this.updateHUD();
    this.loop();
  }

  buildWorld() {
    // ground
    const groundGeo = new THREE.PlaneGeometry(240, 240, 80, 80);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const h = Math.sin(x * 0.04) * Math.cos(y * 0.04) * 1.2 + Math.sin(x * 0.015 + y * 0.02) * 1.5;
      pos.setZ(i, h * 0.35);
    }
    groundGeo.computeVertexNormals();
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.95, metalness: 0.05 });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // grid overlay
    const grid = new THREE.GridHelper(240, 120, 0x2a5a6a, 0x182430);
    grid.position.y = 0.02; grid.material.opacity = 0.25; grid.material.transparent = true;
    this.scene.add(grid);

    // structures/obstacles
    this.obstacles = [];
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x263246, roughness: 0.7, metalness: 0.2 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x63eaff, emissive: 0x63eaff, emissiveIntensity: 0.8 });
    const placements = [
      [12,0,12,4,6,4],[ -15,0,8,3,4,3],[20,0,-18,5,8,5],[-25,0,-20,4,5,4],[0,0,-30,6,3,6],
      [35,0,5,3,10,3],[-35,0,15,3,7,3],[8,0,35,4,4,4],[-18,0,32,5,6,5],[30,0,30,3,5,3],
      [-8,0,-10,2,3,2],[45,0,-35,6,4,6],[-45,0,-40,5,9,5],[50,0,40,4,6,4],[-40,0,45,4,5,4]
    ];
    for (const [x, y, z, w, h, d] of placements) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat.clone());
      m.position.set(x, h / 2 + this.getHeight(x, z), z);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.box = new THREE.Box3().setFromObject(m);
      this.scene.add(m); this.obstacles.push(m);
      // edge glow
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.08, 0.08), glowMat);
      edge.position.set(x, h + this.getHeight(x, z) + 0.1, z + d / 2 + 0.01);
      this.scene.add(edge);
    }

    // core monument
    const coreBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 2, 8), new THREE.MeshStandardMaterial({ color: 0x2a3548, roughness: 0.5, metalness: 0.4 }));
    coreBase.position.set(0, 1, -8); coreBase.receiveShadow = true; coreBase.castShadow = true;
    this.scene.add(coreBase);
    this.coreOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({ color: 0x63eaff, emissive: 0x63eaff, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.5 }));
    this.coreOrb.position.set(0, 3.5, -8);
    this.scene.add(this.coreOrb);
    const coreLight = new THREE.PointLight(0x63eaff, 2, 25);
    coreLight.position.copy(this.coreOrb.position); this.scene.add(coreLight);

    // ambient particles (simple points)
    const pGeo = new THREE.BufferGeometry();
    const pCount = 500; const pArr = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) { pArr[i*3]=(Math.random()-0.5)*180; pArr[i*3+1]=Math.random()*20+1; pArr[i*3+2]=(Math.random()-0.5)*180; }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
    this.ambientPts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x63eaff, size: 0.12, transparent: true, opacity: 0.45 }));
    this.scene.add(this.ambientPts);
  }

  getHeight(x, z) {
    return (Math.sin(x * 0.04) * Math.cos(z * 0.04) * 1.2 + Math.sin(x * 0.015 + z * 0.02) * 1.5) * 0.35;
  }

  buildPlayer() {
    this.playerGroup = new THREE.Group();
    const c = new THREE.Color(this.heroDef.color);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a3448, roughness: 0.6, metalness: 0.3 });
    const glowMat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2 });

    // body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.8, 4, 8), mat);
    body.position.y = 1.1; body.castShadow = true; this.playerGroup.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), new THREE.MeshStandardMaterial({ color: 0xe4ccb5, roughness: 0.8 }));
    head.position.y = 1.95; head.castShadow = true; this.playerGroup.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.15), glowMat);
    visor.position.set(0, 1.97, 0.25); this.playerGroup.add(visor);
    // core
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), glowMat);
    core.position.set(0, 1.2, 0.42); this.playerGroup.add(core);
    // weapon indicator
    const weap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), glowMat);
    weap.position.set(0.45, 1.1, 0.4); weap.rotation.x = Math.PI / 4;
    this.playerGroup.add(weap);
    // ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.03, 8, 32), glowMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; this.playerGroup.add(ring);

    this.playerGroup.position.copy(this.player.pos);
    this.scene.add(this.playerGroup);
    this.playerLight = new THREE.PointLight(c, 1.2, 12);
    this.playerLight.position.y = 2; this.playerGroup.add(this.playerLight);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('keydown', e => { this.keys[e.code] = true; if (e.code === 'Escape') this.togglePause(); if (e.code === 'KeyE') this.useSkill(); });
    document.addEventListener('keyup', e => this.keys[e.code] = false);
    this.canvas.addEventListener('click', () => { if (!this.paused && !this.over && !this.pointerLocked) this.canvas.requestPointerLock?.(); else if (this.pointerLocked) this.attack(); });
    document.addEventListener('pointerlockchange', () => { this.pointerLocked = document.pointerLockElement === this.canvas; $('#crosshair').classList.toggle('hidden', !this.pointerLocked); });
    document.addEventListener('mousemove', e => { if (!this.pointerLocked) return; this.yaw -= e.movementX * 0.0025; this.pitch -= e.movementY * 0.002; this.pitch = clamp(this.pitch, -0.6, 1.2); });
    document.addEventListener('mousedown', e => { if (e.button === 0) this.mouseDown = true; });
    document.addEventListener('mouseup', e => { if (e.button === 0) this.mouseDown = false; });
  }
  onResize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); }

  // ---- GAMEPLAY ----
  spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const dist = rand(18, 55);
    const x = clamp(this.player.pos.x + Math.cos(angle) * dist, -90, 90);
    const z = clamp(this.player.pos.z + Math.sin(angle) * dist, -90, 90);
    const type = pick(['bug', 'virus', 'glitch']);
    const defs = {
      bug: { hp: 35, atk: 8, speed: 3.2, color: 0xff6464, scale: 0.7, xp: 25 },
      virus: { hp: 55, atk: 12, speed: 2.5, color: 0xbf7aff, scale: 0.9, xp: 40 },
      glitch: { hp: 80, atk: 15, speed: 2.0, color: 0xffbf5a, scale: 1.15, xp: 60 },
    };
    const d = defs[type];
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: d.color, emissive: d.color, emissiveIntensity: 0.35, roughness: 0.5, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.7 * d.scale, 0), mat);
    body.position.y = 0.9 * d.scale; body.castShadow = true; g.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15 * d.scale, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eye.position.set(0, 0.95 * d.scale, 0.5 * d.scale); g.add(eye);
    g.position.set(x, this.getHeight(x, z), z);
    this.scene.add(g);
    this.enemies.push({ mesh: g, ...d, maxHp: d.hp, pos: g.position, radius: 0.7 * d.scale, cd: rand(0.5, 1.5), dead: false, hitFlash: 0 });
  }

  attack() {
    if (this.attackCd > 0 || !this.player.alive || this.over) return;
    this.attackCd = this.heroDef.id === 'rin' ? 0.35 : this.heroDef.id === 'siren' ? 0.7 : 0.55;
    const dir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (this.heroDef.id === 'firon') {
      // ranged projectile
      this.spawnProjectile(this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), dir, this.player.atk, false);
      return;
    }
    // melee cone
    const range = this.heroDef.id === 'siren' ? 3.2 : 2.6;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const to = e.pos.clone().sub(this.player.pos); to.y = 0;
      const dist = to.length();
      if (dist > range) continue;
      to.normalize();
      if (to.dot(dir) < 0.45) continue;
      this.damageEnemy(e, this.player.atk + rand(-2, 3), false);
    }
    this.swingEffect();
  }

  useSkill() {
    if (this.skillCdLeft > 0 || !this.player.alive || this.over) return;
    if (this.player.mp < this.heroDef.skillCost) { this.toastMsg('MP insuficiente'); return; }
    this.player.mp -= this.heroDef.skillCost;
    this.skillCdLeft = this.heroDef.skillCd;
    const dir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const h = this.heroDef.id;
    if (h === 'rin') {
      // Patch Strike: dash + heavy hit
      this.player.pos.addScaledVector(dir, 5);
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.pos.distanceTo(this.player.pos) < 3.5) this.damageEnemy(e, this.player.atk * 2.2, true);
      }
      this.burstEffect(this.player.pos, this.heroDef.color, 20);
    } else if (h === 'siren') {
      this.player.shield = 6; this.player.invuln = 1.5;
      this.burstEffect(this.player.pos, this.heroDef.color, 18);
      this.toastMsg('Barreira ativada!');
    } else if (h === 'firon') {
      // Glitch Storm: AoE projectiles
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        this.spawnProjectile(this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), d, this.player.atk * 1.1, true);
      }
      this.burstEffect(this.player.pos, this.heroDef.color, 24);
    } else if (h === 'pyren') {
      const heal = Math.floor(this.player.maxHp * 0.35);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      this.spawnDmgText(this.player.pos, `+${heal}`, 'heal');
      this.burstEffect(this.player.pos, this.heroDef.color, 20);
    }
    this.updateHUD();
  }

  spawnProjectile(origin, dir, dmg, isSkill) {
    const c = new THREE.Color(this.heroDef.color);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(isSkill ? 0.28 : 0.22, 8, 8), new THREE.MeshBasicMaterial({ color: c }));
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, dir: dir.clone().normalize(), speed: 22, dmg, life: 2.5, owner: 'player' });
  }

  damageEnemy(e, dmg, crit) {
    const final = Math.max(1, Math.floor(dmg + rand(-2, 2)));
    e.hp -= final; e.hitFlash = 0.15;
    this.spawnDmgText(e.pos, final, crit ? 'crit' : 'hit');
    e.mesh.children[0].material.emissiveIntensity = 2;
    if (e.hp <= 0) this.killEnemy(e);
  }
  killEnemy(e) {
    e.dead = true; this.scene.remove(e.mesh);
    this.kills++;
    this.player.xp += e.xp;
    this.burstEffect(e.pos, '#' + e.color.toString(16).padStart(6, '0'), 12);
    if (Math.random() < 0.3) this.spawnPickup(e.pos.clone());
    while (this.player.xp >= this.player.xpNext) {
      this.player.xp -= this.player.xpNext; this.player.lvl++;
      this.player.xpNext = Math.floor(this.player.xpNext * 1.35);
      this.player.maxHp += 12; this.player.hp = this.player.maxHp;
      this.player.maxMp += 8; this.player.mp = this.player.maxMp;
      this.player.atk += 3;
      this.toastMsg(`Nível ${this.player.lvl}!`);
      this.burstEffect(this.player.pos, '#ffbf5a', 25);
    }
    this.updateHUD();
    if (this.kills >= this.targetKills) this.win();
  }

  spawnPickup(pos) {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), new THREE.MeshStandardMaterial({ color: 0x66dda0, emissive: 0x66dda0, emissiveIntensity: 1 }));
    mesh.position.copy(pos); mesh.position.y = this.getHeight(pos.x, pos.z) + 0.6;
    this.scene.add(mesh); this.pickups.push({ mesh, life: 20, baseY: mesh.position.y });
  }

  burstEffect(pos, color, count) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: c }));
      m.position.copy(pos); m.position.y += 1;
      const v = new THREE.Vector3(rand(-1,1), rand(0.2,1.2), rand(-1,1)).normalize().multiplyScalar(rand(2,6));
      this.scene.add(m); this.particles.push({ mesh: m, vel: v, life: rand(0.4, 1) });
    }
  }
  swingEffect() {
    const dir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const pos = this.player.pos.clone().addScaledVector(dir, 1.5); pos.y += 1;
    this.burstEffect(pos, this.heroDef.color, 6);
  }

  spawnDmgText(worldPos, text, type) {
    const v = worldPos.clone(); v.y += 2;
    v.project(this.camera);
    const x = (v.x * 0.5 + 0.5) * innerWidth;
    const y = (-v.y * 0.5 + 0.5) * innerHeight;
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = `dmg dmg--${type}`; el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    $('#damage-layer').appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
  toastMsg(msg) { $('#hud-quest').textContent = msg; setTimeout(() => this.updateHUD(), 1800); }

  damagePlayer(dmg) {
    if (this.player.invuln > 0 || !this.player.alive) return;
    let final = Math.max(1, Math.floor(dmg - this.player.def * 0.4 + rand(-1, 2)));
    if (this.player.shield > 0) { this.player.shield -= final; if (this.player.shield < 0) { final = -this.player.shield; this.player.shield = 0; } else final = 0; }
    this.player.hp -= final;
    if (final > 0) this.spawnDmgText(this.player.pos, final, 'hit');
    this.player.invuln = 0.4;
    if (this.player.hp <= 0) { this.player.hp = 0; this.player.alive = false; this.gameOver(); }
    this.updateHUD();
  }

  updateHUD() {
    const p = this.player, h = this.heroDef;
    $('#hud-name').textContent = h.name; $('#hud-class').textContent = h.role; $('#hud-lvl').textContent = `Nv ${p.lvl}`;
    $('#hud-hp').style.width = (p.hp / p.maxHp * 100) + '%'; $('#hud-hp-text').textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    $('#hud-mp').style.width = (p.mp / p.maxMp * 100) + '%'; $('#hud-mp-text').textContent = `${Math.ceil(p.mp)}/${p.maxMp}`;
    $('#hud-xp').style.width = (p.xp / p.xpNext * 100) + '%'; $('#hud-xp-text').textContent = `XP ${p.xp}/${p.xpNext}`;
    $('#hud-quest').textContent = this.kills >= this.targetKills ? 'Núcleo restaurado! Você venceu.' : `Missão: Derrote os bugs corrompidos (${this.kills}/${this.targetKills})`;
    $('#hud-atk').textContent = h.id === 'firon' ? 'Projétil' : 'Ataque';
    $('#hud-skill').textContent = h.skill;
    $('#hud-cd').textContent = this.skillCdLeft > 0 ? this.skillCdLeft.toFixed(1) + 's' : '';
  }

  togglePause() {
    if (this.over) return;
    this.paused = !this.paused;
    $('#pause').classList.toggle('hidden', !this.paused);
    if (this.paused) { document.exitPointerLock?.(); $('#pause-stats').textContent = `${this.heroDef.name} Nv ${this.player.lvl} · HP ${Math.ceil(this.player.hp)}/${this.player.maxHp} · Kills ${this.kills}/${this.targetKills}`; }
  }
  gameOver() {
    this.over = true; document.exitPointerLock?.();
    $('#go-title').textContent = 'Sistema corrompido';
    $('#go-text').textContent = `${this.heroDef.name} caiu em batalha. Bugs derrotados: ${this.kills}/${this.targetKills}.`;
    $('#gameover').classList.remove('hidden');
  }
  win() {
    this.over = true; document.exitPointerLock?.();
    $('#go-title').textContent = 'Núcleo restaurado!';
    $('#go-text').textContent = `Você derrotou ${this.kills} bugs e restaurou o Núcleo. ${this.heroDef.name} alcançou o nível ${this.player.lvl}!`;
    $('#gameover').classList.remove('hidden');
  }

  update(dt) {
    if (this.paused || this.over) return;
    this.time += dt;
    this.skillCdLeft = Math.max(0, this.skillCdLeft - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.player.invuln = Math.max(0, this.player.invuln - dt);
    this.player.mp = Math.min(this.player.maxMp, this.player.mp + 4 * dt);

    // movement
    const move = new THREE.Vector3();
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    if (this.keys['KeyW']) move.add(fwd);
    if (this.keys['KeyS']) move.sub(fwd);
    if (this.keys['KeyD']) move.add(right);
    if (this.keys['KeyA']) move.sub(right);
    if (move.lengthSq() > 0) move.normalize();
    const sprint = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const speed = this.player.speed * (sprint ? 1.55 : 1);
    this.player.pos.addScaledVector(move, speed * dt);
    this.player.pos.x = clamp(this.player.pos.x, -95, 95);
    this.player.pos.z = clamp(this.player.pos.z, -95, 95);

    // obstacle collision simple
    for (const o of this.obstacles) {
      const b = o.userData.box;
      const p = this.player.pos;
      const closest = new THREE.Vector3(clamp(p.x, b.min.x, b.max.x), p.y, clamp(p.z, b.min.z, b.max.z));
      const d = new THREE.Vector2(p.x - closest.x, p.z - closest.z);
      const dist = d.length();
      if (dist < this.player.radius && dist > 0.0001) { d.normalize(); p.x = closest.x + d.x * this.player.radius; p.z = closest.z + d.y * this.player.radius; }
    }

    this.player.pos.y = this.getHeight(this.player.pos.x, this.player.pos.z);
    this.playerGroup.position.copy(this.player.pos);
    this.playerGroup.rotation.y = this.yaw + Math.PI;

    // camera
    const camOff = new THREE.Vector3(0, 3.2, -this.camDist).applyAxisAngle(new THREE.Vector3(0,1,0), this.yaw);
    camOff.y += this.pitch * 4;
    const camTarget = this.player.pos.clone().add(new THREE.Vector3(0, 1.8, 0));
    this.camera.position.lerp(camTarget.clone().add(camOff), 0.1);
    this.camera.lookAt(camTarget.clone().add(new THREE.Vector3(0, 0.8, 0)));

    // core anim
    this.coreOrb.rotation.y += dt * 0.8; this.coreOrb.position.y = 3.5 + Math.sin(this.time * 1.5) * 0.3;

    // enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.mesh.children[0].material.emissiveIntensity = e.hitFlash > 0 ? 2 : 0.35;
      const toP = this.player.pos.clone().sub(e.pos); toP.y = 0;
      const dist = toP.length();
      if (dist > 1.5) { toP.normalize(); e.pos.addScaledVector(toP, e.speed * dt); e.mesh.rotation.y = Math.atan2(toP.x, toP.z); }
      e.pos.y = this.getHeight(e.pos.x, e.pos.z);
      e.mesh.position.copy(e.pos);
      e.mesh.children[0].rotation.y += dt * 1.5;
      e.cd -= dt;
      if (dist < 1.8 && e.cd <= 0) { e.cd = 1.2; this.damagePlayer(e.atk); }
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.life -= dt;
      p.mesh.position.addScaledVector(p.dir, p.speed * dt);
      let hit = false;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (p.mesh.position.distanceTo(e.pos.clone().add(new THREE.Vector3(0,1,0))) < e.radius + 0.4) {
          this.damageEnemy(e, p.dmg, false); hit = true; break;
        }
      }
      if (hit || p.life <= 0) { this.scene.remove(p.mesh); this.projectiles.splice(i, 1); }
    }

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.life -= dt; p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 4;
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); }
    }

    // pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i]; pk.life -= dt;
      pk.mesh.rotation.y += dt * 2; pk.mesh.position.y = pk.baseY + Math.sin(this.time * 3) * 0.15;
      if (pk.mesh.position.distanceTo(this.player.pos.clone().add(new THREE.Vector3(0,1,0))) < 1.6) {
        const heal = 18; this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        this.player.mp = Math.min(this.player.maxMp, this.player.mp + 12);
        this.spawnDmgText(this.player.pos, `+${heal}`, 'heal');
        this.scene.remove(pk.mesh); this.pickups.splice(i, 1); this.updateHUD(); continue;
      }
      if (pk.life <= 0) { this.scene.remove(pk.mesh); this.pickups.splice(i, 1); }
    }

    // spawn
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.filter(e => !e.dead).length < 10 && this.kills < this.targetKills) {
      this.spawnEnemy(); this.spawnTimer = rand(2.5, 5);
    }

    // auto attack for held mouse on melee
    if (this.mouseDown && this.pointerLocked && this.heroDef.id !== 'firon') this.attack();
    if (this.mouseDown && this.pointerLocked && this.heroDef.id === 'firon') this.attack();

    this.updateHUD();
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.over = true;
    document.exitPointerLock?.();
    this.renderer.dispose();
    window.removeEventListener('resize', this.onResize);
  }
}

// ---- BOOT ----
buildRoster();
$('#start-btn').addEventListener('click', () => {
  if (!selectedHero) return;
  $('#select-screen').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  $('#crosshair').classList.remove('hidden');
  if (game) game.destroy();
  game = new Game(selectedHero);
  $('#game').focus();
});
$('#resume-btn').addEventListener('click', () => game?.togglePause());
$('#restart-btn').addEventListener('click', () => location.reload());
$('#retry-btn').addEventListener('click', () => {
  $('#gameover').classList.add('hidden');
  if (game) game.destroy();
  game = new Game(selectedHero);
});
$('#back-btn').addEventListener('click', () => location.reload());
$('#hud-skill').addEventListener; // noop
document.addEventListener('click', (e) => { if (e.target.closest('#hud')) return; });
