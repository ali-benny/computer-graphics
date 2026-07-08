// hudCanvas.js
// Simple 2D HUD canvas: minimap + player info

export function createHUDCanvas(opts = {}) {
  const size = opts.size || 180;
  const padding = 12;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.position = 'fixed';
  canvas.style.right = padding + 'px';
  canvas.style.top = padding + 'px';
  canvas.style.zIndex = 30;
  canvas.style.borderRadius = '12px';
  canvas.style.boxShadow = '0 8px 30px rgba(0,0,0,0.5)';
  canvas.style.background = 'transparent';
  canvas.style.pointerEvents = 'auto';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  const hud = {
    canvas,
    ctx,
    size,
    worldRadius: opts.worldRadius || 26,
    bgColor: opts.bgColor || 'rgba(16,18,20,0.64)',
    tick() {},
    draw(player, camera, treeColliders) {
      const c = ctx;
      const w = canvas.width, h = canvas.height;
      c.clearRect(0, 0, w, h);

      // background
      c.fillStyle = this.bgColor;
      c.roundRect(0, 0, w, h, 12);
      c.fill();

      // minimap circle
      const cx = w * 0.5, cy = h * 0.42, r = Math.min(w, h) * 0.34;
      c.beginPath();
      c.fillStyle = 'rgba(8,10,12,0.88)';
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();

      // draw trees
      if (treeColliders && treeColliders.length) {
        c.fillStyle = '#8abf6b';
        for (const t of treeColliders) {
          const tx = cx + (t.center[0] / this.worldRadius) * r;
          const tz = cy + (t.center[2] / this.worldRadius) * r * -1;
          c.beginPath();
          c.arc(tx, tz, 3, 0, Math.PI * 2);
          c.fill();
        }
      }

      // player
      if (player) {
        const px = cx + (player[0] / this.worldRadius) * r;
        const pz = cy + (player[2] / this.worldRadius) * r * -1;
        c.save();
        c.translate(px, pz);
        c.rotate(camera ? camera.yaw : 0);
        c.fillStyle = '#ffd36b';
        c.beginPath();
        c.moveTo(0, -6);
        c.lineTo(4, 6);
        c.lineTo(-4, 6);
        c.closePath();
        c.fill();
        c.restore();
      }

      // text info
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.font = '12px "Trebuchet MS", sans-serif';
      if (player) {
        c.fillText(`P: ${player[0].toFixed(1)}, ${player[2].toFixed(1)}`, 10, h - 34);
      }
      if (camera) {
        c.fillText(`C: ${camera.position[0].toFixed(1)}, ${camera.position[1].toFixed(1)}, ${camera.position[2].toFixed(1)}`, 10, h - 18);
      }
    }
  };

  // helper: rounded rect
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };

  return hud;
}

export default createHUDCanvas;
