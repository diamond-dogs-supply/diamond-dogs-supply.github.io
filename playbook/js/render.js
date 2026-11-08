// SVG rendering. Pure functions: play in, markup out. The same code draws the
// editor, PNG/SVG exports and the printed sheets, so what you see is what you
// print. All user text is escaped.

import { routeStart, findPlayer, zoneCenter } from './model.js';

export const THEMES = {
  screen: {
    page: '#14391a', field: '#2e7d32', border: '#ffffff', line: 'rgba(255,255,255,0.35)',
    tick: 'rgba(255,255,255,0.5)', num: 'rgba(255,255,255,0.6)', los: '#ffffff',
    offFill: '#ffffff', offStroke: '#10202b', offText: '#10202b', def: '#ff7b7b', halo: 'rgba(0,0,0,0.55)',
    routeO: '#ffe066', routeD: '#ffb3b3', badgeFill: '#10202b', badgeText: '#ffffff',
    chip: 'rgba(16,32,43,0.88)', chipText: '#ffffff', sel: '#4dd0e1',
  },
  print: {
    page: '#ffffff', field: '#ffffff', border: '#222222', line: '#d6d6d6',
    tick: '#9a9a9a', num: '#8a8a8a', los: '#222222',
    offFill: '#ffffff', offStroke: '#111111', offText: '#111111', def: '#b00020', halo: 'rgba(255,255,255,0.9)',
    routeO: '#111111', routeD: '#b00020', badgeFill: '#ffffff', badgeText: '#111111',
    chip: '#111111', chipText: '#ffffff', sel: '#0097a7',
  },
};

const FONT = "Helvetica, Arial, sans-serif";
const MARGIN = 1.5;

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (v) => String(Math.round(v * 100) / 100);
const safeColor = (c, fb) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fb);

export function geom(play) {
  const { width: W, length: L, backfield: B } = play.field;
  return {
    W, L, B,
    sy: (y) => L - B - y,
    vb: `${-MARGIN} ${-MARGIN} ${W + MARGIN * 2} ${L + MARGIN * 2}`,
    vbW: W + MARGIN * 2,
    vbH: L + MARGIN * 2,
  };
}

export function fullView(g) {
  return { x: -MARGIN, y: -MARGIN, w: g.vbW, h: g.vbH };
}

// A tighter view around everything that is drawn (players, routes, zones, the
// line of scrimmage), for small printed cards. `aspect` (w/h) stretches the
// view to fill a cell of that shape instead of leaving blank bands.
export function viewFor(play, opts = {}) {
  const g = geom(play);
  const show = opts.show || 'all';
  const xs = [];
  const ys = [];
  const K = opts.glyph || 1;
  const add = (x0, y0, x1 = x0, y1 = y0) => { xs.push(x0, x1); ys.push(y0, y1); };
  const visible = new Set(play.players.filter((p) => isVisible(show, p.side)).map((p) => p.id));
  for (const p of play.players) {
    if (!visible.has(p.id)) continue;
    const y = g.sy(p.y);
    add(p.x - 1.6 * K, y - 1.6 * K, p.x + 1.6 * K, y + (p.side === 'D' ? 3 : 1.6) * K);
  }
  for (const r of play.routes) {
    if (!visible.has(r.playerId)) continue;
    for (const pt of routeScreenPoints(play, r)) add(pt.x - 2.2 * K, pt.y - 2.2 * K, pt.x + 2.2 * K, pt.y + 2.2 * K);
    const c = r.kind === 'zone' && r.zone ? zoneCenter(play, r) : null;
    if (c) add(c.x - r.zone.rx - 0.4, g.sy(c.y) - r.zone.ry - 0.4, c.x + r.zone.rx + 0.4, g.sy(c.y) + r.zone.ry + 0.4);
  }
  if (!xs.length) return fullView(g);
  ys.push(g.sy(0) - 1.2, g.sy(0) + 1.8 * K); // keep the line of scrimmage in frame (y only)
  let x0 = Math.min(...xs) - 0.6;
  let x1 = Math.max(...xs) + 0.6;
  let y0 = Math.min(...ys) - 0.6 - (opts.title === false ? 0 : 3.4 * K); // room for the title chip
  let y1 = Math.max(...ys) + 0.6;
  x0 = Math.max(x0, -MARGIN);
  x1 = Math.min(x1, g.W + MARGIN);
  y0 = Math.max(y0, -MARGIN);
  y1 = Math.min(y1, g.L + MARGIN);
  let w = Math.max(x1 - x0, 16);
  let h = Math.max(y1 - y0, 11);
  const aspect = opts.aspect > 0 ? opts.aspect : w / h;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const cx = (x0 + x1) / 2;
  const top = y0; // keep the title room at the top, grow downward when height is spare
  return { x: cx - w / 2, y: top - (h - (y1 - y0)) / 2, w, h };
}

export function isVisible(show, side) {
  return show === 'all' || (show === 'off' && side === 'O') || (show === 'def' && side === 'D');
}

// Absolute points (x, screen y) of a route, including its start.
export function routeScreenPoints(play, route) {
  const g = geom(play);
  const s = routeStart(play, route);
  return [{ x: s.x, y: g.sy(s.y) }, ...route.points.map((p) => ({ x: s.x + p.x, y: g.sy(s.y + p.y) }))];
}

function pathD(pts, curve) {
  if (pts.length < 2) return '';
  const P = (p) => `${f(p.x)} ${f(p.y)}`;
  let d = `M${P(pts[0])}`;
  if (!curve || pts.length < 3) {
    for (let i = 1; i < pts.length; i++) d += ` L${P(pts[i])}`;
    return d;
  }
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  d += ` L${P(mid(pts[0], pts[1]))}`;
  for (let i = 1; i < pts.length - 1; i++) d += ` Q${P(pts[i])} ${P(mid(pts[i], pts[i + 1]))}`;
  d += ` L${P(pts[pts.length - 1])}`;
  return d;
}

function dirOf(pts) {
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len, len: Math.hypot(dx, dy) };
}

function drawRoute(play, route, opts, th, selected, ptsOverride) {
  const player = findPlayer(play, route.playerId);
  const pts = ptsOverride || routeScreenPoints(play, route);
  if (pts.length < 2) return '';
  const color = safeColor(route.color, player && player.side === 'D' ? th.routeD : th.routeO);
  const K = opts.glyph || 1;
  const width = (selected ? 0.38 : 0.28) * K;
  const dir = dirOf(pts);
  const tip = pts[pts.length - 1];
  const line = pts.slice();
  if (route.end === 'arrow' && dir.len > 0.9 * K) {
    line[line.length - 1] = { x: tip.x - dir.x * 0.7 * K, y: tip.y - dir.y * 0.7 * K };
  }
  const dash = route.dash ? ` stroke-dasharray="${f(0.9 * K)} ${f(0.6 * K)}"` : '';
  let out = `<g>`;
  if (selected && opts.editor) {
    out += `<path d="${pathD(line, route.curve)}" fill="none" stroke="${th.sel}" stroke-opacity="0.45" stroke-width="${f(width + 0.6)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  out += `<path d="${pathD(line, route.curve)}" fill="none" stroke="${color}" stroke-width="${f(width)}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
  if (route.end === 'arrow') {
    const base = { x: tip.x - dir.x * K, y: tip.y - dir.y * K };
    const nx = -dir.y;
    const ny = dir.x;
    out += `<polygon points="${f(tip.x)},${f(tip.y)} ${f(base.x + nx * 0.55 * K)},${f(base.y + ny * 0.55 * K)} ${f(base.x - nx * 0.55 * K)},${f(base.y - ny * 0.55 * K)}" fill="${color}"/>`;
  } else if (route.end === 'T') {
    const nx = -dir.y;
    const ny = dir.x;
    out += `<line x1="${f(tip.x + nx * 0.85 * K)}" y1="${f(tip.y + ny * 0.85 * K)}" x2="${f(tip.x - nx * 0.85 * K)}" y2="${f(tip.y - ny * 0.85 * K)}" stroke="${color}" stroke-width="${f(width)}" stroke-linecap="round"/>`;
  } else if (route.end === 'dot') {
    out += `<circle cx="${f(tip.x)}" cy="${f(tip.y)}" r="${f(0.45 * K)}" fill="${color}"/>`;
  }
  if (route.order > 0) {
    const bx = tip.x + dir.x * 1.9 * K;
    const by = tip.y + dir.y * 1.9 * K;
    out += `<circle cx="${f(bx)}" cy="${f(by)}" r="${f(0.8 * K)}" fill="${th.badgeFill}" stroke="${color}" stroke-width="${f(0.14 * K)}"/>`;
    out += `<text x="${f(bx)}" y="${f(by + 0.33 * K)}" text-anchor="middle" font-family="${FONT}" font-size="${f(0.95 * K)}" font-weight="700" fill="${th.badgeText}">${route.order}</text>`;
  }
  if (opts.editor) {
    out += `<path d="${pathD(pts, route.curve)}" fill="none" stroke="transparent" stroke-width="1.8" style="pointer-events:stroke;cursor:pointer" data-rid="${esc(route.id)}"/>`;
  }
  return out + '</g>';
}

// A zone: translucent ellipse plus the line from the defender to its edge.
function zoneParts(play, route, g, K = 1) {
  const player = findPlayer(play, route.playerId);
  const c = zoneCenter(play, route);
  if (!player || !c || !route.zone) return null;
  const cx = c.x;
  const cy = g.sy(c.y);
  const px = player.x;
  const py = g.sy(player.y);
  const dx = px - cx;
  const dy = py - cy;
  const k = Math.hypot(dx / route.zone.rx, dy / route.zone.ry);
  let line = null;
  if (k > 1.02) {
    const edge = { x: cx + dx / k, y: cy + dy / k };
    const len = Math.hypot(edge.x - px, edge.y - py);
    const u = { x: (edge.x - px) / len, y: (edge.y - py) / len };
    const start = { x: px + u.x * 1.5 * K, y: py + u.y * 1.5 * K }; // start outside the defender's X
    if (len > 2.2 * K) line = [start, edge];
  }
  return { cx, cy, line };
}

function drawZone(play, route, g, opts, th, selected) {
  const zp = zoneParts(play, route, g, opts.glyph || 1);
  if (!zp) return { under: '', over: '' };
  const { rx, ry } = route.zone;
  const color = safeColor(route.color, th.routeD);
  const K = opts.glyph || 1;
  const sw = (selected ? 0.34 : 0.24) * K;
  let under = '';
  if (selected && opts.editor) {
    under += `<ellipse cx="${f(zp.cx)}" cy="${f(zp.cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="none" stroke="${th.sel}" stroke-opacity="0.5" stroke-width="${f(sw + 0.6)}"/>`;
  }
  const hit = opts.editor ? ` data-rid="${esc(route.id)}" style="cursor:pointer"` : '';
  under += `<ellipse cx="${f(zp.cx)}" cy="${f(zp.cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${color}" fill-opacity="0.17" stroke="${color}" stroke-width="${f(sw)}" stroke-dasharray="${f(0.9 * K)} ${f(0.5 * K)}"${hit}/>`;
  if (route.label) {
    const size = Math.max(0.6, Math.min(1.05 * K, (rx * 1.7) / (route.label.length * 0.6)));
    under += `<text x="${f(zp.cx)}" y="${f(zp.cy - Math.min(ry * 0.3, 1.1) + size * 0.35)}" text-anchor="middle" font-family="${FONT}" font-size="${f(size)}" font-weight="700" fill="${color}" stroke="${th.halo}" stroke-width="${f(0.2 * K)}" style="paint-order:stroke;pointer-events:none">${esc(route.label)}</text>`;
  }
  const over = zp.line ? drawRoute(play, route, opts, th, selected, zp.line) : '';
  return { under, over };
}

function drawPlayer(p, g, th, opts) {
  const cx = p.x;
  const cy = g.sy(p.y);
  const label = esc(p.label);
  const small = p.label.length > 2;
  const K = opts.glyph || 1;
  const hit = opts.editor ? ` data-pid="${esc(p.id)}" style="cursor:grab"` : '';
  let out = `<g${hit}>`;
  if (opts.editor && opts.sel && opts.sel.playerId === p.id) {
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="1.9" fill="none" stroke="${th.sel}" stroke-width="0.22" stroke-dasharray="0.5 0.35"/>`;
  }
  if (p.side === 'O') {
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(1.15 * K)}" fill="${th.offFill}" stroke="${th.offStroke}" stroke-width="${f(0.18 * K)}"/>`;
    out += `<text x="${f(cx)}" y="${f(cy + (small ? 0.3 : 0.38) * K)}" text-anchor="middle" font-family="${FONT}" font-size="${f((small ? 0.8 : 1.1) * K)}" font-weight="700" fill="${th.offText}" style="pointer-events:none">${label}</text>`;
  } else {
    const a = 0.95 * K;
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(1.6 * K)}" fill="transparent"/>`;
    out += `<path d="M${f(cx - a)} ${f(cy - a)} L${f(cx + a)} ${f(cy + a)} M${f(cx + a)} ${f(cy - a)} L${f(cx - a)} ${f(cy + a)}" stroke="${th.def}" stroke-width="${f(0.34 * K)}" stroke-linecap="round" fill="none"/>`;
    out += `<text x="${f(cx)}" y="${f(cy + 2.35 * K)}" text-anchor="middle" font-family="${FONT}" font-size="${f(0.95 * K)}" font-weight="700" fill="${th.def}" stroke="${th.halo}" stroke-width="${f(0.22 * K)}" style="paint-order:stroke;pointer-events:none">${label}</text>`;
  }
  return out + '</g>';
}

function drawField(g, th, view) {
  const { W, L, B, sy } = g;
  let out = `<rect x="${f(view.x)}" y="${f(view.y)}" width="${f(view.w)}" height="${f(view.h)}" fill="${th.page}"/>`;
  out += `<rect x="0" y="0" width="${W}" height="${L}" fill="${th.field}" stroke="${th.border}" stroke-width="0.3"/>`;
  const yMin = -B;
  const yMax = L - B;
  for (let y = Math.ceil(yMin); y <= yMax; y++) {
    if (y === 0) continue;
    const yy = f(sy(y));
    if (y % 5 === 0) {
      out += `<line x1="0" y1="${yy}" x2="${W}" y2="${yy}" stroke="${th.line}" stroke-width="0.14"/>`;
      if (y > 0) {
        out += `<text x="1.1" y="${f(sy(y) - 0.3)}" font-family="${FONT}" font-size="0.9" font-weight="700" fill="${th.num}">${y}</text>`;
        out += `<text x="${f(W - 1.1)}" y="${f(sy(y) - 0.3)}" text-anchor="end" font-family="${FONT}" font-size="0.9" font-weight="700" fill="${th.num}">${y}</text>`;
      }
    } else {
      out += `<line x1="0" y1="${yy}" x2="0.8" y2="${yy}" stroke="${th.tick}" stroke-width="0.1"/>`;
      out += `<line x1="${W - 0.8}" y1="${yy}" x2="${W}" y2="${yy}" stroke="${th.tick}" stroke-width="0.1"/>`;
    }
  }
  const los = f(sy(0));
  out += `<line x1="0" y1="${los}" x2="${W}" y2="${los}" stroke="${th.los}" stroke-width="0.3" stroke-dasharray="1.2 0.7"/>`;
  out += `<text x="${f(W - 1.1)}" y="${f(sy(0) + 1.1)}" text-anchor="end" font-family="${FONT}" font-size="0.8" font-weight="700" fill="${th.num}">LOS</text>`;
  return out;
}

function chip(x, y, text, size, th, anchorRight, maxW) {
  const w = Math.min(maxW, text.length * size * 0.62 + size * 1.3);
  const h = size * 1.7;
  const rx = anchorRight ? x - w : x;
  let out = `<rect x="${f(rx)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="0.4" fill="${th.chip}"/>`;
  const tl = text.length * size * 0.62 > maxW - size * 1.3 ? ` textLength="${f(maxW - size * 1.3)}" lengthAdjust="spacingAndGlyphs"` : '';
  out += `<text x="${f(rx + size * 0.65)}" y="${f(y + size * 1.2)}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="${th.chipText}"${tl}>${esc(text)}</text>`;
  return out;
}

// Inner markup (no <svg> wrapper) so the editor can keep one persistent <svg>.
export function svgInner(play, opts = {}) {
  const th = THEMES[opts.theme] || THEMES.screen;
  const show = opts.show || 'all';
  const g = geom(play);
  const view = opts.view || (opts.crop ? viewFor(play, opts) : fullView(g));
  let out = drawField(g, th, view);

  if (opts.title !== false) {
    out += chip(Math.max(view.x + 0.8, 0.8), Math.max(view.y + 0.8, 0.8), opts.titleText != null ? String(opts.titleText) : play.name || 'Untitled play', 1.5 * (opts.glyph || 1), th, false, Math.max(8, view.w - 15 * (opts.glyph || 1)));
  }
  if (show !== 'all') {
    out += chip(Math.min(view.x + view.w - 0.8, g.W - 0.8), Math.max(view.y + 0.8, 0.8), show === 'off' ? 'OFFENSE' : 'DEFENSE', 1.0 * (opts.glyph || 1), th, true, 9 * (opts.glyph || 1));
  }

  const visible = new Set(play.players.filter((p) => isVisible(show, p.side)).map((p) => p.id));
  const selRoute = opts.editor && opts.sel && opts.sel.playerId
    ? play.routes.find((r) => r.playerId === opts.sel.playerId && r.kind === opts.sel.kind)
    : null;

  const zoneOver = [];
  for (const r of play.routes) {
    if (!visible.has(r.playerId) || r.kind !== 'zone') continue;
    const z = drawZone(play, r, g, opts, th, !!selRoute && selRoute.id === r.id);
    out += z.under;
    zoneOver.push(z.over);
  }
  for (const r of play.routes) {
    if (!visible.has(r.playerId) || r.kind === 'zone') continue;
    out += drawRoute(play, r, opts, th, !!selRoute && selRoute.id === r.id);
  }
  out += zoneOver.join('');
  for (const p of play.players) {
    if (visible.has(p.id)) out += drawPlayer(p, g, th, opts);
  }

  if (selRoute && visible.has(selRoute.playerId)) {
    const pts = routeScreenPoints(play, selRoute);
    const selPt = opts.sel.point;
    if (selRoute.kind === 'zone' && selRoute.zone) {
      const c = zoneCenter(play, selRoute);
      const cy = g.sy(c.y);
      const sq = (x, y, axis) => `<rect x="${f(x - 0.65)}" y="${f(y - 0.65)}" width="1.3" height="1.3" rx="0.2" fill="#ffffff" stroke="${th.sel}" stroke-width="0.18" data-zr="${axis}" data-rid="${esc(selRoute.id)}" style="cursor:${axis === 'x' ? 'ew-resize' : 'ns-resize'}"/>`;
      out += sq(c.x + selRoute.zone.rx, cy, 'x') + sq(c.x, cy - selRoute.zone.ry, 'y');
    }
    for (let i = 1; i < pts.length; i++) {
      const on = selPt === i - 1;
      out += `<circle cx="${f(pts[i].x)}" cy="${f(pts[i].y)}" r="${on ? 0.95 : 0.7}" fill="${on ? '#ffffff' : th.sel}" stroke="${on ? th.sel : '#ffffff'}" stroke-width="0.18" data-pt="${i - 1}" data-rid="${esc(selRoute.id)}" style="cursor:move"/>`;
    }
  }
  return out;
}

export function svgOpenAttrs(play, size, view) {
  const g = geom(play);
  const dims = size ? ` width="${size.width}" height="${size.height}"` : '';
  const vb = view ? `${f(view.x)} ${f(view.y)} ${f(view.w)} ${f(view.h)}` : g.vb;
  return `xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${dims}`;
}

// Standalone <svg> string for export and print.
export function playToSVG(play, opts = {}) {
  const g = geom(play);
  // Printed cells are small, so players, letters and lines are enlarged to stay
  // readable: about 11 yards per inch is the natural size, more than that scales up.
  const pick = (o) => (opts.crop ? viewFor(play, o) : fullView(g));
  let view = pick(opts);
  let glyph = opts.glyph || 1;
  if (!opts.glyph && opts.cellWIn > 0) {
    glyph = Math.min(1.8, Math.max(1, view.w / opts.cellWIn / 11));
    if (glyph > 1.02) view = pick({ ...opts, glyph });
  }
  let size = null;
  if (opts.widthPx) size = { width: opts.widthPx, height: Math.round((opts.widthPx * view.h) / view.w) };
  const label = `Play diagram: ${play.name || 'Untitled play'}`;
  return `<svg ${svgOpenAttrs(play, size, view)} role="img" aria-label="${esc(label)}">${svgInner(play, { ...opts, view, glyph, editor: false })}</svg>`;
}
