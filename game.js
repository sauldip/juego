const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  round: document.getElementById('round'),
  hp: document.getElementById('hp'),
  xp: document.getElementById('xp'),
  eco: document.getElementById('eco'),
  cleaned: document.getElementById('cleaned'),
  picker: document.getElementById('picker'),
  shop: document.getElementById('shop'),
  message: document.getElementById('message'),
};

const characterTypes = {
  turtle: { hp: 130, speed: 2.2, damage: 16, color: '#6cf58f', skillCooldown: 7000 },
  puffer: { hp: 90, speed: 2.9, damage: 13, color: '#ffd46b', skillCooldown: 4500 },
  seahorse: { hp: 100, speed: 2.5, damage: 15, color: '#c39cff', skillCooldown: 5000 },
};

const pollutionNames = ['Botella', 'Bolsa', 'Lata', 'Red fantasma', 'Microplástico'];
const keys = new Set();
const state = {
  running: false,
  round: 1,
  xp: 0,
  eco: 0,
  cleaned: 0,
  inShop: false,
  enemies: [],
  projectiles: [],
  mines: [],
  effects: [],
  player: null,
  lastSpawn: 0,
  lastShot: 0,
  lastSkill: 0,
  startRoundAt: 0,
};

function setMessage(text) { ui.message.textContent = text; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randomEdgeSpawn() {
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return { x: Math.random() * canvas.width, y: -16 };
  if (edge === 1) return { x: canvas.width + 16, y: Math.random() * canvas.height };
  if (edge === 2) return { x: Math.random() * canvas.width, y: canvas.height + 16 };
  return { x: -16, y: Math.random() * canvas.height };
}

function pickCharacter(type) {
  const base = characterTypes[type];
  state.player = {
    type,
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 13,
    hp: base.hp,
    maxHp: base.hp,
    speed: base.speed,
    damage: base.damage,
    defense: 0,
    range: 220,
    color: base.color,
    skillCooldown: base.skillCooldown,
    shieldUntil: 0,
  };
  ui.picker.classList.add('hidden');
  state.running = true;
  state.startRoundAt = performance.now();
  setMessage('¡Limpia el océano! Consejo: evita quedar rodeado.');
}

function spawnEnemy(now) {
  const freq = Math.max(280, 1000 - state.round * 80);
  if (now - state.lastSpawn < freq) return;
  state.lastSpawn = now;
  const pos = randomEdgeSpawn();
  const hp = 20 + state.round * 8;
  state.enemies.push({
    ...pos,
    radius: 11,
    speed: 1.1 + state.round * 0.06,
    hp,
    maxHp: hp,
    damage: 7 + state.round * 0.6,
    label: pollutionNames[Math.floor(Math.random() * pollutionNames.length)],
  });
}

function nearestEnemy() {
  let best = null;
  let dist = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
    if (d < dist) { dist = d; best = e; }
  }
  return best;
}

function shootAtTarget(target) {
  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  const m = Math.hypot(dx, dy) || 1;
  state.projectiles.push({
    x: state.player.x,
    y: state.player.y,
    vx: (dx / m) * 5,
    vy: (dy / m) * 5,
    damage: state.player.damage,
    radius: 4,
  });
}

function autoAttack(now) {
  const cadence = state.player.type === 'puffer' ? 480 : 680;
  if (now - state.lastShot < cadence) return;
  const target = nearestEnemy();
  if (!target) return;
  state.lastShot = now;

  if (state.player.type === 'puffer') {
    for (let i = 0; i < 4; i += 1) {
      const angle = (Math.PI * 2 * i) / 4;
      state.projectiles.push({
        x: state.player.x,
        y: state.player.y,
        vx: Math.cos(angle) * 4.3,
        vy: Math.sin(angle) * 4.3,
        damage: state.player.damage * 0.7,
        radius: 3,
      });
    }
  } else {
    shootAtTarget(target);
  }
}

function trySkill(now) {
  if (!keys.has(' ') || now - state.lastSkill < state.player.skillCooldown) return;
  state.lastSkill = now;

  if (state.player.type === 'turtle') {
    state.player.shieldUntil = now + 1800;
    setMessage('Caparazón activo: daño reducido temporalmente.');
  } else if (state.player.type === 'puffer') {
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      state.projectiles.push({
        x: state.player.x,
        y: state.player.y,
        vx: Math.cos(angle) * 5,
        vy: Math.sin(angle) * 5,
        damage: state.player.damage * 0.8,
        radius: 3,
      });
    }
    setMessage('Espinas tóxicas: descarga radial.');
  } else {
    state.mines.push({ x: state.player.x, y: state.player.y, radius: 10, ttl: 7000, damage: 40 + state.player.damage });
    setMessage('Mina colocada: controla la zona.');
  }
}

function updateMovement() {
  const p = state.player;
  const up = keys.has('w') || keys.has('arrowup');
  const down = keys.has('s') || keys.has('arrowdown');
  const left = keys.has('a') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  const vx = (right ? 1 : 0) - (left ? 1 : 0);
  const vy = (down ? 1 : 0) - (up ? 1 : 0);
  const m = Math.hypot(vx, vy) || 1;
  p.x = clamp(p.x + (vx / m) * p.speed, p.radius, canvas.width - p.radius);
  p.y = clamp(p.y + (vy / m) * p.speed, p.radius, canvas.height - p.radius);
}

function updateProjectiles() {
  for (const b of state.projectiles) {
    b.x += b.vx;
    b.y += b.vy;
  }
  state.projectiles = state.projectiles.filter(
    (b) => b.x >= -10 && b.y >= -10 && b.x <= canvas.width + 10 && b.y <= canvas.height + 10
  );
}

function hitEnemy(enemy, damage) {
  enemy.hp -= damage;
  if (enemy.hp <= 0) {
    state.cleaned += 1;
    state.xp += 5;
    state.eco += 6;
    state.effects.push({ x: enemy.x, y: enemy.y, ttl: 300 });
    return true;
  }
  return false;
}

function resolveCombat(now) {
  for (const e of state.enemies) {
    const dx = state.player.x - e.x;
    const dy = state.player.y - e.y;
    const m = Math.hypot(dx, dy) || 1;
    e.x += (dx / m) * e.speed;
    e.y += (dy / m) * e.speed;

    const contact = Math.hypot(e.x - state.player.x, e.y - state.player.y) < e.radius + state.player.radius;
    if (contact) {
      const reduced = now < state.player.shieldUntil ? 0.4 : 1;
      state.player.hp -= Math.max(1, (e.damage - state.player.defense) * reduced * 0.03);
    }
  }

  for (const b of state.projectiles) {
    for (const e of state.enemies) {
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.radius + b.radius) {
        b.dead = true;
        if (hitEnemy(e, b.damage)) e.dead = true;
        break;
      }
    }
  }

  for (const mine of state.mines) {
    mine.ttl -= 16;
    for (const e of state.enemies) {
      if (Math.hypot(e.x - mine.x, e.y - mine.y) < e.radius + mine.radius + 8) {
        if (hitEnemy(e, mine.damage)) e.dead = true;
        mine.dead = true;
      }
    }
  }

  state.enemies = state.enemies.filter((e) => !e.dead);
  state.projectiles = state.projectiles.filter((b) => !b.dead);
  state.mines = state.mines.filter((m) => !m.dead && m.ttl > 0);
  state.effects = state.effects.filter((fx) => (fx.ttl -= 16) > 0);
}

function maybeRoundEnd(now) {
  const duration = 23000;
  if (now - state.startRoundAt < duration || state.inShop) return;
  state.inShop = true;
  ui.shop.classList.remove('hidden');
  setMessage('Mensaje ambiental: una bolsa plástica puede matar una tortuga.');
}

function updateHud() {
  ui.round.textContent = String(state.round);
  ui.hp.textContent = Math.max(0, Math.round(state.player.hp));
  ui.xp.textContent = String(state.xp);
  ui.eco.textContent = String(state.eco);
  ui.cleaned.textContent = String(state.cleaned);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0a3550';
  for (let i = 0; i < 50; i += 1) {
    ctx.fillRect((i * 101) % canvas.width, ((i * 67) + state.round * 5) % canvas.height, 2, 2);
  }

  for (const e of state.enemies) {
    ctx.fillStyle = '#ff7b72';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of state.projectiles) {
    ctx.fillStyle = '#34d6ff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const mine of state.mines) {
    ctx.fillStyle = '#c39cff';
    ctx.beginPath();
    ctx.arc(mine.x, mine.y, mine.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const fx of state.effects) {
    ctx.strokeStyle = '#6cf58f';
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, 10 + (300 - fx.ttl) * 0.08, 0, Math.PI * 2);
    ctx.stroke();
  }

  const p = state.player;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();

  if (performance.now() < p.shieldUntil) {
    ctx.strokeStyle = '#6cf58f';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function gameLoop(now) {
  if (!state.running) return;

  if (state.player.hp <= 0) {
    state.running = false;
    setMessage('Fin de la partida. Recarga para intentarlo de nuevo.');
    updateHud();
    draw();
    return;
  }

  if (!state.inShop) {
    updateMovement();
    spawnEnemy(now);
    autoAttack(now);
    trySkill(now);
    updateProjectiles();
    resolveCombat(now);
    maybeRoundEnd(now);
  }

  updateHud();
  draw();
  requestAnimationFrame(gameLoop);
}

function applyUpgrade(type) {
  const costs = { speed: 20, damage: 25, defense: 25, range: 20, heal: 30 };
  if (state.eco < costs[type]) {
    setMessage('No tienes eco-puntos suficientes.');
    return;
  }
  state.eco -= costs[type];

  if (type === 'speed') state.player.speed += 0.25;
  if (type === 'damage') state.player.damage += 4;
  if (type === 'defense') state.player.defense += 1;
  if (type === 'range') state.player.range += 20;
  if (type === 'heal') state.player.hp = Math.min(state.player.maxHp, state.player.hp + 30);
  setMessage('Mejora aplicada.');
  updateHud();
}

function bindUi() {
  document.querySelectorAll('[data-char]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pickCharacter(btn.dataset.char);
      requestAnimationFrame(gameLoop);
    });
  });

  document.querySelectorAll('[data-upgrade]').forEach((btn) => {
    btn.addEventListener('click', () => applyUpgrade(btn.dataset.upgrade));
  });

  document.getElementById('nextRound').addEventListener('click', () => {
    state.round += 1;
    state.inShop = false;
    state.startRoundAt = performance.now();
    ui.shop.classList.add('hidden');
    setMessage('Siguiente ronda iniciada.');
  });

  addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
}

bindUi();
setMessage('Selecciona un personaje para comenzar.');
