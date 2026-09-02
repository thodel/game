// ── Football renderer: a perspective view of the flat 960×540 world ──
// The match model keeps every player and the ball in a top-down world
// (x 48–912, y 34–506). This projects that world onto a raised camera: rows
// further away are narrower and higher, figures scale with depth, the goal
// has posts, a crossbar and a net. Salvaged from the pre-split game.js.
import { clamp } from '../../core/utils.js';

const W = 960, H = 540;

// World point (x, y) at height z → screen point with its depth scale
export function projectFootball3D(x, y, z = 0) {
  const depth = clamp((y - 34) / 472, 0, 1), scale = 0.7 + depth * 0.35;
  return { x: 480 + (x - 480) * scale, y: 108 + depth * 394 - z * scale, scale, depth };
}

const fillProjected = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill(); };
const strokeWorldLine = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => { const p = projectFootball3D(x, y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke(); };
const strokeWorldEllipse = (ctx, cx, cy, rx, ry) => { const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } strokeWorldLine(ctx, pts); };

export function drawGoal3D(ctx, team) {
  const x = team === 'home' ? 48 : 912, backX = team === 'home' ? 20 : 940, top = 205, bottom = 335, height = 30;
  const a = projectFootball3D(x, top), b = projectFootball3D(x, bottom);
  const at = projectFootball3D(x, top, height), bt = projectFootball3D(x, bottom, height);
  const c = projectFootball3D(backX, top, height), d = projectFootball3D(backX, bottom, height);
  // posts and crossbar, then the roof of the net
  ctx.strokeStyle = 'rgba(242,246,244,.88)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(at.x, at.y); ctx.lineTo(bt.x, bt.y); ctx.lineTo(b.x, b.y);
  ctx.moveTo(at.x, at.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.lineTo(bt.x, bt.y); ctx.stroke();
  // the net
  ctx.strokeStyle = 'rgba(220,230,225,.24)'; ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const y = top + (bottom - top) * i / 5, front = projectFootball3D(x, y, height), back = projectFootball3D(backX, y, height);
    ctx.beginPath(); ctx.moveTo(front.x, front.y); ctx.lineTo(back.x, back.y); ctx.stroke();
  }
  for (let i = 1; i < 4; i++) {
    const z = height * i / 4, p1 = projectFootball3D(backX, top, z), p2 = projectFootball3D(backX, bottom, z);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }
}

export function drawPitch(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, 160);
  sky.addColorStop(0, '#07131b'); sky.addColorStop(1, '#26383e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // the stand behind the far touchline
  ctx.fillStyle = '#202a2f'; ctx.fillRect(0, 42, W, 92);
  const crowd = ['#eef1ef', '#dfff53', '#ef5c53', '#4d78e0'];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 80; col++) {
    ctx.fillStyle = crowd[(row * 5 + col * 3) % crowd.length]; ctx.globalAlpha = 0.52;
    ctx.beginPath(); ctx.arc(col * 12 + (row % 2) * 5, 61 + row * 17, 2.1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.fillStyle = '#0f171a'; ctx.fillRect(0, 128, W, 18);
  // grass, mown in stripes, in perspective
  const corners = [[48, 34], [912, 34], [912, 506], [48, 506]].map(([x, y]) => projectFootball3D(x, y));
  const grass = ctx.createLinearGradient(0, corners[0].y, 0, corners[2].y);
  grass.addColorStop(0, '#2e7d3b'); grass.addColorStop(1, '#16552d');
  ctx.fillStyle = grass; fillProjected(ctx, corners);
  for (let i = 0; i < 10; i++) {
    const x1 = 48 + i * 86.4, x2 = x1 + 86.4;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.06)';
    fillProjected(ctx, [[x1, 34], [x2, 34], [x2, 506], [x1, 506]].map(([x, y]) => projectFootball3D(x, y)));
  }
  ctx.strokeStyle = 'rgba(255,255,255,.78)'; ctx.lineWidth = 2;
  strokeWorldLine(ctx, [[48, 34], [912, 34], [912, 506], [48, 506], [48, 34]]);
  strokeWorldLine(ctx, [[480, 34], [480, 506]]);
  strokeWorldEllipse(ctx, 480, 270, 62, 62);
  strokeWorldLine(ctx, [[48, 160], [168, 160], [168, 380], [48, 380]]);
  strokeWorldLine(ctx, [[912, 160], [792, 160], [792, 380], [912, 380]]);
  strokeWorldLine(ctx, [[48, 205], [93, 205], [93, 335], [48, 335]]);
  strokeWorldLine(ctx, [[912, 205], [867, 205], [867, 335], [912, 335]]);
  drawGoal3D(ctx, 'home'); drawGoal3D(ctx, 'away');
}

export function drawFootballer(ctx, p, selected) {
  const proj = projectFootball3D(p.x, p.y), scale = proj.scale * (p.keeper ? 1.04 : 1);
  const moving = Math.hypot(p.vx || 0, p.vy || 0) > 8;
  const step = moving ? Math.sin(p.stride || 0) * 3.5 : 0;
  const kit = p.keeper ? '#f2a900' : p.team === 'home' ? '#dfff53' : '#4267d6';
  const trim = p.keeper ? '#211b0c' : p.team === 'home' ? '#142016' : '#d5ddff';
  const skin = p.team === 'home' ? '#d7a071' : '#9a6548';
  ctx.save(); ctx.translate(proj.x, proj.y); ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(0, 2, 12, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = trim; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(-6 + step * 0.35, 4); ctx.moveTo(4, -5); ctx.lineTo(6 - step * 0.35, 4); ctx.stroke();
  ctx.strokeStyle = skin; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(-8, -24); ctx.lineTo(-13, -11 - step * 0.25); ctx.moveTo(8, -24); ctx.lineTo(13, -11 + step * 0.25); ctx.stroke();
  ctx.fillStyle = kit; ctx.strokeStyle = trim; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-9, -32, 18, 27, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = trim; ctx.font = '800 7px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(p.number || 7), 0, -19);
  ctx.fillStyle = skin; ctx.strokeStyle = 'rgba(44,26,17,.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, -39, 6.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#332319'; ctx.beginPath(); ctx.arc(0, -41, 5.5, Math.PI, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (selected) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(proj.x, proj.y, 17 * scale, 7 * scale, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath();
    ctx.moveTo(proj.x - 5, proj.y - 51 * scale); ctx.lineTo(proj.x + 5, proj.y - 51 * scale); ctx.lineTo(proj.x, proj.y - 44 * scale); ctx.fill();
  }
}

export function drawBall(ctx, b) {
  const speed = Math.hypot(b.vx || 0, b.vy || 0), height = b.owner ? 4 : Math.min(12, speed * 0.022);
  const ground = projectFootball3D(b.x, b.y), p = projectFootball3D(b.x, b.y, height), size = 6.5 * p.scale;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(ground.x, ground.y, 7 * ground.scale, 3 * ground.scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c8cec9'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(p.x, p.y, size * 0.3, 0, Math.PI * 2); ctx.fill();
}

// Far rows first, so nearer figures overlap them
export function drawMatch(m) {
  drawPitch(m.context);
  m.players.slice().sort((a, b) => a.y - b.y).forEach(p => drawFootballer(m.context, p, p.human));
  drawBall(m.context, m.ball);
}

// A larger figure for the stadium intro
export function drawStadiumPerson(ctx, x, y, team, keeper, scale) {
  const kit = keeper ? '#f2a900' : team === 'home' ? '#dfff53' : '#4267d6', trim = team === 'home' ? '#132016' : '#e2e8ff', skin = team === 'home' ? '#d8a378' : '#966247';
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 16, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = skin; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(-18, 8); ctx.moveTo(9, -3); ctx.lineTo(18, 8); ctx.stroke();
  ctx.strokeStyle = trim; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-5, 16); ctx.lineTo(-8, 30); ctx.moveTo(5, 16); ctx.lineTo(8, 30); ctx.stroke();
  ctx.fillStyle = kit; ctx.beginPath(); ctx.roundRect(-12, -12, 24, 31, 7); ctx.fill(); ctx.fillStyle = trim; ctx.fillRect(-12, 7, 24, 4);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -21, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#281b15'; ctx.beginPath(); ctx.arc(0, -24, 8, Math.PI, Math.PI * 2); ctx.fill(); ctx.restore();
}
