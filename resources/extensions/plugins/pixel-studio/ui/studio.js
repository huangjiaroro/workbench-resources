(() => {
  'use strict';
  const {WIDTH, palette, rect, text, hash, station, createScene} = window.PixelStudio;
  const canvas = document.getElementById('room'), scene = createScene(canvas), ctx = scene.ctx;
  const labels = {running: '执行中', queued: '排队中', waiting_children: '等待协作', cancelling: '停止中', idle: '空闲', unknown: '状态未授权'};
  const phases = {initializing: '正在连接引擎与工具', preparing: '正在准备本轮任务', generating: '模型处理中'};
  const toolLabels = {
    list_project_files: ['查看作品文件', '已查看作品文件'],
    read_project_file: ['读取作品文件', '已读取作品文件'],
    list_organization_members: ['查看组织成员', '已查看组织成员'],
    list_workbench_views: ['查看工作页面', '已查看工作页面'],
    get_workbench_activity: ['读取团队活动', '已读取团队活动'],
    open_workbench_view: ['请求打开工作页面', '已请求打开工作页面'],
    get_workbench_view_request: ['读取页面显示状态', '已读取页面显示状态'],
    delegate_employee: ['委派员工', '已委派员工'],
    yield_to_tasks: ['等待团队协作', '已请求等待团队协作'],
    get_employee_task_result: ['读取员工结果', '已读取员工结果'],
  };
  const members = new Map(), controls = new Map(), memberLayer = document.getElementById('members'), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const animationButton = document.getElementById('animation-toggle');
  let signature = '', zoom = 1, elapsed = 0, lastFrame = 0, lastPaint = -1, frameId = 0;
  let animationOverride = null, hoveredId = null, focusedId = null, pointer = null, initialized = false;
  const animated = () => animationOverride ?? !reducedMotion.matches;
  const active = () => initialized && animated() && !document.hidden;
  const maxSlot = () => Math.max(0, ...[...members.values()].map(member => member.slot + 1));
  function idleDelay(member) { return 9 + member.seed % 12 + member.visits % 3 * 5; }
  function homeFor(member) { const desk = station(member.slot); return member.employee.status === 'running' ? desk.seat : desk.home; }
  function setPath(member, waypoints) {
    member.path = waypoints.filter((point, index) => index > 0 || Math.hypot(point.x - member.x, point.y - member.y) > 1).map(point => ({...point}));
  }
  function returnHome(member) {
    const desk = station(member.slot);
    member.activity = 'home';
    if (member.x > 755 || Math.abs(member.x - desk.x) > 40 || member.y > desk.exit.y + 2 || member.y < desk.y - 6) {
      const nearestRow = Math.max(0, Math.min(Math.max(2, Math.ceil(maxSlot() / 2)) - 1, Math.round((member.y - 278) / 202)));
      const corridorY = 278 + nearestRow * 202;
      const route = member.x > 755 ? [{x: member.x, y: corridorY}, {x: 748, y: corridorY}, {x: 432, y: corridorY}] : [{x: 432, y: member.y}];
      setPath(member, [...route, {x: 432, y: desk.exit.y}, desk.exit, homeFor(member)]);
    } else setPath(member, [homeFor(member)]);
  }
  function goForCoffee(member) {
    const desk = station(member.slot), coffeeY = scene.height() - 92, bottomY = scene.height() - 42;
    member.activity = 'coffee'; member.visits++;
    setPath(member, [desk.exit, {x: 432, y: desk.exit.y}, {x: 432, y: bottomY}, {x: 748, y: bottomY}, {x: 842 + member.seed % 3 * 22, y: bottomY}, {x: 842 + member.seed % 3 * 22, y: coffeeY}]);
  }
  function update(member, dt) {
    let distance = dt * 78;
    while (distance > 0 && member.path.length) {
      const target = member.path[0], dx = target.x - member.x, dy = target.y - member.y, length = Math.hypot(dx, dy);
      if (length < .1) { member.path.shift(); continue; }
      member.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const travel = Math.min(distance, length); member.x += dx / length * travel; member.y += dy / length * travel; distance -= travel;
      if (travel === length) member.path.shift();
    }
    if (member.path.length) return;
    member.direction = member.employee.status === 'running' ? 'up' : 'down';
    if (member.employee.status !== 'idle') return;
    member.rest += dt;
    if (member.activity === 'coffee' && member.rest > 4 + member.seed % 4) { member.rest = 0; returnHome(member); }
    else if (member.activity === 'home' && member.rest > idleDelay(member) && ![...members.values()].some(other => other !== member && other.activity === 'coffee')) { member.rest = 0; goForCoffee(member); }
  }
  function clip(value, width, size) {
    ctx.font = `${size}px ui-monospace, SFMono-Regular, monospace`;
    if (ctx.measureText(value).width <= width) return value;
    const chars = Array.from(value).slice(0, 100); while (chars.length && ctx.measureText(chars.join('') + '…').width > width) chars.pop(); return chars.join('') + '…';
  }
  function caption(member) {
    const {employee} = member, step = employee.executionStep;
    if (employee.status === 'running') {
      if (step?.kind === 'phase' && Object.hasOwn(phases, step.phase)) return phases[step.phase];
      if (step?.kind === 'tool') {
        const name = toolLabels[step.name] ?? ['工具调用', '工具调用已完成'];
        return step.status === 'failed' ? `${name[0]}失败` : name[1];
      }
      return '执行中，等待步骤更新';
    }
    return ({queued: '等待轮到我执行', waiting_children: '等队友完成后继续', cancelling: '正在停止本轮执行'})[employee.status]
      ?? labels[employee.status] ?? '状态未授权';
  }
  function stepTime(member) {
    if (member.employee.status !== 'running') return '';
    const key = member.employee.executionStep?.createdAt ?? '';
    if (member.clockKey !== key) {
      const date = new Date(key); member.clockKey = key;
      member.clockText = Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}) : '';
    }
    return member.clockText ?? '';
  }
  function description(member) {
    return [member.employee.name, member.employee.task, caption(member), stepTime(member)].filter(Boolean).join(' · ');
  }
  function wrapCaption(value, width) {
    ctx.font = '12px ui-monospace, SFMono-Regular, monospace';
    const lines = []; let line = '';
    for (const char of Array.from(value)) {
      if (line && ctx.measureText(line + char).width > width) {lines.push(line); line = '';}
      line += char;
    }
    if (line) lines.push(line);
    return lines.length > 2 ? [lines[0], clip(lines.slice(1).join(''), width, 12)] : lines;
  }
  function drawLabel(member, hovered) {
    const {employee, color} = member, x = Math.round(member.x), y = Math.round(member.y);
    const working = ['running', 'queued', 'waiting_children', 'cancelling'].includes(employee.status);
    const failed = employee.status === 'running' && employee.executionStep?.kind === 'tool' && employee.executionStep.status === 'failed';
    const border = failed ? '#ed8d94' : ['queued', 'waiting_children', 'cancelling'].includes(employee.status) ? '#c6a665' : color;
    // Only real public execution records become dialogue. Full task titles are available on hover and in accessible names.
    const lines = wrapCaption(caption(member), 200), time = stepTime(member);
    const w = working ? 224 : Math.max(48, ctx.measureText(lines[0]).width + 24);
    const h = working ? 31 + lines.length * 17 : 24;
    const bx = Math.round(Math.max(6, Math.min(WIDTH - w - 6, x - w / 2))), by = Math.max(6, y - 58 - h);
    member.bubble = {x: bx, y: by, width: w, height: h};
    rect(ctx, bx + 3, by + 3, w, h, '#080d16'); rect(ctx, bx, by, w, h, hovered ? '#1b2c3b' : '#12202df5');
    ctx.strokeStyle = hovered ? '#edf5fc' : border; ctx.lineWidth = 1;
    ctx.strokeRect(bx + .5, by + .5, w, h);
    const tipX = Math.max(bx + 12, Math.min(bx + w - 12, x));
    ctx.fillStyle = border; ctx.beginPath(); ctx.moveTo(tipX - 5, by + h); ctx.lineTo(tipX, by + h + 6); ctx.lineTo(tipX + 5, by + h); ctx.fill();
    if (working) {
      rect(ctx, bx + 12, by + 11, 4, 4, border);
      text(ctx, failed ? '步骤失败' : labels[employee.status], bx + 23, by + 15, border, 10, 'left');
      if (time) text(ctx, time, bx + w - 12, by + 15, '#8ea0b4', 9, 'right');
      rect(ctx, bx + 12, by + 22, w - 24, 1, '#2a3b4c');
      lines.forEach((line, index) => text(ctx, line, bx + 12, by + 39 + index * 17, '#e5edf5', 12, 'left'));
    } else text(ctx, lines[0], bx + w / 2, by + 16, '#a9b9cd', 12);
    // Keep labels out of the floor footer while characters cross the bottom corridor.
    if (y > scene.height() - 88) return;
    const name = clip(employee.name, 174, 12), nameX = Math.max(90, Math.min(WIDTH - 90, x));
    text(ctx, name, nameX, y + 17, '#dce5ee', 12);
    text(ctx, clip(employee.core || employee.role, 174, 10), nameX, y + 32, '#8798b0', 10);
  }
  function hit(event) {
    const box = canvas.getBoundingClientRect(); if (!box.width || !box.height) return null;
    const x = (event.clientX - box.left) * WIDTH / box.width, y = (event.clientY - box.top) * canvas.height / box.height;
    return [...members.values()].sort((a, b) => b.y - a.y).find(member => {
      const bubble = member.bubble;
      return (Math.abs(member.x - x) < 30 && y > member.y - 51 && y < member.y + 9) ||
        (bubble && x >= bubble.x && x <= bubble.x + bubble.width && y >= bubble.y && y <= bubble.y + bubble.height);
    }) ?? null;
  }
  function updateHover() {
    const member = pointer ? hit(pointer) : null;
    hoveredId = member?.employee.id ?? null; canvas.style.cursor = member ? 'pointer' : 'default';
    canvas.title = member ? description(member) : '点击角色或对话气泡查看员工档案';
  }
  function paint() {
    const list = [...members.values()]; scene.draw(elapsed, animated(), list);
    const occupied = new Set(list.map(member => member.slot));
    const slots = Math.max(4, Math.ceil(maxSlot() / 2) * 2);
    for (let slot = 0; slot < slots; slot++) if (!occupied.has(slot)) { const desk = station(slot); text(ctx, '空工位', desk.x, desk.y + 137, '#596a80', 11); }
    updateHover();
    const highlightedId = focusedId ?? hoveredId;
    const ordered = list.sort((a, b) => a.y - b.y);
    for (const member of ordered) window.PixelStudioCharacter(ctx, member, elapsed, animated(), member.employee.id === highlightedId);
    for (const member of ordered.filter(member => member.employee.id !== highlightedId)) drawLabel(member, false);
    const highlighted = members.get(highlightedId); if (highlighted) drawLabel(highlighted, true);
    for (const member of ordered) {
      const button = controls.get(member.employee.id); if (!button) continue;
      button.style.left = `${(member.x - 30) / WIDTH * 100}%`;
      button.style.top = `${(member.y - 54) / canvas.height * 100}%`;
      button.style.width = `${60 / WIDTH * 100}%`;
      button.style.height = `${66 / canvas.height * 100}%`;
    }
  }
  function loop(now) {
    frameId = 0; if (!active()) return;
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .08) : 0; lastFrame = now; elapsed += dt;
    for (const member of members.values()) update(member, dt);
    // Cap painting at 30fps; movement uses elapsed time, sprite poses use 4/8fps.
    if (now - lastPaint >= 1000 / 30) { paint(); lastPaint = now; }
    frameId = requestAnimationFrame(loop);
  }
  function syncAnimation() {
    if (frameId) cancelAnimationFrame(frameId); frameId = 0; lastFrame = 0; lastPaint = -1;
    animationButton.textContent = animated() ? 'Ⅱ 暂停动画' : '▷ 开启动画';
    animationButton.setAttribute('aria-pressed', String(animated()));
    if (initialized) paint(); if (active()) frameId = requestAnimationFrame(loop);
  }
  function updateControl(member) {
    const id = member.employee.id; let button = controls.get(id);
    if (!button) {
      button = document.createElement('button'); button.type = 'button'; button.className = 'room-member';
      button.onclick = () => window.workbench.openEmployee(id);
      button.onfocus = () => { focusedId = id; paint(); button.scrollIntoView({block:'nearest',inline:'nearest'}); };
      button.onblur = () => { focusedId = null; paint(); };
      controls.set(id, button);
    }
    button.setAttribute('aria-label', description(member)); return button;
  }
  window.workbench.onData(data => {
    const employees = data.employees ?? [], next = JSON.stringify(employees); if (next === signature) return; signature = next;
    const ids = new Set(employees.map(employee => employee.id));
    for (const id of members.keys()) if (!ids.has(id)) { members.delete(id); controls.get(id)?.remove(); controls.delete(id); if (focusedId === id) focusedId = null; }
    const occupied = new Set([...members.values()].map(member => member.slot));
    for (const employee of employees) {
      let member = members.get(employee.id);
      if (!member) {
        let slot = 0; while (occupied.has(slot)) slot++; occupied.add(slot);
        const seed = hash(employee.id), home = employee.status === 'running' ? station(slot).seat : station(slot).home;
        member = {employee, slot, seed, color: palette[seed % palette.length], ...home, direction: employee.status === 'running' ? 'up' : 'down', activity: 'home', visits: 0, rest: 0, path: []};
        members.set(employee.id, member);
      } else {
        const changed = member.employee.status !== employee.status; member.employee = employee;
        if (changed) {
          member.rest = 0;
          if (animated()) returnHome(member);
          else { Object.assign(member, homeFor(member)); member.path = []; member.activity = 'home'; member.direction = employee.status === 'running' ? 'up' : 'down'; }
        }
      }
    }
    const resized = scene.resize(maxSlot());
    if (resized) for (const member of members.values()) {
      // Resizing invalidates decorative routes. Return characters to their own stations.
      Object.assign(member, homeFor(member)); member.path = []; member.activity = 'home'; member.rest = 0;
    }
    initialized = true;
    document.getElementById('team-caption').textContent = `${employees.length} 位员工 · 真实团队状态`;
    document.getElementById('running-count').textContent = `${employees.filter(employee => employee.status === 'running').length} 执行中`;
    document.getElementById('waiting-count').textContent = `${employees.filter(employee => ['queued', 'waiting_children', 'cancelling'].includes(employee.status)).length} 等待`;
    document.getElementById('empty-room').hidden = employees.length > 0;
    canvas.setAttribute('aria-label', `像素工作室，${employees.length} 位员工，${employees.filter(employee => employee.status === 'running').length} 位执行中。人物气泡显示真实执行步骤，点击角色或气泡查看档案，也可按 Tab 选择员工。`);
    memberLayer.style.aspectRatio = `${WIDTH} / ${canvas.height}`;
    // Stable DOM nodes preserve keyboard focus during status updates.
    employees.forEach((employee, index) => { const button = updateControl(members.get(employee.id)); if (memberLayer.children[index] !== button) memberLayer.insertBefore(button, memberLayer.children[index] ?? null); });
    paint(); if (active() && !frameId) frameId = requestAnimationFrame(loop);
  });
  function setZoom(value) { zoom = Math.max(.75, Math.min(2, value)); canvas.style.width = memberLayer.style.width = `${zoom * 100}%`; document.getElementById('zoom-reset').textContent = `${Math.round(zoom * 100)}%`; }
  document.getElementById('zoom-out').onclick = () => setZoom(zoom - .25);
  document.getElementById('zoom-in').onclick = () => setZoom(zoom + .25);
  document.getElementById('zoom-reset').onclick = () => setZoom(1);
  animationButton.onclick = () => { animationOverride = !animated(); syncAnimation(); };
  canvas.addEventListener('click', event => { const member = hit(event); if (member) window.workbench.openEmployee(member.employee.id); });
  canvas.addEventListener('mousemove', event => { pointer = {clientX: event.clientX, clientY: event.clientY}; updateHover(); if (!active() && initialized) paint(); });
  canvas.addEventListener('mouseleave', () => { pointer = null; hoveredId = null; canvas.style.cursor = 'default'; canvas.title = '点击角色或对话气泡查看员工档案'; if (!active() && initialized) paint(); });
  document.addEventListener('visibilitychange', syncAnimation);
  reducedMotion.addEventListener('change', syncAnimation);
  window.addEventListener('pagehide', () => { if (frameId) cancelAnimationFrame(frameId); frameId = 0; });
  window.addEventListener('pageshow', syncAnimation);
  syncAnimation();
})();
