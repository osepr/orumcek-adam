// Klavye, fare ve dokunmatik girişleri tek bir yerde toplar.
const Input = {
  web: false,    // ağ tuşu basılı mı
  jump: false,
  attack: false, // ağ topu fırlat
  left: false,
  right: false,

  init(target) {
    window.addEventListener("keydown", (e) => this.setKey(e, true));
    window.addEventListener("keyup", (e) => this.setKey(e, false));

    target.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.web = true;
      if (e.button === 2) this.attack = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.web = false;
      if (e.button === 2) this.attack = false;
    });
    target.addEventListener("contextmenu", (e) => e.preventDefault());

    target.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.web = true;
    }, { passive: false });
    // Sadece oyun alanındaki parmaklara bak: butona basılı tutan parmak ağı tutmasın
    const endTouch = (e) => {
      if (e.targetTouches.length === 0) this.web = false;
    };
    target.addEventListener("touchend", endTouch);
    target.addEventListener("touchcancel", endTouch);

    window.addEventListener("blur", () => this.reset());
  },

  // Dokunmatik ekranlar için ekran butonları (action: "attack" | "jump")
  bindButton(btn, action) {
    const down = (e) => { e.preventDefault(); e.stopPropagation(); this[action] = true; };
    const up = (e) => { e.preventDefault(); e.stopPropagation(); this[action] = false; };
    btn.addEventListener("touchstart", down, { passive: false });
    btn.addEventListener("touchend", up);
    btn.addEventListener("touchcancel", up);
    btn.addEventListener("mousedown", down);
    btn.addEventListener("mouseup", up);
  },

  setKey(e, down) {
    switch (e.code) {
      case "Space": this.web = down; break;
      case "ArrowUp": case "KeyW": this.jump = down; break;
      case "KeyF": case "KeyX": this.attack = down; break;
      case "ArrowLeft": case "KeyA": this.left = down; break;
      case "ArrowRight": case "KeyD": this.right = down; break;
      default: return;
    }
    e.preventDefault();
  },

  reset() {
    this.web = this.jump = this.attack = this.left = this.right = false;
  },
};
