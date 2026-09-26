// Sabitler ve yardımcılar
const VIEW_W = 960;
const VIEW_H = 540;
const ANCHOR_Y = 30; // ağın tutunduğu yükseklik (ekranın üstü)

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Deterministik sözde rastgele sayı (pencere ışıkları her karede aynı kalsın diye)
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Binalar, jetonlar, parçacıklar ve arka plan
class World {
  constructor() {
    this.farSkyline = this.makeSkyline(1600, 60, 140, 260);
    this.midSkyline = this.makeSkyline(1600, 90, 200, 340);
    this.stars = Array.from({ length: 70 }, () => ({
      x: rand(0, VIEW_W), y: rand(0, VIEW_H * 0.55), r: rand(0.5, 1.6),
    }));
    this.reset();
  }

  reset() {
    this.buildings = [];
    this.coins = [];
    this.particles = [];
    this.shots = []; // ağ topları
    this.enemies = new Enemies();
    this.nextX = -200;
    this.count = 0;
    this.addBuilding(900, 400); // başlangıç binası geniş ve güvenli
  }

  makeSkyline(width, minW, minH, maxH) {
    const rects = [];
    let x = 0;
    while (x < width) {
      const w = rand(minW, minW * 2.2);
      rects.push({ x, w, h: rand(minH, maxH) });
      x += w + rand(0, 10);
    }
    return { width: x, rects };
  }

  addBuilding(w, top) {
    const b = {
      x: this.nextX, w, top,
      seed: this.count++,
      tower: Math.random() < 0.3,
    };
    this.buildings.push(b);
    this.nextX += w;
    return b;
  }

  // Kameranın önünde yeni bina üretir, geride kalanları siler
  generate(camX, meters) {
    const diff = clamp(meters / 1500, 0, 1); // 0 → kolay, 1 → zor

    while (this.nextX < camX + VIEW_W + 400) {
      const prev = this.buildings[this.buildings.length - 1];
      const gap = rand(80, 140 + 160 * diff);
      const gapStart = this.nextX;
      this.nextX += gap;

      const b = this.addBuilding(rand(170, 420 - 140 * diff), rand(300, 460));

      // Boşluğun üstüne jeton yayı
      if (Math.random() < 0.7) {
        const baseY = Math.min(prev.top, b.top) - 90;
        const n = 4;
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          this.coins.push({
            x: gapStart + gap * t,
            y: baseY - Math.sin(Math.PI * t) * 50,
            spin: rand(0, Math.PI * 2),
          });
        }
      }

      // Düşman dron
      if (this.count > 3 && Math.random() < 0.3 + 0.45 * diff) {
        this.enemies.spawn(b.x + rand(0, b.w), rand(120, b.top - 110), diff);
      }
    }

    const minX = camX - 300;
    this.buildings = this.buildings.filter((b) => b.x + b.w > minX);
    this.coins = this.coins.filter((c) => c.x > minX);
    this.enemies.cleanup(minX);
  }

  burst(x, y, color, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(60, 260);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.3, 0.7), color,
      });
    }
  }

  update(dt) {
    for (const c of this.coins) c.spin += dt * 5;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    this.enemies.update(dt);
  }

  // ---------- Çizim ----------

  drawBackground(ctx, camX) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, "#0b1030");
    g.addColorStop(0.6, "#2c2356");
    g.addColorStop(1, "#6b3a5e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.fillStyle = "#fff";
    for (const s of this.stars) {
      ctx.globalAlpha = 0.4 + 0.6 * hash(s.x);
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // Ay
    ctx.fillStyle = "#f4f1d8";
    ctx.shadowColor = "#f4f1d8";
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(780, 100, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    this.drawSkyline(ctx, this.farSkyline, camX * 0.15, "#1d1a3e");
    this.drawSkyline(ctx, this.midSkyline, camX * 0.35, "#15122d");
  }

  drawSkyline(ctx, sky, offset, color) {
    ctx.fillStyle = color;
    const shift = -(offset % sky.width);
    for (let k = 0; k < 2; k++) {
      for (const r of sky.rects) {
        const x = r.x + shift + k * sky.width;
        if (x > VIEW_W || x + r.w < 0) continue;
        ctx.fillRect(x, VIEW_H - r.h, r.w, r.h);
      }
    }
  }

  drawBuildings(ctx) {
    for (const b of this.buildings) {
      const shade = 22 + Math.floor(hash(b.seed) * 18);
      ctx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 22})`;
      ctx.fillRect(b.x, b.top, b.w, VIEW_H - b.top);

      // Çatı kenarı
      ctx.fillStyle = "#4a4f7a";
      ctx.fillRect(b.x - 4, b.top - 6, b.w + 8, 8);

      // Pencereler
      for (let wy = b.top + 20; wy < VIEW_H; wy += 30) {
        for (let wx = b.x + 14; wx < b.x + b.w - 16; wx += 24) {
          const lit = hash(b.seed * 1000 + wx * 3 + wy) > 0.62;
          ctx.fillStyle = lit ? "#ffd86b" : "#1a1f40";
          ctx.fillRect(wx, wy, 10, 15);
        }
      }

      // Su kulesi
      if (b.tower && b.w > 200) {
        const tx = b.x + b.w * 0.7;
        ctx.fillStyle = "#3a2c2a";
        ctx.fillRect(tx - 2, b.top - 30, 4, 30);
        ctx.fillRect(tx + 26, b.top - 30, 4, 30);
        ctx.fillStyle = "#6b4a3a";
        ctx.fillRect(tx - 6, b.top - 62, 40, 34);
        ctx.beginPath();
        ctx.moveTo(tx - 8, b.top - 62);
        ctx.lineTo(tx + 14, b.top - 80);
        ctx.lineTo(tx + 36, b.top - 62);
        ctx.fill();
      }
    }
  }

  drawCoins(ctx) {
    for (const c of this.coins) {
      const sx = Math.abs(Math.cos(c.spin));
      ctx.fillStyle = "#ffd23f";
      ctx.strokeStyle = "#b8860b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 10 * sx + 1, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  drawShots(ctx) {
    for (const s of this.shots) {
      const sp = Math.hypot(s.vx, s.vy);
      const tx = s.x - (s.vx / sp) * 22, ty = s.y - (s.vy / sp) * 22;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }
}
