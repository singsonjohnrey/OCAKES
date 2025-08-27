// Chasing Game - script.js
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const highscoreEl = document.getElementById('highscore');
  const overlay = document.getElementById('gameOver');
  const finalScoreEl = document.getElementById('finalScore');
  const restartBtn = document.getElementById('restartBtn');

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  // Game state
  let score = 0;
  let highscore = Number(localStorage.getItem('chase_highscore') || 0);
  highscoreEl.textContent = highscore;

  // Entities
  const player = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    r: 14,
    speed: 3.3,
    vx: 0,
    vy: 0,
    color: '#3b82f6'
  };

  const enemy = {
    x: 80,
    y: 80,
    r: 18,
    speed: 1.6,   // will increase slightly with score
    color: '#ef4444'
  };

  const star = {
    x: 150,
    y: 150,
    r: 8,
    color: '#facc15',
    taken: false
  };

  let keys = {};
  let running = true;
  let lastTime = 0;

  // Helpers
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  // Spawn a star at a random location not too close to player or enemy
  function spawnStar() {
    let x, y;
    let attempts = 0;
    do {
      x = Math.random() * (WIDTH - 60) + 30;
      y = Math.random() * (HEIGHT - 60) + 30;
      attempts++;
      if (attempts > 50) break;
    } while (Math.hypot(x - player.x, y - player.y) < 80 || Math.hypot(x - enemy.x, y - enemy.y) < 80);

    star.x = x; star.y = y; star.taken = false;
  }

  function reset() {
    score = 0;
    player.x = WIDTH / 2;
    player.y = HEIGHT / 2;
    player.vx = player.vy = 0;
    enemy.x = 80;
    enemy.y = 80;
    enemy.speed = 1.6;
    spawnStar();
    updateScore();
    hideGameOver();
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function gameOver() {
    running = false;
    finalScoreEl.textContent = score;
    overlay.classList.remove('hidden');
    if (score > highscore) {
      highscore = score;
      localStorage.setItem('chase_highscore', highscore);
      highscoreEl.textContent = highscore;
    }
  }

  function hideGameOver() {
    overlay.classList.add('hidden');
  }

  // Input
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    // prevent arrow keys from scrolling
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // Touch support (simple virtual joystick: tapping a quadrant moves player)
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const tx = t.clientX - rect.left;
    const ty = t.clientY - rect.top;
    // set direction toward touch point
    const angle = Math.atan2(ty - player.y, tx - player.x);
    player.vx = Math.cos(angle) * player.speed;
    player.vy = Math.sin(angle) * player.speed;
    e.preventDefault();
  }, {passive:false});
  canvas.addEventListener('touchend', () => { player.vx = player.vy = 0; });

  // Score update
  function updateScore() {
    scoreEl.textContent = score;
  }

  // Main loop
  function loop(ts) {
    if (!running) return;
    const dt = Math.min((ts - lastTime) / 16.6667, 4); // normalized delta, cap to avoid big jumps
    lastTime = ts;

    handleInput(dt);
    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  function handleInput(dt) {
    let ax = 0, ay = 0;
    if (keys['arrowleft'] || keys['a']) ax -= 1;
    if (keys['arrowright'] || keys['d']) ax += 1;
    if (keys['arrowup'] || keys['w']) ay -= 1;
    if (keys['arrowdown'] || keys['s']) ay += 1;

    // Normalize diagonal speed
    if (ax !== 0 || ay !== 0) {
      const inv = 1 / Math.hypot(ax, ay);
      player.vx = ax * player.speed * inv;
      player.vy = ay * player.speed * inv;
    } else {
      // decelerate smoothly
      player.vx *= 0.85;
      player.vy *= 0.85;
      if (Math.abs(player.vx) < 0.02) player.vx = 0;
      if (Math.abs(player.vy) < 0.02) player.vy = 0;
    }
  }

  function update(dt) {
    // Move player
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = clamp(player.x, player.r, WIDTH - player.r);
    player.y = clamp(player.y, player.r, HEIGHT - player.r);

    // Enemy pursuit: basic leading by using player's velocity
    const leadFactor = 8; // how strongly enemy anticipates player's movement
    const targetX = player.x + player.vx * leadFactor;
    const targetY = player.y + player.vy * leadFactor;

    const angle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
    enemy.x += Math.cos(angle) * enemy.speed * dt;
    enemy.y += Math.sin(angle) * enemy.speed * dt;

    // Increase enemy speed slowly with score but cap it
    enemy.speed = 1.6 + Math.min(score * 0.06, 2.6);

    // Collision: enemy vs player
    if (dist(player, enemy) < (player.r + enemy.r - 2)) {
      gameOver();
      return;
    }

    // Collect star
    if (!star.taken && dist(player, star) < (player.r + star.r)) {
      star.taken = true;
      score += 1;
      updateScore();
      // respawn star after a short delay
      setTimeout(spawnStar, 350);
      // slight speed bump to make it harder
      enemy.speed += 0.08;
    }
  }

  // Rendering
  function drawCircle(x, y, r, color, stroke) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawStar(x, y, r) {
    // simple 5-point star path
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * r, -Math.sin((18 + i * 72) * Math.PI / 180) * r);
      ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * r * 0.5, -Math.sin((54 + i * 72) * Math.PI / 180) * r * 0.5);
    }
    ctx.closePath();
    ctx.fillStyle = star.color;
    ctx.fill();
    ctx.restore();
  }

  function render() {
    // clear
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // subtle grid/background
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    for (let gx = 0; gx < WIDTH; gx += 40) {
      ctx.fillRect(gx, 0, 1, HEIGHT);
    }
    for (let gy = 0; gy < HEIGHT; gy += 40) {
      ctx.fillRect(0, gy, WIDTH, 1);
    }
    ctx.restore();

    // star
    if (!star.taken) {
      drawStar(star.x, star.y, star.r + 6);
      // glow
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r + 18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250,204,21,0.06)';
      ctx.fill();
    }

    // enemy (red) - draws with eye
    drawCircle(enemy.x, enemy.y, enemy.r, enemy.color);
    // enemy eye (points toward player)
    const ex = enemy.x + Math.cos(Math.atan2(player.y - enemy.y, player.x - enemy.x)) * (enemy.r * 0.45);
    const ey = enemy.y + Math.sin(Math.atan2(player.y - enemy.y, player.x - enemy.x)) * (enemy.r * 0.45);
    drawCircle(ex, ey, enemy.r * 0.28, '#111');

    // player (blue) - small ring
    drawCircle(player.x, player.y, player.r + 2, player.color);
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Hook up buttons
  restartBtn.addEventListener('click', reset);

  // Start first game
  spawnStar();
  updateScore();
  requestAnimationFrame((t) => { lastTime = t; requestAnimationFrame(loop); });

})();
