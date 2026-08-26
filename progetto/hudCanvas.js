export function createHUDCanvas(opts = {}) {
  const size = opts.size || 180;
  const padding = 12;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.position = 'fixed';
  canvas.style.right = padding + 'px';
  canvas.style.bottom = padding + 'px';
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
    housePosition: opts.housePosition || [0, 0, 0],
    playerHeading: 0,
    bgColor: opts.bgColor || 'rgba(16,18,20,0.64)',
    tick() {},
    draw(player, camera, treeColliders, playerVelocity = null) {
      const c = ctx;
      const w = canvas.width, h = canvas.height;
      c.clearRect(0, 0, w, h);

      const cx = w * 0.5, cy = h * 0.42, r = Math.min(w, h) * 0.34;
      const worldToMap = (position) => [
        cx + (position[0] / this.worldRadius) * r,
        cy + (position[2] / this.worldRadius) * r
      ];

      // background
      c.fillStyle = this.bgColor;
      c.roundRect(0, 0, w, h, 12);
      c.fill();

      // minimap circle
      c.beginPath();
      c.fillStyle = 'rgba(8,10,12,0.88)';
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();

      // draw trees
      if (treeColliders && treeColliders.length) {
        c.fillStyle = '#8abf6b';
        for (const t of treeColliders) {
          const [tx, tz] = worldToMap(t.center);
          c.beginPath();
          c.arc(tx, tz, 3, 0, Math.PI * 2);
          c.fill();
        }
      }

      // Casa al centro della scena
      const [houseX, houseZ] = worldToMap(this.housePosition);
      c.fillStyle = '#e05252';
      c.fillRect(houseX - 4, houseZ - 4, 8, 8);
      c.strokeStyle = '#8f2525';
      c.lineWidth = 1;
      c.strokeRect(houseX - 4, houseZ - 4, 8, 8);

      // player
      if (player) {
        const [px, pz] = worldToMap(player);
        if (playerVelocity && Math.hypot(playerVelocity[0], playerVelocity[2]) > 0.001) {
          // Canvas Y positivo coincide con la direzione +Z del mondo.
          this.playerHeading = Math.atan2(playerVelocity[0], -playerVelocity[2]);
        }
        c.save();
        c.translate(px, pz);
        c.rotate(this.playerHeading);
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
