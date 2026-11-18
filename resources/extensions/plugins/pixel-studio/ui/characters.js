(() => {
  'use strict';
  const {rect, text} = window.PixelStudio;
  // Original procedural sprites. Feet remain the anchor for motion and hit testing.
  function drawCharacter(ctx, member, time, moving, hovered) {
    const walking = member.path.length > 0;
    const working = member.employee.status === 'running' && !walking;
    const drinking = member.activity === 'coffee' && !walking && member.employee.status === 'idle';
    const frame = Math.floor(time * (walking ? 8 : 4) + member.seed % 13);
    const step = moving && walking ? [0, 2, 0, -2][frame % 4] : 0;
    const bob = moving && !working ? Math.round(Math.sin(time * (walking ? 12 : 2) + member.seed) * (walking ? 1 : .6)) : 0;
    const x = Math.round(member.x), y = Math.round(member.y + bob);
    const back = working || member.direction === 'up', side = !working && ['left', 'right'].includes(member.direction);
    const skin = ['#f1caa5', '#cf9877', '#e2b88b', '#ab775a'][member.seed % 4];
    const hair = ['#493c32', '#675144', '#b7b9cd', '#303841'][Math.floor(member.seed / 4) % 4];
    ctx.fillStyle = '#05080a90'; ctx.beginPath(); ctx.ellipse(x, member.y + 2, walking ? 14 : 16, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (hovered) { ctx.strokeStyle = '#d5f5e7'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, member.y + 2, 19, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
    rect(ctx, x - 8, y - 12 - Math.max(0, step), 6, 10, '#27364c');
    rect(ctx, x + 2, y - 12 - Math.max(0, -step), 6, 10, '#27364c');
    rect(ctx, x - 10, y - 3 - Math.max(0, step), 8, 3, '#101826');
    rect(ctx, x + 2, y - 3 - Math.max(0, -step), 8, 3, '#101826');
    rect(ctx, x - 10, y - 29, 20, 18, member.color); rect(ctx, x - 7, y - 30, 14, 2, '#dcf0e8');
    rect(ctx, x - 8, y - 13, 16, 2, '#122c3b');
    if (!back) { rect(ctx, x - 2, y - 27, 4, 14, '#e1e7ed'); rect(ctx, x - 1, y - 26, 2, 7, '#384453'); }
    const arms = working && moving ? frame % 2 * 2 : step;
    rect(ctx, x - 14, y - 27 + arms, 4, 12, member.color); rect(ctx, x - 14, y - 16 + arms, 4, 5, skin);
    rect(ctx, x + 10, y - 27 - arms, 4, 12, member.color); rect(ctx, x + 10, y - 16 - arms, 4, 5, skin);
    if (working) {
      rect(ctx, x - 14, y - 24 - arms, 6, 4, skin); rect(ctx, x + 8, y - 24 + arms, 6, 4, skin);
      rect(ctx, x - 10, y - 20, 20, 3, '#3a6172');
    }
    rect(ctx, x - 3, y - 34, 6, 5, skin); rect(ctx, x - 8, y - 45, 16, 13, back ? hair : skin);
    rect(ctx, x - 10, y - 44, 20, 5, hair); rect(ctx, x - 8, y - 47, 16, 4, hair);
    if (back) { rect(ctx, x - 8, y - 39, 16, 5, hair); rect(ctx, x - 4, y - 35, 8, 3, skin); }
    else {
      rect(ctx, x - 10, y - 39, 3, 6, hair); rect(ctx, x + 7, y - 39, 3, 6, hair);
      const blink = moving && frame % 19 === 0, eyeHeight = blink ? 1 : 2;
      if (side) { const offset = member.direction === 'left' ? -5 : 5; rect(ctx, x + offset, y - 39, 2, eyeHeight, '#16232c'); }
      else { rect(ctx, x - 5, y - 39, 2, eyeHeight, '#16232c'); rect(ctx, x + 3, y - 39, 2, eyeHeight, '#16232c'); }
      rect(ctx, x - 2, y - 34, 4, 1, '#aa755b');
      if (member.seed % 3 === 1 && !side) { rect(ctx, x - 7, y - 40, 6, 4, '#334357'); rect(ctx, x + 1, y - 40, 6, 4, '#334357'); rect(ctx, x - 1, y - 39, 2, 1, '#334357'); }
    }
    if (drinking) { const lift = moving ? frame % 2 * 2 : 0; rect(ctx, x + 10, y - 25 - lift, 8, 8, '#efe2c7'); rect(ctx, x + 18, y - 24 - lift, 3, 5, '#bbae94'); }
    if (member.employee.status === 'queued') {
      text(ctx, moving ? ['·', '··', '···'][Math.floor(time) % 3] : '···', x + 23, y - 37, '#dbb86a', 14);
    } else if (member.employee.status === 'waiting_children') {
      rect(ctx, x + 20, y - 44, 7, 7, '#c4a1ff'); rect(ctx, x + 29, y - 34, 7, 7, '#75c9f0');
      rect(ctx, x + 23, y - 35, 2, 5, moving && frame % 2 ? '#c4a1ff' : '#65758b');
    } else if (member.employee.status === 'cancelling') { rect(ctx, x + 21, y - 40, 8, 8, '#e79976'); }
  }
  window.PixelStudioCharacter = drawCharacter;
})();
