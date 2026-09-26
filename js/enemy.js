// Uçan dronlar: üstlerine basılırsa yok olur, başka yerden çarparsa oyun biter.
class Enemies {
  constructor() {
    this.list = [];
  }

  spawn(x, y, diff) {
    this.list.push({
      x, baseY: y, y,
      vx: -rand(40, 90 + 80 * diff),
      t: rand(0, Math.PI * 2),
      w: 42, h: 20,
    });
  }

  // Ağla vurulan dron: zararsız hale gelir ve düşer
  webbed(d) {
    d.webbed = true;
    d.vy = -120;
    d.vx *= 0.3;
  }

  update(dt) {
    for (const d of this.list) {
      if (d.webbed) {
        d.vy += 900 * dt;
        d.y += d.vy * dt;
        d.x += d.vx * dt;
        continue;
      }
      d.t += dt;
      d.x += d.vx * dt;
      d.y = d.baseY + Math.sin(d.t * 3) * 18;
    }
  }

  cleanup(minX) {
    this.list = this.list.filter((d) => d.x > minX && !d.dead && d.y < VIEW_H + 60);
  }

  draw(ctx) {
    for (const d of this.list) {
      const { x, y } = d;
      // Pervaneler
      const spin = Math.abs(Math.sin(d.t * 40)) * 14 + 4;
      ctx.strokeStyle = "#aab";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 14, y - 12); ctx.lineTo(x - 14, y - 8);
      ctx.moveTo(x + 14, y - 12); ctx.lineTo(x + 14, y - 8);
      ctx.moveTo(x - 14 - spin, y - 13); ctx.lineTo(x - 14 + spin, y - 13);
      ctx.moveTo(x + 14 - spin, y - 13); ctx.lineTo(x + 14 + spin, y - 13);
      ctx.stroke();

      // Gövde
      ctx.fillStyle = "#555a70";
      ctx.beginPath();
      ctx.ellipse(x, y, 21, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Kırmızı göz
      ctx.fillStyle = "#ff2b2b";
      ctx.shadowColor = "#ff2b2b";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x - 8, y + 1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Ağa sarılmış dron
      if (d.webbed) {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) {
          ctx.moveTo(x - 22, y + i * 5 - 6);
          ctx.lineTo(x + 22, y - i * 5 + 6);
        }
        ctx.ellipse(x, y, 22, 11, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}
