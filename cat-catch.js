// ==========================================
// CAT CATCH - MINIMAL ENGINE
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// DOM Elements
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const messageEl = document.getElementById('message');
const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const gameOverReasonEl = document.getElementById('gameOverReason');
const soundBtn = document.getElementById('soundBtn');
const menuMascot = document.getElementById('menuMascot');

// Game State
let W = 0, H = 0, dpr = 1, last = 0;
let running = false, paused = false, score = 0, level = 1, combo = 0;
let spawnTimer = 0, levelTimer = 0, shake = 0;
let objects = [], particles = [], floatingTexts = [];
let best = Number(localStorage.getItem('catCatchBest') || 0);
let currentSkin = 'tabby';
let isMuted = false;

// Background ambient star dust
let stars = [];

// Cat Character State
const cat = {
  x: 0, y: 0, targetX: 0,
  w: 80, h: 70,
  tilt: 0, bounceTimer: 0,
  faceState: 'normal', // normal, happy, shocked
  faceTimer: 0,
  stretchY: 1, stretchX: 1
};

// Item Definitions
const goodItems = ['fish', 'yarn', 'star', 'donut'];
const badItems = ['rock', 'bomb'];

// ==========================================
// RESIZE & SETUP
// ==========================================
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  cat.y = H - 85;
  if (!cat.x) {
    cat.x = W / 2;
    cat.targetX = W / 2;
  }

  // Generate subtle background stars
  stars = [];
  for (let i = 0; i < 35; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * (H * 0.7),
      size: 1 + Math.random() * 2,
      alpha: 0.2 + Math.random() * 0.5,
      speed: 0.2 + Math.random() * 0.5
    });
  }
}
window.addEventListener('resize', resize);
resize();

// ==========================================
// AUDIO SYNTHESIZER (LO-FI MINIMAL CHILL)
// ==========================================
let audioCtx = null;
let musicStep = 0;
let musicInterval = null;

// Warm Pentatonic Ambient Sequence
const melodyNotes = [
  440.00, 523.25, 659.25, 783.99, // A4, C5, E5, G5
  523.25, 659.25, 783.99, 880.00, // C5, E5, G5, A5
  587.33, 698.46, 880.00, 1046.50 // D5, F5, A5, C6
];

function initAudio() {
  if (audioCtx) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    audioCtx = new AudioContextClass();
  }
}

function startMusic() {
  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  if (musicInterval) clearInterval(musicInterval);

  musicInterval = setInterval(() => {
    if (!audioCtx || paused || !running || isMuted) return;

    const step = musicStep % 16;
    const time = audioCtx.currentTime;

    // Ambient soft synth lead
    if (step % 2 === 0) {
      const freq = melodyNotes[musicStep % melodyNotes.length];
      playSynthNote(freq, 0.25, 'sine', 0.02, time);
    }

    // Soft warm bass pulse
    if (step % 4 === 0) {
      playSynthNote(220 / (step % 8 === 0 ? 2 : 1.5), 0.3, 'triangle', 0.03, time);
    }

    musicStep++;
  }, 220);
}

function playSynthNote(freq, dur, type = 'sine', gainVal = 0.04, time = null) {
  if (!audioCtx || isMuted) return;
  const t = time || audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);

  gain.gain.setValueAtTime(gainVal, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(t);
  osc.stop(t + dur);
}

function sfx(kind) {
  if (!audioCtx || isMuted) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const now = audioCtx.currentTime;
  if (kind === 'catch') {
    playSynthNote(659.25, 0.1, 'sine', 0.06, now);
    playSynthNote(880.00, 0.12, 'sine', 0.06, now + 0.05);
  } else if (kind === 'combo') {
    playSynthNote(783.99, 0.1, 'triangle', 0.08, now);
    playSynthNote(1046.50, 0.15, 'triangle', 0.08, now + 0.07);
  } else if (kind === 'level') {
    [523, 659, 784, 1046].forEach((f, idx) => {
      playSynthNote(f, 0.2, 'sine', 0.06, now + idx * 0.08);
    });
  } else if (kind === 'rock' || kind === 'bomb') {
    playSynthNote(150, 0.3, 'sawtooth', 0.08, now);
  } else if (kind === 'click') {
    playSynthNote(523, 0.04, 'sine', 0.04, now);
  }
}

// Sound toggle listener (if button exists)
if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    soundBtn.textContent = isMuted ? '🔇' : '🔊';
    if (!isMuted) startMusic();
  });
}

// ==========================================
// SKIN SELECTOR & CONTROLS
// ==========================================
const skinBtns = document.querySelectorAll('.skin-btn, .skin-card');
skinBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    skinBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSkin = btn.dataset.skin;

    const mascotMap = { tabby: '🐱', ninja: '🥷', rainbow: '🌈', space: '🚀' };
    if (menuMascot) menuMascot.textContent = mascotMap[currentSkin] || '🐱';
    sfx('click');
  });
});

function resetGame() {
  score = 0;
  level = 1;
  combo = 0;
  spawnTimer = 0;
  levelTimer = 0;
  shake = 0;
  objects = [];
  particles = [];
  floatingTexts = [];
  paused = false;
  running = true;

  cat.x = W / 2;
  cat.targetX = W / 2;
  cat.y = H - 85;
  cat.faceState = 'normal';

  scoreEl.textContent = '0';
  levelEl.textContent = '1';
  comboEl.textContent = '0x';

  startOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');

  startMusic();
}

function startGame() {
  sfx('click');
  resetGame();
}

document.getElementById('startBtn').onclick = startGame;
document.getElementById('restartBtn').onclick = startGame;

function moveCat(dir) {
  if (!running || paused) return;
  const moveDist = Math.max(85, W * 0.2);
  cat.targetX = Math.max(50, Math.min(W - 50, cat.targetX + dir * moveDist));
  cat.tilt = dir * 0.15;
  cat.stretchX = 1.1;
  cat.stretchY = 0.9;
  sfx('click');
}

document.querySelector('.left-zone').addEventListener('pointerdown', e => { e.preventDefault(); moveCat(-1); });
document.querySelector('.right-zone').addEventListener('pointerdown', e => { e.preventDefault(); moveCat(1); });

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') moveCat(-1);
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') moveCat(1);
  if (e.code === 'Space' && !running) startGame();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) paused = true;
  else if (running) paused = false;
});
window.addEventListener('blur', () => { if (running) paused = true; });

// ==========================================
// SPAWNING & OBJECT LOGIC
// ==========================================
function getNextObjectType() {
  const badChance = Math.min(0.3, 0.12 + (level - 1) * 0.015);
  if (Math.random() < badChance) {
    return Math.random() < 0.5 ? 'rock' : 'bomb';
  }
  const rand = Math.random();
  if (rand < 0.4) return 'fish';
  if (rand < 0.7) return 'yarn';
  if (rand < 0.88) return 'star';
  return 'donut';
}

function spawnObject() {
  const size = 38 + Math.random() * 10;
  const type = getNextObjectType();
  const speed = 130 + level * 18 + Math.random() * 50;
  objects.push({
    x: 40 + Math.random() * (W - 80),
    y: -40,
    size,
    type,
    vy: speed,
    rot: Math.random() * 6.28,
    spin: (Math.random() - 0.5) * 1.8
  });
}

function addScore(points, type) {
  combo++;
  const comboBonus = Math.min(100, combo * 5);
  const total = points + comboBonus;
  score += total;

  scoreEl.textContent = score;
  comboEl.textContent = combo + 'x';

  cat.faceState = 'happy';
  cat.faceTimer = 0.4;
  cat.stretchY = 1.18;
  cat.stretchX = 0.88;

  if (combo >= 5) {
    sfx('combo');
    showToastMessage('🔥 ' + combo + 'x Combo! +' + total);
    spawnFloatingText(cat.x, cat.y - 60, '+' + total, '#f43f5e');
  } else {
    sfx('catch');
    spawnFloatingText(cat.x, cat.y - 50, '+' + total, '#38bdf8');
  }

  createBurstParticles(cat.x, cat.y - 25, type);
}

let toastTimeout = null;
function showToastMessage(txt) {
  messageEl.textContent = txt;
  messageEl.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    messageEl.classList.remove('show');
  }, 1400);
}

function spawnFloatingText(x, y, text, color) {
  floatingTexts.push({ x, y, text, color, life: 0.7, maxLife: 0.7, vy: -40 });
}

function triggerGameOver(reason) {
  running = false;
  cat.faceState = 'shocked';
  cat.faceTimer = 2.0;

  sfx('rock');
  shake = 8;

  best = Math.max(best, score);
  localStorage.setItem('catCatchBest', best);

  finalScoreEl.textContent = score;
  bestScoreEl.textContent = best;

  gameOverReasonEl.textContent = reason === 'bomb'
    ? 'Watch out for explosives!'
    : 'Watch out for falling rocks!';

  gameOverOverlay.classList.remove('hidden');
}

// ==========================================
// PARTICLES
// ==========================================
function createBurstParticles(x, y, type) {
  const count = type === 'bomb' ? 18 : 10;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 160;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5,
      maxLife: 0.5,
      type,
      size: 6 + Math.random() * 8
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 200 * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.life -= dt;
    ft.y += ft.vy * dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.translate(p.x, p.y);
    ctx.fillStyle = p.type === 'star' ? '#facc15' : p.type === 'bomb' ? '#f43f5e' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const ft of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
    ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = ft.color;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}

// ==========================================
// CANVAS RENDER ROUTINES
// ==========================================
function drawBackground(t) {
  // Deep Minimal Slate Ambient Canvas
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.7, '#1e293b');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle twinkling stars
  for (const s of stars) {
    s.y += s.speed * 0.2;
    if (s.y > H * 0.8) s.y = 0;
    ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha * (0.6 + 0.4 * Math.sin(t * 0.002 + s.x))})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft Ground Platform Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H - 45);
  ctx.lineTo(W, H - 45);
  ctx.stroke();

  // Gentle ambient ground glow
  const groundGrad = ctx.createLinearGradient(0, H - 45, 0, H);
  groundGrad.addColorStop(0, 'rgba(79, 70, 229, 0.08)');
  groundGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, H - 45, W, 45);
}

function drawObject(o) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.rot);

  const emojiMap = {
    fish: '🐟',
    yarn: '🧶',
    star: '⭐',
    donut: '🍩',
    rock: '🪨',
    bomb: '💣'
  };

  const symbol = emojiMap[o.type] || '🧶';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(o.size * 1.1)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;

  // Soft subtle drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowOffsetY = 3;
  ctx.shadowBlur = 6;

  ctx.fillText(symbol, 0, 0);
  ctx.restore();
}

function drawCat() {
  ctx.save();
  ctx.translate(cat.x, cat.y);
  ctx.rotate(cat.tilt);
  ctx.scale(cat.stretchX, cat.stretchY);

  // Soft Floor Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 30, 36, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Palette settings
  let mainColor = '#f97316', earColor = '#fb7185', detailColor = '#ea580c';
  if (currentSkin === 'ninja') {
    mainColor = '#334155'; earColor = '#f43f5e'; detailColor = '#1e293b';
  } else if (currentSkin === 'rainbow') {
    mainColor = '#a855f7'; earColor = '#38bdf8'; detailColor = '#c084fc';
  } else if (currentSkin === 'space') {
    mainColor = '#6366f1'; earColor = '#38bdf8'; detailColor = '#4f46e5';
  }

  // Tail
  const tailWave = Math.sin(cat.bounceTimer * 6) * 0.2;
  ctx.save();
  ctx.translate(28, 6);
  ctx.rotate(tailWave);
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(15, -10, 20, -22);
  ctx.stroke();
  ctx.restore();

  // Body
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.roundRect(-34, -10, 68, 44, 20);
  ctx.fill();

  // Belly
  ctx.fillStyle = '#fffdf5';
  ctx.beginPath();
  ctx.ellipse(0, 12, 18, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.arc(0, -28, 32, 0, Math.PI * 2);
  ctx.fill();

  // Left Ear
  ctx.beginPath();
  ctx.moveTo(-26, -46);
  ctx.lineTo(-18, -68);
  ctx.lineTo(-4, -54);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = earColor;
  ctx.beginPath();
  ctx.moveTo(-22, -48);
  ctx.lineTo(-17, -62);
  ctx.lineTo(-8, -53);
  ctx.closePath();
  ctx.fill();

  // Right Ear
  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.moveTo(26, -46);
  ctx.lineTo(18, -68);
  ctx.lineTo(4, -54);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = earColor;
  ctx.beginPath();
  ctx.moveTo(22, -48);
  ctx.lineTo(17, -62);
  ctx.lineTo(8, -53);
  ctx.closePath();
  ctx.fill();

  // Face Eyes & Expression
  ctx.fillStyle = '#0f172a';
  if (cat.faceState === 'shocked') {
    ctx.font = '600 14px sans-serif';
    ctx.fillText('✖', -16, -26);
    ctx.fillText('✖', 4, -26);
  } else if (cat.faceState === 'happy') {
    ctx.beginPath();
    ctx.arc(-12, -26, 4, 0, Math.PI * 2);
    ctx.arc(12, -26, 4, 0, Math.PI * 2);
    ctx.fill();
    // Smile
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -20, 5, 0, Math.PI);
    ctx.stroke();
  } else {
    // Normal Eyes
    ctx.beginPath();
    ctx.arc(-12, -28, 4.5, 0, Math.PI * 2);
    ctx.arc(12, -28, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye catchlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-13.5, -29.5, 1.8, 0, Math.PI * 2);
    ctx.arc(10.5, -29.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = earColor;
    ctx.beginPath();
    ctx.arc(0, -22, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Paws
  ctx.fillStyle = '#fffdf5';
  ctx.beginPath();
  ctx.ellipse(-20, 22, 10, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(20, 22, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ==========================================
// GAME LOOP
// ==========================================
function update(dt, t) {
  if (!running || paused) return;

  levelTimer += dt;
  spawnTimer -= dt;
  cat.bounceTimer += dt;

  if (cat.faceTimer > 0) {
    cat.faceTimer -= dt;
    if (cat.faceTimer <= 0) cat.faceState = 'normal';
  }

  cat.stretchX += (1 - cat.stretchX) * Math.min(1, dt * 10);
  cat.stretchY += (1 - cat.stretchY) * Math.min(1, dt * 10);
  cat.tilt += (0 - cat.tilt) * Math.min(1, dt * 8);

  const newLevel = Math.floor(score / 300) + 1;
  if (newLevel > level) {
    level = newLevel;
    levelEl.textContent = level;
    sfx('level');
    showToastMessage('🎉 Level ' + level + '!');
    shake = 6;
  }

  if (spawnTimer <= 0) {
    spawnObject();
    const minDelay = Math.max(0.3, 0.7 - level * 0.02);
    spawnTimer = minDelay * (0.85 + Math.random() * 0.3);
  }

  cat.x += (cat.targetX - cat.x) * Math.min(1, dt * 12);

  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    o.y += o.vy * dt;
    o.rot += o.spin * dt;

    const dx = o.x - cat.x;
    const dy = o.y - (cat.y - 20);
    const hitDistance = Math.hypot(dx, dy);

    if (hitDistance < o.size * 0.7 + 30) {
      objects.splice(i, 1);
      if (badItems.includes(o.type)) {
        triggerGameOver(o.type);
        return;
      } else {
        const pointsMap = { star: 30, donut: 50, yarn: 20, fish: 15 };
        addScore(pointsMap[o.type] || 15, o.type);
      }
      continue;
    }

    if (o.y > H + 50) {
      objects.splice(i, 1);
      if (goodItems.includes(o.type)) {
        combo = 0;
        comboEl.textContent = '0x';
      }
    }
  }

  updateParticles(dt);
  shake = Math.max(0, shake - dt * 20);
}

function draw(t) {
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  drawBackground(t);

  for (const o of objects) {
    drawObject(o);
  }

  drawCat();
  drawParticles();

  ctx.restore();
}

function loop(t) {
  const dt = Math.min(0.033, (t - last) / 1000 || 0);
  last = t;
  update(dt, t);
  draw(t);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
