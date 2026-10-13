// Dino Game Engine
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// DOM Elements
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const finalScoreElement = document.getElementById('final-score');
const gameOverModal = document.getElementById('game-over-modal');
const startModal = document.getElementById('start-modal');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');
const jumpTouchBtn = document.getElementById('jump-touch-btn');

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 260;
const GROUND_Y = 220;
const GRAVITY = 0.65;
const JUMP_FORCE = -12.5;

// Game state
let isPlaying = false;
let isGameOver = false;
let score = 0;
let highScore = parseInt(localStorage.getItem('dino_high_score') || '0', 10);
let gameSpeed = 5.5;
let animationFrameId = null;
let lastSpawnTime = 0;
let obstacles = [];
let clouds = [];
let groundOffset = 0;
let particleEffects = [];

// Initialize high score display
highScoreElement.textContent = String(highScore).padStart(5, '0');

// Sound synthesis using Web Audio API (No external assets required!)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol = 0.1) {
  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Audio context may fail if user hasn't interacted yet
  }
}

function playJumpSound() {
  playTone(450, 'square', 0.12, 0.08);
}

function playHitSound() {
  playTone(140, 'sawtooth', 0.28, 0.15);
}

function playScoreSound() {
  playTone(880, 'sine', 0.08, 0.08);
  setTimeout(() => playTone(1174, 'sine', 0.14, 0.08), 80);
}

// Player / Dino object
const dino = {
  x: 55,
  y: GROUND_Y - 44,
  width: 44,
  height: 46,
  vy: 0,
  isGrounded: true,
  legAnimTimer: 0,
  legFrame: 0,

  reset() {
    this.x = 55;
    this.y = GROUND_Y - 44;
    this.vy = 0;
    this.isGrounded = true;
    this.legAnimTimer = 0;
    this.legFrame = 0;
  },

  jump() {
    if (this.isGrounded) {
      this.vy = JUMP_FORCE;
      this.isGrounded = false;
      playJumpSound();
      createJumpDust(this.x + 15, GROUND_Y);
    }
  },

  update() {
    // Apply gravity
    this.vy += GRAVITY;
    this.y += this.vy;

    // Floor collision
    if (this.y >= GROUND_Y - this.height) {
      this.y = GROUND_Y - this.height;
      this.vy = 0;
      this.isGrounded = true;
    }

    // Running animation frames
    if (this.isGrounded) {
      this.legAnimTimer++;
      if (this.legAnimTimer % 6 === 0) {
        this.legFrame = this.legFrame === 0 ? 1 : 0;
      }
    }
  },

  draw() {
    ctx.save();
    ctx.fillStyle = '#334155'; // Dark slate body

    const x = this.x;
    const y = this.y;

    // Main torso
    ctx.fillRect(x + 12, y + 14, 22, 22);

    // Neck & Head
    ctx.fillRect(x + 22, y + 4, 12, 14);
    ctx.fillRect(x + 24, y, 18, 12);
    // Snout
    ctx.fillRect(x + 32, y + 4, 12, 8);

    // Eye (White with dark pupil)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 28, y + 2, 4, 4);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 29, y + 3, 2, 2);

    // Tail
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 4, y + 18, 8, 12);
    ctx.fillRect(x, y + 16, 6, 8);

    // Small arms
    ctx.fillRect(x + 30, y + 20, 6, 4);
    ctx.fillRect(x + 34, y + 22, 2, 4);

    // Legs
    if (this.isGrounded) {
      if (this.legFrame === 0) {
        ctx.fillRect(x + 16, y + 36, 4, 10);
        ctx.fillRect(x + 16, y + 44, 8, 2);
        ctx.fillRect(x + 26, y + 36, 4, 6);
      } else {
        ctx.fillRect(x + 16, y + 36, 4, 6);
        ctx.fillRect(x + 26, y + 36, 4, 10);
        ctx.fillRect(x + 26, y + 44, 8, 2);
      }
    } else {
      // Jump legs tucked
      ctx.fillRect(x + 16, y + 36, 4, 6);
      ctx.fillRect(x + 26, y + 36, 4, 6);
    }

    ctx.restore();
  }
};

// Particles (Dust when jumping or dying)
function createJumpDust(x, y) {
  for (let i = 0; i < 4; i++) {
    particleEffects.push({
      x: x + (Math.random() * 10 - 5),
      y: y - 2,
      vx: -(Math.random() * 2 + 1),
      vy: -(Math.random() * 1.5),
      size: Math.random() * 3 + 2,
      alpha: 0.8
    });
  }
}

function updateParticles() {
  for (let i = particleEffects.length - 1; i >= 0; i--) {
    const p = particleEffects[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.04;
    if (p.alpha <= 0) {
      particleEffects.splice(i, 1);
    }
  }
}

function drawParticles() {
  particleEffects.forEach(p => {
    ctx.save();
    ctx.fillStyle = `rgba(148, 163, 184, ${p.alpha})`;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.restore();
  });
}

// Background Clouds
function spawnCloud() {
  clouds.push({
    x: CANVAS_WIDTH + 20,
    y: Math.random() * 70 + 25,
    speed: Math.random() * 0.8 + 0.6,
    width: Math.random() * 30 + 40
  });
}

function updateAndDrawClouds() {
  if (Math.random() < 0.007 && clouds.length < 5) {
    spawnCloud();
  }

  ctx.fillStyle = '#e2e8f0';
  for (let i = clouds.length - 1; i >= 0; i--) {
    const c = clouds[i];
    c.x -= c.speed;
    
    // Draw simple cloud
    ctx.beginPath();
    ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
    ctx.arc(c.x + 12, c.y - 4, 12, 0, Math.PI * 2);
    ctx.arc(c.x + 24, c.y, 9, 0, Math.PI * 2);
    ctx.fill();

    if (c.x + c.width < -30) {
      clouds.splice(i, 1);
    }
  }
}

// Ground rendering
function drawGround() {
  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
  ctx.stroke();

  // Decorative ground bumps
  ctx.fillStyle = '#cbd5e1';
  groundOffset = (groundOffset + gameSpeed) % 40;
  for (let x = -groundOffset; x < CANVAS_WIDTH; x += 40) {
    ctx.fillRect(x + 5, GROUND_Y + 6, 8, 2);
    ctx.fillRect(x + 22, GROUND_Y + 12, 4, 2);
    ctx.fillRect(x + 30, GROUND_Y + 7, 5, 2);
  }
  ctx.restore();
}

// Obstacles (Cactus & Pterodactyl Bird)
function spawnObstacle() {
  const isBird = score > 200 && Math.random() < 0.28;

  if (isBird) {
    // Bird obstacle (flies at jumpable height)
    const flyHeights = [GROUND_Y - 45, GROUND_Y - 65];
    const chosenHeight = flyHeights[Math.floor(Math.random() * flyHeights.length)];
    obstacles.push({
      type: 'bird',
      x: CANVAS_WIDTH,
      y: chosenHeight,
      width: 38,
      height: 24,
      animFrame: 0,
      animTimer: 0
    });
  } else {
    // Cactus (single or double)
    const isDouble = Math.random() < 0.35;
    const width = isDouble ? 34 : 20;
    const height = Math.random() * 10 + 36;
    obstacles.push({
      type: 'cactus',
      x: CANVAS_WIDTH,
      y: GROUND_Y - height,
      width: width,
      height: height,
      isDouble: isDouble
    });
  }
}

function updateAndDrawObstacles() {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    ob.x -= gameSpeed;

    if (ob.type === 'cactus') {
      ctx.save();
      ctx.fillStyle = '#059669'; // Emerald green cactus
      
      // Main trunk
      ctx.fillRect(ob.x + 6, ob.y, 8, ob.height);
      // Cactus arms
      ctx.fillRect(ob.x, ob.y + 10, 6, 12);
      ctx.fillRect(ob.x, ob.y + 8, 4, 4);
      ctx.fillRect(ob.x + 14, ob.y + 14, 6, 10);
      ctx.fillRect(ob.x + 16, ob.y + 12, 4, 4);

      if (ob.isDouble) {
        ctx.fillRect(ob.x + 22, ob.y + 4, 7, ob.height - 4);
        ctx.fillRect(ob.x + 29, ob.y + 12, 4, 6);
      }
      ctx.restore();
    } else if (ob.type === 'bird') {
      // Pterodactyl bird
      ob.animTimer++;
      if (ob.animTimer % 10 === 0) {
        ob.animFrame = ob.animFrame === 0 ? 1 : 0;
      }

      ctx.save();
      ctx.fillStyle = '#475569';
      // Body & beak
      ctx.fillRect(ob.x + 10, ob.y + 8, 16, 8);
      ctx.fillRect(ob.x + 2, ob.y + 10, 8, 4);
      // Wings flap up or down
      if (ob.animFrame === 0) {
        ctx.fillRect(ob.x + 12, ob.y, 6, 8); // Wing up
      } else {
        ctx.fillRect(ob.x + 12, ob.y + 16, 6, 8); // Wing down
      }
      ctx.restore();
    }

    // Check collision with dino (with 4px forgiveness padding)
    const padding = 5;
    if (
      dino.x + padding < ob.x + ob.width - padding &&
      dino.x + dino.width - padding > ob.x + padding &&
      dino.y + padding < ob.y + ob.height - padding &&
      dino.y + dino.height - padding > ob.y + padding
    ) {
      triggerGameOver();
      return;
    }

    // Off-screen removal
    if (ob.x + ob.width < -10) {
      obstacles.splice(i, 1);
    }
  }
}

// Game Flow functions
function startGame() {
  if (isPlaying) return;

  isPlaying = true;
  isGameOver = false;
  score = 0;
  gameSpeed = 5.5;
  obstacles = [];
  clouds = [];
  lastSpawnTime = Date.now();

  dino.reset();
  startModal.classList.add('hidden');
  gameOverModal.classList.add('hidden');

  updateScoreUI();
  cancelAnimationFrame(animationFrameId);
  gameLoop();
}

function triggerGameOver() {
  isPlaying = false;
  isGameOver = true;
  playHitSound();

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('dino_high_score', highScore);
    highScoreElement.textContent = String(highScore).padStart(5, '0');
  }

  finalScoreElement.textContent = score;
  gameOverModal.classList.remove('hidden');
}

function updateScoreUI() {
  scoreElement.textContent = String(Math.floor(score)).padStart(5, '0');
}

// Main game loop
function gameLoop() {
  if (!isPlaying) return;

  // Clear canvas
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Background elements
  updateAndDrawClouds();
  drawGround();

  // Dino update & render
  dino.update();
  dino.draw();

  // Obstacle generation
  const now = Date.now();
  const spawnInterval = Math.max(1200 - gameSpeed * 50, 680);
  if (now - lastSpawnTime > spawnInterval && Math.random() < 0.6) {
    spawnObstacle();
    lastSpawnTime = now;
  }

  // Update Obstacles & Particles
  updateAndDrawObstacles();
  updateParticles();
  drawParticles();

  // Progression: Increase score and speed
  score += 0.2;
  if (Math.floor(score) > 0 && Math.floor(score) % 100 === 0 && Math.floor(score) !== Math.floor(score - 0.2)) {
    playScoreSound();
  }

  // Gradually ramp difficulty
  gameSpeed = Math.min(13, 5.5 + score * 0.006);

  updateScoreUI();

  if (!isGameOver) {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

// User Action Handlers
function handleAction() {
  if (!isPlaying && !isGameOver) {
    startGame();
  } else if (isGameOver) {
    startGame();
  } else {
    dino.jump();
  }
}

// Keyboard controls
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    handleAction();
  } else if (e.code === 'Enter' && isGameOver) {
    e.preventDefault();
    startGame();
  }
});

// Click & Touch events
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleAction();
});

startBtn.addEventListener('click', () => startGame());
restartBtn.addEventListener('click', () => startGame());
if (jumpTouchBtn) {
  jumpTouchBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handleAction();
  });
}

// Initial canvas render setup
function renderInitialScene() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawGround();
  dino.draw();
}

renderInitialScene();
