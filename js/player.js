const GRAVITY = 1600;
const RUN_SPEED = 280;
const JUMP_V = 640;
const SWING_PUSH = 260; // sallanırken ileri itiş
const MAX_VX = 950;
const SHOT_SPEED = 900;
const SHOT_COOLDOWN = 0.35;
const SHOT_RANGE = 520; // otomatik nişan menzili

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 28;
    this.h = 42;
    this.vx = RUN_SPEED;
    this.vy = 0;
    this.onGround = true;
    this.rope = null;       // { x, y, len }
    this.prevWeb = true;    // oyuna basılı tuşla başlanırsa hemen ağ atmasın
    this.prevJump = true;
    this.prevAttack = true;
    this.cooldown = 0;
    this.throwAnim = 0; // atış sırasında kol öne uzansın
    this.prevBottom = y + this.h;
    this.anim = 0;
    this.angle = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  shootWeb() {
    const ax = this.cx + 150 + Math.max(0, this.vx) * 0.25;
    const ay = ANCHOR_Y;
    if (this.cy - ay < 60) return; // tavana çok yakın
    const d = Math.hypot(ax - this.cx, ay - this.cy);
    this.rope = { x: ax, y: ay, len: d * 0.92 };
    Sound.web();
  }

  release() {
    if (!this.rope) return;
    this.rope = null;
    Sound.release();
    this.vy -= 120; // bırakınca küçük bir yukarı fırlama
    this.vx += 40;
  }

  // Önündeki en yakın drona (yoksa düz ileri) ağ topu fırlat
  shoot(world) {
    const sx = this.cx + 12, sy = this.cy - 6;
    let target = null, bestD = SHOT_RANGE;
    for (const d of world.enemies.list) {
      if (d.webbed || d.x < this.cx - 20) continue;
      const dist = Math.hypot(d.x - sx, d.y - sy);
      if (dist < bestD) { bestD = dist; target = d; }
    }
    let dx = 1, dy = 0;
    if (target) {
      // Dronun top ulaştığında olacağı yere nişan al.
      // Oyuncuya göre bakılır (topa oyuncunun hızı da eklendiği için);
      // varış süresi birkaç adımda iyileştirilir.
      let t = 0, tx = target.x, ty = target.y;
      for (let i = 0; i < 4; i++) {
        t = Math.hypot(tx - sx, ty - sy) / SHOT_SPEED;
        tx = target.x + (target.vx - this.vx) * t;
        ty = target.baseY + Math.sin((target.t + t) * 3) * 18 - this.vy * t;
      }
      dx = tx - sx; dy = ty - sy;
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
    }
    world.shots.push({
      x: sx, y: sy,
      vx: dx * SHOT_SPEED + this.vx,
      vy: dy * SHOT_SPEED + (target ? this.vy : 0),
      life: 0.8,
    });
    this.cooldown = SHOT_COOLDOWN;
    this.throwAnim = 0.15;
    Sound.shoot();
  }

  update(dt, world) {
    this.prevBottom = this.y + this.h;

    this.cooldown -= dt;
    this.throwAnim -= dt;
    if (Input.attack && !this.prevAttack && this.cooldown <= 0) this.shoot(world);
    this.prevAttack = Input.attack;

    // Ağ: basınca at, bırakınca kopar
    if (Input.web && !this.prevWeb) this.shootWeb();
    if (!Input.web && this.rope) this.release();
    this.prevWeb = Input.web;

    const jumpPressed = Input.jump && !this.prevJump;
    this.prevJump = Input.jump;
    const dir = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);

    if (this.onGround) {
      const target = RUN_SPEED + dir * 80;
      this.vx += (target - this.vx) * Math.min(1, 4 * dt);
      if (jumpPressed) {
        this.vy = -JUMP_V;
        this.onGround = false;
        Sound.jump();
      }
    } else if (this.rope) {
      this.vx += SWING_PUSH * dt;
    } else {
      this.vx += dir * 350 * dt;
    }

    this.vy += GRAVITY * dt;
    this.vx = clamp(this.vx, -400, MAX_VX);
    this.vy = clamp(this.vy, -1300, 1300);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.rope) this.applyRope(dt);

    if (this.y < -30) {
      this.y = -30;
      if (this.vy < 0) this.vy = 0;
    }

    this.collideBuildings(world.buildings);
    this.updateAnimation(dt);
  }

  // Sarkaç: ip gerildiğinde oyuncuyu çember üzerine geri çek,
  // dışa doğru hızı sıfırla (teğet hız korunur).
  applyRope(dt) {
    const r = this.rope;
    r.len = Math.max(80, r.len - 50 * dt); // ipi hafifçe topla

    const dx = this.cx - r.x;
    const dy = this.cy - r.y;
    const d = Math.hypot(dx, dy);
    if (d > r.len) {
      const nx = dx / d, ny = dy / d;
      this.x = r.x + nx * r.len - this.w / 2;
      this.y = r.y + ny * r.len - this.h / 2;
      const radial = this.vx * nx + this.vy * ny;
      if (radial > 0) {
        this.vx -= radial * nx;
        this.vy -= radial * ny;
      }
    }

    // Tutunma noktasının ötesine savrulduysa ipi otomatik bırak
    if (this.cx > r.x && this.cy - r.y < r.len * 0.6) this.release();
  }

  collideBuildings(buildings) {
    const wasOnGround = this.onGround;
    this.onGround = false;
    for (const b of buildings) {
      if (this.x + this.w <= b.x || this.x >= b.x + b.w || this.y + this.h <= b.top) continue;

      if (this.prevBottom <= b.top + 4 && this.vy >= 0) {
        // Çatıya iniş
        if (!wasOnGround && this.vy > 300) Sound.land();
        this.y = b.top - this.h;
        this.vy = 0;
        this.onGround = true;
        this.rope = null;
      } else if (this.cx < b.x + b.w / 2) {
        // Binanın sol duvarına çarptı
        this.x = b.x - this.w;
        this.vx = Math.min(this.vx, -30);
      } else {
        this.x = b.x + b.w;
        this.vx = Math.max(this.vx, 0);
      }
    }
  }

  updateAnimation(dt) {
    let target = 0;
    if (this.rope) {
      const ux = this.rope.x - this.cx;
      const uy = this.rope.y - this.cy;
      target = Math.atan2(ux, -uy); // kafa ipe doğru baksın
    } else if (!this.onGround) {
      target = clamp(this.vx / 1500, -0.4, 0.5);
    }
    this.angle += (target - this.angle) * Math.min(1, 12 * dt);
    if (this.onGround) this.anim += dt * this.vx / 22;
  }

  // Elin dünya koordinatı (ip buradan çıkar)
  handPos() {
    const lx = 3, ly = -24;
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    return { x: this.cx + lx * c - ly * s, y: this.cy + lx * s + ly * c };
  }

  draw(ctx) {
    if (this.rope) {
      const h = this.handPos();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(this.rope.x, this.rope.y);
      ctx.stroke();
      this.drawWebSplat(ctx, this.rope.x, this.rope.y);
    }

    const RED = "#e6232f", BLUE = "#1f45c4";
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.angle);

    // Bacaklar
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (this.onGround) {
      const s = Math.sin(this.anim) * 7;
      ctx.moveTo(-4, 6); ctx.lineTo(-4 + s, 19);
      ctx.moveTo(4, 6); ctx.lineTo(4 - s, 19);
    } else {
      ctx.moveTo(-4, 6); ctx.lineTo(-8, 14); ctx.lineTo(-4, 19);
      ctx.moveTo(4, 6); ctx.lineTo(9, 16);
    }
    ctx.stroke();

    // Kollar
    ctx.strokeStyle = RED;
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (this.throwAnim > 0 && !this.rope) {
      // Atış pozu: kol öne uzanır
      ctx.moveTo(5, -5); ctx.lineTo(19, -7);
      ctx.moveTo(-6, -5); ctx.lineTo(-9, 5);
    } else if (this.rope) {
      ctx.moveTo(4, -6); ctx.lineTo(3, -24);
      ctx.moveTo(-5, -5); ctx.lineTo(-11, 4);
    } else {
      const s = this.onGround ? Math.sin(this.anim) * 6 : 0;
      ctx.moveTo(-6, -5); ctx.lineTo(-9 - s, 5);
      ctx.moveTo(6, -5); ctx.lineTo(9 + s, 5);
    }
    ctx.stroke();

    // Gövde
    ctx.fillStyle = RED;
    ctx.fillRect(-8, -9, 16, 17);
    ctx.fillStyle = BLUE;
    ctx.fillRect(-8, 1, 3, 7);
    ctx.fillRect(5, 1, 3, 7);
    // Göğüsteki örümcek
    ctx.fillStyle = "#111";
    ctx.fillRect(-1, -6, 2, 7);
    ctx.fillRect(-4, -4, 8, 1);
    ctx.fillRect(-4, -1, 8, 1);

    // Kafa
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(0, -15, 8, 0, Math.PI * 2);
    ctx.fill();
    // Gözler
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 3.6, -15.5, 2.8, 2, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawWebSplat(ctx, x, y) {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
    }
    ctx.stroke();
  }
}
