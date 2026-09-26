const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const menuEl = document.getElementById("menu");
const gameoverEl = document.getElementById("gameover");

const BEST_KEY = "spiderman-best";
const IS_TOUCH = window.matchMedia("(pointer: coarse)").matches;

let state = "MENU"; // MENU | PLAYING | GAME_OVER
let world = new World();
let player = new Player(120, 400 - 42);
let camX = 0;
let bonus = 0;
let playTime = 0;
let shake = 0;
let best = loadBest();
let last = 0;

function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* yoksay */ }
}

function meters() { return Math.max(0, Math.floor((player.x - 120) / 20)); }
function score() { return meters() + bonus; }

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = VIEW_W * dpr;
  canvas.height = VIEW_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function showBest() {
  document.getElementById("menuBest").textContent = best > 0 ? `Rekor: ${best}` : "";
}

function startGame() {
  world.reset();
  player = new Player(120, 400 - 42);
  camX = 0;
  bonus = 0;
  playTime = 0;
  shake = 0;
  state = "PLAYING";
  if (document.activeElement) document.activeElement.blur(); // Space butonu tekrar tetiklemesin
  menuEl.classList.add("hidden");
  gameoverEl.classList.add("hidden");
  document.body.classList.add("playing");
  Sound.unlock();
  Sound.start();
  Music.tempo = 124;
  Music.start();
}

const musicBtn = document.getElementById("musicBtn");
function toggleMusic() {
  Sound.unlock();
  const on = Music.toggle();
  if (on && state === "PLAYING") Music.start();
  updateMusicBtn();
}
function updateMusicBtn() {
  musicBtn.classList.toggle("off", !Music.on);
  musicBtn.title = Music.on ? "Müziği kapat (N)" : "Müziği aç (N)";
}

const muteBtn = document.getElementById("muteBtn");
function toggleMute() {
  const muted = Sound.toggleMute();
  updateMuteBtn();
  if (!muted) { Sound.unlock(); Sound.coin(); }
}
function updateMuteBtn() {
  muteBtn.textContent = Sound.muted ? "🔇" : "🔊";
  muteBtn.title = Sound.muted ? "Sesi aç (M)" : "Sesi kapat (M)";
}

function gameOver(reason) {
  if (state !== "PLAYING") return;
  state = "GAME_OVER";
  shake = 0.4;
  document.body.classList.remove("playing");
  const s = score();
  const isRecord = s > best;
  if (isRecord) { best = s; saveBest(best); }
  Sound.gameOver(isRecord);
  document.getElementById("deathReason").textContent = reason;
  document.getElementById("finalScore").textContent = `Skor: ${s}  (${meters()} m)`;
  document.getElementById("finalBest").textContent = isRecord ? "Yeni rekor!" : `Rekor: ${best}`;
  setTimeout(() => gameoverEl.classList.remove("hidden"), 500);
}

function checkCollisions() {
  // Jetonlar
  world.coins = world.coins.filter((c) => {
    if (Math.hypot(c.x - player.cx, c.y - player.cy) < 26) {
      bonus += 10;
      world.burst(c.x, c.y, "#ffd23f", 8);
      Sound.coin();
      return false;
    }
    return true;
  });

  // Ağ topları → dronlar
  for (const s of world.shots) {
    for (const d of world.enemies.list) {
      if (d.webbed) continue;
      if (Math.abs(s.x - d.x) < d.w / 2 + 8 && Math.abs(s.y - d.y) < d.h / 2 + 12) {
        world.enemies.webbed(d);
        s.life = 0;
        bonus += 30;
        world.burst(d.x, d.y, "#ffffff", 14);
        Sound.webHit();
        break;
      }
    }
  }

  // Dronlar
  for (const d of world.enemies.list) {
    if (d.webbed) continue;
    const hit =
      player.x < d.x + d.w / 2 && player.x + player.w > d.x - d.w / 2 &&
      player.y < d.y + d.h / 2 && player.y + player.h > d.y - d.h / 2;
    if (!hit) continue;

    if (player.vy > 0 && player.prevBottom <= d.y - 4) {
      // Üstüne bastı
      d.dead = true;
      player.vy = -520;
      player.rope = null;
      bonus += 50;
      world.burst(d.x, d.y, "#ff8844", 18);
      shake = 0.15;
      Sound.stomp();
    } else {
      world.burst(player.cx, player.cy, "#e6232f", 20);
      gameOver("Bir drona çarptın!");
      return;
    }
  }
  world.enemies.cleanup(-Infinity);

  if (player.y > VIEW_H + 80) gameOver("Boşluğa düştün!");
}

function update(dt) {
  world.update(dt);
  if (state !== "PLAYING") return;

  playTime += dt;
  player.update(dt, world);
  checkCollisions();

  Music.tempo = 124 + Math.min(24, meters() / 60); // ilerledikçe hızlanır

  const targetCam = player.x - 260;
  camX += (targetCam - camX) * Math.min(1, 8 * dt);
  world.generate(camX, meters());
}

function drawHUD() {
  ctx.font = "bold 22px Segoe UI, Arial";
  ctx.textBaseline = "top";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  const text = (t, x, y, color, align = "left") => {
    ctx.textAlign = align;
    ctx.strokeText(t, x, y);
    ctx.fillStyle = color;
    ctx.fillText(t, x, y);
  };
  text(`Skor: ${score()}`, 16, 14, "#fff");
  ctx.font = "bold 16px Segoe UI, Arial";
  text(`${meters()} m`, 16, 42, "#c9cff5");
  text(`Rekor: ${best}`, VIEW_W - 16, 14, "#ffd23f", "right");

  if (playTime < 4) {
    ctx.globalAlpha = clamp(4 - playTime, 0, 1);
    ctx.font = "bold 20px Segoe UI, Arial";
    const hint = IS_TOUCH
      ? "Ekrana basılı tut: ağ at  •  bırak: fırla  •  ⬆ zıpla  •  🕸 ağ topu"
      : "SPACE / tıkla: ağ at  •  bırak: fırla  •  F: dronlara ağ topu";
    text(hint, VIEW_W / 2, 90, "#fff", "center");
    ctx.globalAlpha = 1;
  }
}

function render() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-6, 6) * shake * 3, rand(-6, 6) * shake * 3);

  world.drawBackground(ctx, camX);

  ctx.save();
  ctx.translate(-Math.round(camX), 0);
  world.drawBuildings(ctx);
  world.drawCoins(ctx);
  world.enemies.draw(ctx);
  world.drawShots(ctx);
  if (state !== "GAME_OVER" || player.y < VIEW_H) player.draw(ctx);
  world.drawParticles(ctx);
  ctx.restore();

  if (state !== "MENU") drawHUD();
  ctx.restore();
}

function loop(time) {
  const dt = Math.min((time - last) / 1000, 1 / 30);
  last = time;
  if (shake > 0) shake = Math.max(0, shake - dt);
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// Başlatma
resize();
window.addEventListener("resize", resize);
Sound.init();
Music.init();
updateMuteBtn();
updateMusicBtn();
musicBtn.addEventListener("mousedown", (e) => e.preventDefault());
musicBtn.addEventListener("click", toggleMusic);
muteBtn.addEventListener("mousedown", (e) => e.preventDefault()); // odak almasın, Space'i yutmasın
muteBtn.addEventListener("click", toggleMute);
Input.init(canvas);
Input.bindButton(document.getElementById("attackBtn"), "attack");
Input.bindButton(document.getElementById("jumpBtn"), "jump");
document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("retryBtn").addEventListener("click", startGame);
window.addEventListener("keydown", (e) => {
  if (e.code === "Enter" && state !== "PLAYING") startGame();
  if (e.code === "KeyM" && !e.repeat) toggleMute();
  if (e.code === "KeyN" && !e.repeat) toggleMusic();
});
world.generate(camX, 0);
showBest();
requestAnimationFrame((t) => { last = t; loop(t); });
