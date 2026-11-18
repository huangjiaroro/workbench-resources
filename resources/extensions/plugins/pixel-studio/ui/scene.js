(() => {
  'use strict';
  const WIDTH = 960, ROW_HEIGHT = 202;
  const palette = ['#46d6a0', '#75c9f0', '#c4a1ff', '#f4bb72', '#f29cac', '#b7d778'];
  const rect = (ctx, x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  function text(ctx, value, x, y, color, size = 12, align = 'center') {
    ctx.font = `${size}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(value, Math.round(x), Math.round(y));
  }
  function hash(value) { let result = 0; for (const char of value) result = (Math.imul(result, 31) + char.codePointAt(0)) >>> 0; return result; }
  function station(slot) {
    const x = 220 + (slot % 2) * 346, y = 100 + Math.floor(slot / 2) * ROW_HEIGHT;
    return {x, y, home: {x, y: y + 122}, seat: {x, y: y + 78}, exit: {x, y: y + 178}};
  }
  function plant(ctx, x, y) {
    rect(ctx, x - 9, y + 16, 18, 18, '#a47b58'); rect(ctx, x - 11, y + 14, 22, 5, '#d6a573');
    rect(ctx, x - 2, y - 6, 4, 24, '#47895a'); rect(ctx, x - 15, y, 15, 8, '#2b7455');
    rect(ctx, x + 1, y - 9, 13, 8, '#46a074'); rect(ctx, x - 9, y - 15, 10, 13, '#39865f'); rect(ctx, x + 3, y + 3, 14, 7, '#3a8960');
  }
  function monitor(ctx, x, y) {
    rect(ctx, x + 3, y + 3, 34, 24, '#080c14'); rect(ctx, x, y, 34, 24, '#334357');
    rect(ctx, x + 3, y + 3, 28, 17, '#1e2837'); rect(ctx, x + 15, y + 24, 4, 5, '#546176'); rect(ctx, x + 9, y + 29, 16, 3, '#546176');
  }
  function desk(ctx, x, y) {
    rect(ctx, x - 65, y + 10, 134, 48, '#090d17'); rect(ctx, x - 62, y + 6, 124, 39, '#455067');
    rect(ctx, x - 62, y, 124, 37, '#626177'); rect(ctx, x - 60, y + 2, 120, 3, '#8b8390');
    rect(ctx, x - 56, y + 32, 111, 2, '#393d51'); rect(ctx, x - 58, y + 37, 8, 22, '#333b4b'); rect(ctx, x + 48, y + 37, 8, 22, '#333b4b');
    monitor(ctx, x - 45, y - 28); monitor(ctx, x - 5, y - 28);
    rect(ctx, x - 34, y + 14, 41, 8, '#a0a8b7'); rect(ctx, x - 30, y + 17, 32, 2, '#657084');
    rect(ctx, x + 15, y + 17, 5, 8, '#adb6c6'); rect(ctx, x + 43, y + 5, 9, 13, '#d6c6a9'); rect(ctx, x + 44, y + 5, 7, 4, '#6e4730');
    rect(ctx, x - 14, y + 48, 30, 23, '#202837'); rect(ctx, x - 17, y + 63, 36, 9, '#293447');
    rect(ctx, x - 2, y + 70, 5, 14, '#566176'); rect(ctx, x - 18, y + 83, 36, 3, '#2b3444');
  }
  function bookshelf(ctx, x, y) {
    rect(ctx, x, y, 101, 60, '#4c3c35'); rect(ctx, x + 3, y + 3, 95, 54, '#241f21');
    for (let r = 0; r < 2; r++) {
      rect(ctx, x + 3, y + 27 + r * 28, 95, 4, '#78604d');
      for (let i = 0; i < 10; i++) rect(ctx, x + 7 + i * 8, y + 8 + r * 28 + (i % 3) * 2, 6, 18 - (i % 3) * 2, ['#557b77', '#76668d', '#a58056', '#65768f'][i % 4]);
    }
  }
  function coffee(ctx, x, y) {
    rect(ctx, x, y + 24, 103, 30, '#695044'); rect(ctx, x, y + 21, 103, 6, '#a07a59');
    rect(ctx, x + 5, y + 53, 7, 27, '#352922'); rect(ctx, x + 91, y + 53, 7, 27, '#352922');
    rect(ctx, x + 18, y - 20, 39, 41, '#89919b'); rect(ctx, x + 22, y - 24, 31, 5, '#565e6e');
    rect(ctx, x + 23, y - 13, 7, 5, '#5edd8b'); rect(ctx, x + 44, y - 13, 6, 5, '#d87266');
    rect(ctx, x + 33, y - 2, 13, 14, '#262c33'); rect(ctx, x + 33, y + 14, 15, 9, '#e1d8bb');
    rect(ctx, x + 49, y + 15, 4, 6, '#e1d8bb'); rect(ctx, x + 71, y + 6, 13, 15, '#e6dcc4'); rect(ctx, x + 74, y + 5, 7, 3, '#785237');
    text(ctx, 'COFFEE', x + 51, y + 69, '#bb9271', 10);
  }
  function createScene(canvas) {
    const ctx = canvas.getContext('2d'), background = document.createElement('canvas');
    const bg = background.getContext('2d'); let count = -1;
    function resize(slots) {
      if (slots === count) return false;
      count = slots; const rows = Math.max(2, Math.ceil(slots / 2));
      if (background.width === WIDTH && background.height === rows * ROW_HEIGHT + 112) return false;
      canvas.width = background.width = WIDTH; canvas.height = background.height = rows * ROW_HEIGHT + 112;
      ctx.imageSmoothingEnabled = bg.imageSmoothingEnabled = false;
      const h = canvas.height;
      rect(bg, 0, 0, WIDTH, h, '#10141d');
      for (let y = 64; y < h - 32; y += 32) for (let x = 32; x < 928; x += 32) {
        rect(bg, x, y, 32, 32, (x / 32 + y / 32) % 2 ? '#171d2a' : '#1b2130');
        if (x >= 416 && x < 448) rect(bg, x, y, 32, 32, '#242e43');
        if (x >= 768) { rect(bg, x, y, 32, 32, y / 32 % 2 ? '#3a291f' : '#34251d'); rect(bg, x, y + 30, 32, 2, '#211a18'); }
      }
      rect(bg, 0, 0, WIDTH, 64, '#141a25'); rect(bg, 0, 61, WIDTH, 2, '#354154'); rect(bg, 0, h - 32, WIDTH, 2, '#303b50');
      rect(bg, 425, 10, 109, 39, '#67470f'); rect(bg, 429, 14, 101, 31, '#c99422');
      rect(bg, 442, 22, 30, 15, '#ffe58b'); rect(bg, 447, 27, 6, 4, '#d39929'); rect(bg, 461, 27, 6, 4, '#d39929'); text(bg, 'ZP', 502, 35, '#fff0ad', 16);
      rect(bg, 95, 12, 145, 36, '#344758'); rect(bg, 99, 16, 137, 28, '#264457');
      rect(bg, 167, 16, 4, 28, '#466175'); rect(bg, 99, 29, 137, 3, '#466175'); rect(bg, 109, 21, 36, 3, '#3f657a');
      bookshelf(bg, 791, 84); plant(bg, 895, 144); coffee(bg, 796, h - 181); plant(bg, 905, h - 64);
      for (let slot = 0; slot < rows * 2; slot++) {
        const {x, y} = station(slot);
        rect(bg, x - 130, y - 6, 260, 172, '#172634'); bg.strokeStyle = '#2c434c'; bg.lineWidth = 1;
        for (let tx = x - 130; tx <= x + 130; tx += 52) { bg.beginPath(); bg.moveTo(tx, y - 6); bg.lineTo(tx, y + 166); bg.stroke(); }
        for (let ty = y - 6; ty <= y + 166; ty += 43) { bg.beginPath(); bg.moveTo(x - 130, ty); bg.lineTo(x + 130, ty); bg.stroke(); }
        desk(bg, x, y + 16); if (slot % 2 === 0) plant(bg, x - 99, y + 18);
      }
      text(bg, 'WORKSPACE', 53, h - 11, '#566b86', 10, 'left'); text(bg, 'PIXEL STUDIO', 902, h - 11, '#566b86', 10, 'right');
      return true;
    }
    function draw(time, moving, members) {
      ctx.drawImage(background, 0, 0);
      // Screen activity reflects running only. The scan is a scene effect, not token progress.
      for (const member of members) {
        if (member.employee.status !== 'running') continue;
        const {x, y} = station(member.slot), frame = Math.floor(time * 4 + member.seed % 7);
        for (const [offset, color] of [[-45, member.color], [-5, '#47bbdb']]) {
          rect(ctx, x + offset + 3, y - 9, 28, 17, '#082e2a');
          for (let row = 0; row < 3; row++) rect(ctx, x + offset + 6, y - 5 + row * 4, 10 + (moving ? (frame + row * 3) % 11 : row * 4), 2, color);
          if (!moving || frame % 2 === 0) rect(ctx, x + offset + 23, y + 3, 2, 2, '#d4f9e8');
        }
      }
      // Clock and coffee steam are purely decorative.
      ctx.fillStyle = '#d2c9b7'; ctx.beginPath(); ctx.arc(838, 31, 17, 0, Math.PI * 2); ctx.fill();
      const date = new Date(), minute = date.getMinutes(), hour = date.getHours();
      for (const [angle, length] of [[(hour % 12 + minute / 60) * Math.PI / 6, 8], [minute * Math.PI / 30, 12]]) {
        ctx.strokeStyle = '#4d5968'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(838, 31); ctx.lineTo(Math.round(838 + Math.sin(angle) * length), Math.round(31 - Math.cos(angle) * length)); ctx.stroke();
      }
      if (moving) {
        for (let i = 0; i < 4; i++) {
          const phase = (time * 11 + i * 9) % 34;
          ctx.globalAlpha = (1 - phase / 34) * .5;
          rect(ctx, 837 + Math.round(Math.sin(time * 2 + i) * 4), canvas.height - 199 - phase, 3, 4, '#c7c9c8');
        }
        ctx.globalAlpha = 1;
      }
    }
    return {ctx, resize, draw, height: () => canvas.height};
  }
  window.PixelStudio = Object.freeze({WIDTH, ROW_HEIGHT, palette, rect, text, hash, station, createScene});
})();
