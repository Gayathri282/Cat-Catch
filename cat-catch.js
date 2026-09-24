// ==========================================
// 🐱 CAT CATCH - TOON DASH ENGINE
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

// Game State Variables
let W = 0, H = 0, dpr = 1, last = 0;
let running = false, paused = false, score = 0, level = 1, combo = 0;
let spawnTimer = 0, levelTimer = 0, shake = 0;
let objects = [], particles = [], comicTexts = [];
let best = Number(localStorage.getItem('catCatchBest') || 0);
let currentSkin = 'tabby';
let isMuted = false;

// Cat Character State
const cat = {
  x: 0, y: 0, targetX: 0,
  w: 90, h: 80,
  tilt: 0, bounceTimer: 0,
  faceState: 'normal', // normal, happy, shocked
  faceTimer: 0,
  stretchY: 1, stretchX: 1
};

// Item Definitions
const goodItems = ['fish', 'yarn', 'star', 'donut'];
const badItems = ['rock', 'bomb'];

// ==========================================
// WINDOW RESIZE & INITIALIZATION
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

  cat.y = H - 95;
  if (!cat.x) {
    cat.x = W / 2;
    cat.targetX = W / 2;
  }
}
window.addEventListener('resize', resize);
resize();

// ==========================================
// DYNAMIC WEB AUDIO SYNTHESIZER (HYPING MUSIC & SFX)
// ==========================================
let audioCtx = null;
let musicStep = 0;
let musicInterval = null;

// Catchy synth music note sequence (Upbeat Cartoon Synthwave/Chiptune)
const melodyNotes = [
  523.25, 659.25, 783.99, 1046.50, // C5, E5, G5, C6
  587.33, 698.46, 880.00, 1046.50, // D5, F5, A5, C6
  659.25, 783.99, 987.77, 1174.66, // E5, G5, B5, D6
  783.99, 880.00, 1046.50, 1318.51  // G5, A5, C6, E6
];

const bassNotes = [
  130.81, 130.81, 164.81, 196.00,
  146.83, 146.83, 174.61, 220.00,
  164.81, 164.81, 196.00, 246.94,
  196.00, 220.00, 261.63, 293.66
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

  // Hyped music loop: step every 140ms (High tempo ~ 214 BPM)
  musicInterval = setInterval(() => {
    if (!audioCtx || paused || !running || isMuted) return;

    const step = musicStep % 16;
    const time = audioCtx.currentTime;

    // 1. Synthesized Lead Melody (Upbeat pulse wave)
    if (step % 2 === 0) {
      const freq = melodyNotes[(musicStep % melodyNotes.length)];
      playSynthNote(freq, 0.12, 'square', 0.03, time);
    }

    // 2. Synthesized Bassline (Punchy triangle wave)
    if (step % 4 === 0) {
      const bassFreq = bassNotes[Math.floor(musicStep / 2) % bassNotes.length];
      playSynthNote(bassFreq, 0.18, 'triangle', 0.06, time);
    }

    // 3. Synthesized Hi-Hat Percussion (White noise burst)
    if (step % 2 === 1) {
      playNoisePercussion(0.04, 0.02, time);
    }

    // 4. Synthesized Snare/Kick Percussion on beats
    if (step % 4 === 2) {
      playNoisePercussion(0.08, 0.04, time);
    } else if (step % 8 === 0) {
      // Kick drum pitch drop
      playKick(time);
    }

    musicStep++;
  }, 140);
}

function playSynthNote(freq, dur, type = 'sine', gainVal = 0.05, time = null) {
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

function playNoisePercussion(dur, gainVal, time) {
  if (!audioCtx || isMuted) return;
  const t = time || audioCtx.currentTime;
  const bufferSize = audioCtx.sampleRate * dur;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1000;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(gainVal, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  noise.start(t);
}

function playKick(t) {
  if (!audioCtx || isMuted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);

  gain.gain.setValueAtTime(0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(t);
  osc.stop(t + 0.12);
}

function sfx(kind) {
  if (!audioCtx || isMuted) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const now = audioCtx.currentTime;
  if (kind === 'catch') {
    playSynthNote(784, 0.08, 'triangle', 0.08, now);
    playSynthNote(1046, 0.12, 'triangle', 0.08, now + 0.06);
  } else if (kind === 'combo') {
    playSynthNote(659, 0.08, 'square', 0.08, now);
    playSynthNote(880, 0.08, 'square', 0.08, now + 0.07);
    playSynthNote(1174, 0.16, 'square', 0.09, now + 0.14);
  } else if (kind === 'level') {
    [523, 659, 784, 1046].forEach((f, idx) => {
      playSynthNote(f, 0.15, 'triangle', 0.08, now + idx * 0.08);
    });
  } else if (kind === 'rock') {
    playSynthNote(180, 0.25, 'sawtooth', 0.09, now);
  } else if (kind === 'bomb') {
    playNoisePercussion(0.35, 0.15, now);
    playSynthNote(90, 0.35, 'sawtooth', 0.12, now);
  } else if (kind === 'click') {
    playSynthNote(480, 0.05, 'sine', 0.05, now);
  }
}

// Sound toggle listener
soundBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  soundBtn.textContent = isMuted ? '🔇' : '🔊';
  if (!isMuted) startMusic();
});

// ==========================================
// SKIN SELECTOR & GAME CONTROLS
// ==========================================
const skinBtns = document.querySelectorAll('.skin-card, .skin-btn');
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
  comicTexts = [];
  paused = false;
  running = true;

  cat.x = W / 2;
  cat.targetX = W / 2;
  cat.y = H - 95;
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
  const moveDist = Math.max(90, W * 0.22);
  cat.targetX = Math.max(50, Math.min(W - 50, cat.targetX + dir * moveDist));
  cat.tilt = dir * 0.22;
  cat.stretchX = 1.15;
  cat.stretchY = 0.88;
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
  const badChance = Math.min(0.32, 0.14 + (level - 1) * 0.015);
  if (Math.random() < badChance) {
    return Math.random() < 0.55 ? 'rock' : 'bomb';
  }
  const rand = Math.random();
  if (rand < 0.38) return 'fish';
  if (rand < 0.68) return 'yarn';
  if (rand < 0.88) return 'star';
  return 'donut';
}

function spawnObject() {
  const size = 42 + Math.random() * 12;
  const type = getNextObjectType();
  const speed = 120 + level * 16 + Math.random() * 60;
  objects.push({
    x: 45 + Math.random() * (W - 90),
    y: -50,
    size,
    type,
    vy: speed,
    rot: Math.random() * 6.28,
    spin: (Math.random() - 0.5) * 2.5
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
  cat.faceTimer = 0.45;
  cat.stretchY = 1.25;
  cat.stretchX = 0.85;

  if (combo >= 5) {
    sfx('combo');
    showComicMessage('🔥 MEGA COMBO! +' + total);
    spawnComicText(cat.x, cat.y - 70, 'MEGA COMBO!', '#ff4785');
  } else {
    sfx('catch');
    const labelMap = { star: '✨ SUPER!', donut: '🍩 YUM!', fish: '🐟 TASTY!', yarn: '🧶 FUN!' };
    showComicMessage((labelMap[type] || '👍 GOOD!') + ' +' + total);
    spawnComicText(cat.x, cat.y - 60, '+' + total, '#ffd000');
  }

  createBurstParticles(cat.x, cat.y - 30, type);
}

function showComicMessage(txt) {
  messageEl.textContent = txt;
  messageEl.classList.remove('show');
  void messageEl.offsetWidth;
  messageEl.classList.add('show');
}

function spawnComicText(x, y, text, color) {
  comicTexts.push({ x, y, text, color, life: 0.8, maxLife: 0.8, vy: -60 });
}

function triggerGameOver(reason) {
  running = false;
  cat.faceState = 'shocked';
  cat.faceTimer = 2.0;

  sfx(reason === 'bomb' ? 'bomb' : 'rock');
  shake = 12;

  best = Math.max(best, score);
  localStorage.setItem('catCatchBest', best);

  finalScoreEl.textContent = score;
  bestScoreEl.textContent = best;

  gameOverReasonEl.textContent = reason === 'bomb'
    ? '💥 BOOM! Watch out for lit dynamite bombs!'
    : '🪨 BONK! Heavy rocks cause big headaches!';

  gameOverOverlay.classList.remove('hidden');
}

// ==========================================
// PARTICLE SYSTEM
// ==========================================
function createBurstParticles(x, y, type) {
  const count = type === 'bomb' ? 25 : 14;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 220;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.7,
      maxLife: 0.7,
      type,
      size: 10 + Math.random() * 12
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt; // gravity
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = comicTexts.length - 1; i >= 0; i--) {
    const ct = comicTexts[i];
    ct.life -= dt;
    ct.y += ct.vy * dt;
    if (ct.life <= 0) comicTexts.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.translate(p.x, p.y);

    if (p.type === 'star') {
      ctx.fillStyle = '#ffd000';
      ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'donut') {
      ctx.fillStyle = '#ff4785';
      ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'bomb') {
      ctx.fillStyle = Math.random() < 0.5 ? '#ff4785' : '#ff7e29';
      ctx.beginPath(); ctx.arc(0, 0, p.size / 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#38b6ff';
      ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  for (const ct of comicTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ct.life / ct.maxLife);
    ctx.font = '900 22px "Lilita One", cursive';
    ctx.fillStyle = ct.color;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.strokeText(ct.text, ct.x, ct.y);
    ctx.fillText(ct.text, ct.x, ct.y);
    ctx.restore();
  }
}

// ==========================================
// 2D TOON CANVAS DRAWING ROUTINES
// ==========================================

// Helper: 2D Cartoon Rounded Rect with Thick Outline
function drawToonPath(pathFunc, fillColor, strokeColor = '#1e293b', strokeWidth = 4) {
  ctx.save();
  ctx.beginPath();
  pathFunc();
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

function drawBackground(t) {
  // 1. Toon Sky Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#38b6ff');
  skyGrad.addColorStop(0.55, '#8ee8ff');
  skyGrad.addColorStop(0.56, '#52d053');
  skyGrad.addColorStop(1, '#2ba82c');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Winking Cartoon Sun with Sunglasses
  ctx.save();
  const sunX = W - 70, sunY = 75;
  ctx.translate(sunX, sunY);
  ctx.rotate(t * 0.0005);
  ctx.fillStyle = '#ffd000';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  // Sun rays
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 35, Math.sin(a) * 35);
    ctx.lineTo(Math.cos(a) * 48, Math.sin(a) * 48);
    ctx.stroke();
  }
  // Sun Body
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Cool Sunglasses
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-20, -8, 16, 12);
  ctx.fillRect(4, -8, 16, 12);
  ctx.fillRect(-4, -6, 8, 3);
  ctx.restore();

  // 3. Parallax 2D Cartoon Clouds
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    const cloudX = ((i * 260 + t * 0.015) % (W + 240)) - 120;
    const cloudY = 70 + (i % 3) * 60;
    ctx.save();
    ctx.translate(cloudX, cloudY);
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.arc(24, -12, 30, 0, Math.PI * 2);
    ctx.arc(54, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 4. Rolling Green Cartoon Hills & Bushes
  ctx.fillStyle = '#3eb340';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  for (let x = -20; x < W + 40; x += 75) {
    ctx.beginPath();
    ctx.arc(x, H - 35, 45, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
  }

  // Cute Little Flowers
  const flowerColors = ['#ff4785', '#ffd000', '#9d4edd'];
  for (let i = 0; i < W; i += 90) {
    const fx = i + 35, fy = H - 22;
    ctx.fillStyle = flowerColors[(i / 90) % flowerColors.length];
    ctx.beginPath();
    ctx.arc(fx, fy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(fx, fy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 2D Cartoon Falling Items with loved Woolen Thread Yarn & Toy graphics
function drawObject(o) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.rot);

  // 1. Draw special Woolen Thread String for Yarn Ball 🧶
  if (o.type === 'yarn') {
    ctx.save();
    ctx.strokeStyle = '#ff4785';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const wave = Math.sin(o.y * 0.05) * 15;
    ctx.quadraticCurveTo(-15 + wave, -25, -25, -45);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Draw Fish Water Splashes 🐟
  if (o.type === 'fish') {
    ctx.fillStyle = '#38b6ff';
    ctx.beginPath();
    ctx.arc(-o.size * 0.4, -o.size * 0.3, 3, 0, Math.PI * 2);
    ctx.arc(o.size * 0.4, -o.size * 0.4, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Draw Lit Fuse Flame for Bomb 💣
  if (o.type === 'bomb') {
    ctx.fillStyle = Math.random() < 0.5 ? '#ffd000' : '#ff4785';
    ctx.beginPath();
    ctx.arc(o.size * 0.2, -o.size * 0.45, 6 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Render loved iconic Emoji Toys with Cartoon Drop Shadow
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
  ctx.font = `${Math.round(o.size * 1.15)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;

  // Cartoon 2D Drop Shadow
  ctx.shadowColor = 'rgba(30, 41, 59, 0.4)';
  ctx.shadowOffsetY = 4;
  ctx.shadowBlur = 0;

  ctx.fillText(symbol, 0, 0);

  ctx.restore();
}

// 2D Cartoon Kitty Character Rendering
function drawCat() {
  ctx.save();
  ctx.translate(cat.x, cat.y);
  ctx.rotate(cat.tilt);
  ctx.scale(cat.stretchX, cat.stretchY);

  // 1. Shadow Offset
  ctx.fillStyle = 'rgba(30, 41, 59, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 34, 46, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Skin Palette selection
  let bodyColor = '#ff9100', innerEarColor = '#ff4785', stripeColor = '#e05300';
  if (currentSkin === 'ninja') {
    bodyColor = '#334155'; innerEarColor = '#ff4785'; stripeColor = '#0f172a';
  } else if (currentSkin === 'rainbow') {
    bodyColor = '#ff4785'; innerEarColor = '#ffd000'; stripeColor = '#38b6ff';
  } else if (currentSkin === 'space') {
    bodyColor = '#9d4edd'; innerEarColor = '#38b6ff'; stripeColor = '#7b2cbf';
  }

  // 2. Tail (Animated Swaying)
  const tailAngle = Math.sin(cat.bounceTimer * 8) * 0.3;
  ctx.save();
  ctx.translate(34, 10);
  ctx.rotate(tailAngle);
  drawToonPath(() => {
    ctx.arc(15, -15, 22, 0.5, 2.5);
  }, null, stripeColor, 12);
  ctx.restore();

  // 3. Body
  drawToonPath(() => {
    ctx.roundRect(-40, -12, 80, 50, 24);
  }, bodyColor);

  // Belly Patch
  drawToonPath(() => {
    ctx.ellipse(0, 16, 24, 18, 0, 0, Math.PI * 2);
  }, '#fffdf5', null, 0);

  // 4. Head
  drawToonPath(() => {
    ctx.arc(0, -32, 40, 0, Math.PI * 2);
  }, bodyColor);

  // Ears
  const earBounce = Math.sin(cat.bounceTimer * 10) * 3;
  // Left Ear
  drawToonPath(() => {
    ctx.moveTo(-34, -54 + earBounce);
    ctx.lineTo(-24, -86 + earBounce);
    ctx.lineTo(-6, -64 + earBounce);
    ctx.closePath();
  }, bodyColor);
  drawToonPath(() => {
    ctx.moveTo(-28, -62 + earBounce);
    ctx.lineTo(-22, -76 + earBounce);
    ctx.lineTo(-12, -66 + earBounce);
    ctx.closePath();
  }, innerEarColor, null, 0);

  // Right Ear
  drawToonPath(() => {
    ctx.moveTo(34, -54 - earBounce);
    ctx.lineTo(24, -86 - earBounce);
    ctx.lineTo(6, -64 - earBounce);
    ctx.closePath();
  }, bodyColor);
  drawToonPath(() => {
    ctx.moveTo(28, -62 - earBounce);
    ctx.lineTo(22, -76 - earBounce);
    ctx.lineTo(12, -66 - earBounce);
    ctx.closePath();
  }, innerEarColor, null, 0);

  // 5. Expressive Toon Face
  if (cat.faceState === 'shocked') {
    // Shocked Eyes (X X or big circles)
    ctx.fillStyle = '#1e293b';
    ctx.font = '900 20px sans-serif';
    ctx.fillText('❌', -24, -30);
    ctx.fillText('❌', 4, -30);
    // Shocked O Mouth
    drawToonPath(() => {
      ctx.arc(0, -16, 8, 0, Math.PI * 2);
    }, '#ff4785');
  } else if (cat.faceState === 'happy') {
    // Happy Star Eyes
    ctx.fillStyle = '#ffd000';
    ctx.font = '900 18px sans-serif';
    ctx.fillText('✨', -24, -30);
    ctx.fillText('✨', 4, -30);
    // Wide Happy Open Mouth with Tongue
    drawToonPath(() => {
      ctx.arc(0, -18, 10, 0, Math.PI);
    }, '#1e293b');
    drawToonPath(() => {
      ctx.arc(0, -14, 5, 0, Math.PI);
    }, '#ff4785', null, 0);
  } else {
    // Normal Cute Cartoon Eyes with pupils and highlights
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-14, -34, 6, 0, Math.PI * 2);
    ctx.arc(14, -34, 6, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-16, -36, 2.5, 0, Math.PI * 2);
    ctx.arc(12, -36, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Rosy Cheeks
    ctx.fillStyle = 'rgba(255, 71, 133, 0.4)';
    ctx.beginPath();
    ctx.arc(-24, -26, 6, 0, Math.PI * 2);
    ctx.arc(24, -26, 6, 0, Math.PI * 2);
    ctx.fill();

    // Cute Nose & Smile
    ctx.fillStyle = '#ff4785';
    ctx.beginPath(); ctx.arc(0, -25, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-5, -22, 6, 0.1, Math.PI - 0.2);
    ctx.arc(5, -22, 6, 0.1, Math.PI - 0.2);
    ctx.stroke();
  }

  // Ninja Mask overlay if skin is ninja
  if (currentSkin === 'ninja') {
    ctx.fillStyle = '#ff4785';
    ctx.fillRect(-38, -44, 76, 12);
  }

  // 6. Paws
  drawToonPath(() => {
    ctx.ellipse(-26, 26, 14, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(26, 26, 14, 10, 0, 0, Math.PI * 2);
  }, '#fffdf5');

  ctx.restore();
}

// ==========================================
// MAIN GAME LOOP & UPDATES
// ==========================================
function update(dt, t) {
  if (!running || paused) return;

  levelTimer += dt;
  spawnTimer -= dt;
  cat.bounceTimer += dt;

  // Face state timer reset
  if (cat.faceTimer > 0) {
    cat.faceTimer -= dt;
    if (cat.faceTimer <= 0) cat.faceState = 'normal';
  }

  // Smooth squash & stretch recovery
  cat.stretchX += (1 - cat.stretchX) * Math.min(1, dt * 10);
  cat.stretchY += (1 - cat.stretchY) * Math.min(1, dt * 10);
  cat.tilt += (0 - cat.tilt) * Math.min(1, dt * 8);

  // Level Progression Check
  const newLevel = Math.floor(score / 300) + 1;
  if (newLevel > level) {
    level = newLevel;
    levelEl.textContent = level;
    sfx('level');
    showComicMessage('🎉 LEVEL UP! LVL ' + level);
    spawnComicText(W / 2, H / 2, 'LEVEL UP!', '#38b6ff');
    shake = 8;
  }

  // Spawn Timing
  if (spawnTimer <= 0) {
    spawnObject();
    const minDelay = Math.max(0.28, 0.72 - level * 0.025);
    spawnTimer = minDelay * (0.8 + Math.random() * 0.4);
  }

  // Move Cat towards target
  cat.x += (cat.targetX - cat.x) * Math.min(1, dt * 12);

  // Update Falling Objects
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    o.y += o.vy * dt;
    o.rot += o.spin * dt;

    // Collision Detection with Cat
    const dx = o.x - cat.x;
    const dy = o.y - (cat.y - 25);
    const hitDistance = Math.hypot(dx, dy);

    if (hitDistance < o.size * 0.75 + 38) {
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

    // Missed item dropped off screen
    if (o.y > H + 60) {
      objects.splice(i, 1);
      if (goodItems.includes(o.type)) {
        combo = 0;
        comboEl.textContent = '0x';
      }
    }
  }

  updateParticles(dt);
  shake = Math.max(0, shake - dt * 25);
}

function draw(t) {
  ctx.save();
  // Screen Shake
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
