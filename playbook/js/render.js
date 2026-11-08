// SVG rendering. Pure functions: play in, markup out. The same code draws the
// editor, PNG/SVG exports and the printed sheets, so what you see is what you
// print. All user text is escaped.

import { routeStart, findPlayer } from './model.js';

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

function drawRoute(play, route, opts, th, selected) {
  const player = findPlayer(play, route.playerId);
  const pts = routeScreenPoints(play, route);
  if (pts.length < 2) return '';
  const color = safeColor(route.color, player && player.side === 'D' ? th.routeD : th.routeO);
  const width = selected ? 0.38 : 0.28;
  const dir = dirOf(pts);
  const tip = pts[pts.length - 1];
  const line = pts.slice();
  if (route.end === 'arrow' && dir.len > 0.9) {
    line[line.length - 1] = { x: tip.x - dir.x * 0.7, y: tip.y - dir.y * 0.7 };
  }
  const dash = route.dash ? ' stroke-dasharray="0.9 0.6"' : '';
  let out = `<g>`;
  if (selected && opts.editor) {
    out += `<path d="${pathD(line, route.curve)}" fill="none" stroke="${th.sel}" stroke-opacity="0.45" stroke-width="${f(width + 0.6)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  out += `<path d="${pathD(line, route.curve)}" fill="none" stroke="${color}" stroke-width="${f(width)}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
  if (route.end === 'arrow') {
    const base = { x: tip.x - dir.x * 1.0, y: tip.y - dir.y * 1.0 };
    const nx = -dir.y;
    const ny = dir.x;
    out += `<polygon points="${f(tip.x)},${f(tip.y)} ${f(base.x + nx * 0.55)},${f(base.y + ny * 0.55)} ${f(base.x - nx * 0.55)},${f(base.y - ny * 0.55)}" fill="${color}"/>`;
  } else if (route.end === 'T') {
    const nx = -dir.y;
    const ny = dir.x;
    out += `<line x1="${f(tip.x + nx * 0.85)}" y1="${f(tip.y + ny * 0.85)}" x2="${f(tip.x - nx * 0.85)}" y2="${f(tip.y - ny * 0.85)}" stroke="${color}" stroke-width="${f(width)}" stroke-linecap="round"/>`;
  } else if (route.end === 'dot') {
    out += `<circle cx="${f(tip.x)}" cy="${f(tip.y)}" r="0.45" fill="${color}"/>`;
  }
  if (route.order > 0) {
    const bx = tip.x + dir.x * 1.9;
    const by = tip.y + dir.y * 1.9;
    out += `<circle cx="${f(bx)}" cy="${f(by)}" r="0.8" fill="${th.badgeFill}" stroke="${color}" stroke-width="0.14"/>`;
    out += `<text x="${f(bx)}" y="${f(by + 0.33)}" text-anchor="middle" font-family="${FONT}" font-size="0.95" font-weight="700" fill="${th.badgeText}">${route.order}</text>`;
  }
  if (opts.editor) {
    out += `<path d="${pathD(pts, route.curve)}" fill="none" stroke="transparent" stroke-width="1.8" style="pointer-events:stroke;cursor:pointer" data-rid="${esc(route.id)}"/>`;
  }
  return out + '</g>';
}

function drawPlayer(p, g, th, opts) {
  const cx = p.x;
  const cy = g.sy(p.y);
  const label = esc(p.label);
  const small = p.label.length > 2;
  const hit = opts.editor ? ` data-pid="${esc(p.id)}" style="cursor:grab"` : '';
  let out = `<g${hit}>`;
  if (opts.editor && opts.sel && opts.sel.playerId === p.id) {
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="1.9" fill="none" stroke="${th.sel}" stroke-width="0.22" stroke-dasharray="0.5 0.35"/>`;
  }
  if (p.side === 'O') {
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="1.15" fill="${th.offFill}" stroke="${th.offStroke}" stroke-width="0.18"/>`;
    out += `<text x="${f(cx)}" y="${f(cy + (small ? 0.3 : 0.38))}" text-anchor="middle" font-family="${FONT}" font-size="${small ? 0.8 : 1.1}" font-weight="700" fill="${th.offText}" style="pointer-events:none">${label}</text>`;
  } else {
    out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="1.6" fill="transparent"/>`;
    out += `<path d="M${f(cx - 0.95)} ${f(cy - 0.95)} L${f(cx + 0.95)} ${f(cy + 0.95)} M${f(cx + 0.95)} ${f(cy - 0.95)} L${f(cx - 0.95)} ${f(cy + 0.95)}" stroke="${th.def}" stroke-width="0.34" stroke-linecap="round" fill="none"/>`;
    out += `<text x="${f(cx)}" y="${f(cy + 2.35)}" text-anchor="middle" font-family="${FONT}" font-size="0.95" font-weight="700" fill="${th.def}" stroke="${th.halo}" stroke-width="0.22" style="paint-order:stroke;pointer-events:none">${label}</text>`;
  }
  return out + '</g>';
}

function drawField(g, th) {
  const { W, L, B, sy } = g;
  let out = `<rect x="${-MARGIN}" y="${-MARGIN}" width="${f(g.vbW)}" height="${f(g.vbH)}" fill="${th.page}"/>`;
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
  let out = drawField(g, th);

  if (opts.title !== false) {
    out += chip(0.8, 0.8, play.name || 'Untitled play', 1.5, th, false, Math.max(8, g.W - 12));
  }
  if (show !== 'all') {
    out += chip(g.W - 0.8, 0.8, show === 'off' ? 'OFFENSE' : 'DEFENSE', 1.0, th, true, 9);
  }

  const visible = new Set(play.players.filter((p) => isVisible(show, p.side)).map((p) => p.id));
  const selRoute = opts.editor && opts.sel && opts.sel.playerId
    ? play.routes.find((r) => r.playerId === opts.sel.playerId && r.kind === opts.sel.kind)
    : null;

  for (const r of play.routes) {
    if (!visible.has(r.playerId)) continue;
    out += drawRoute(play, r, opts, th, !!selRoute && selRoute.id === r.id);
  }
  for (const p of play.players) {
    if (visible.has(p.id)) out += drawPlayer(p, g, th, opts);
  }

  if (selRoute && visible.has(selRoute.playerId)) {
    const pts = routeScreenPoints(play, selRoute);
    const selPt = opts.sel.point;
    for (let i = 1; i < pts.length; i++) {
      const on = selPt === i - 1;
      out += `<circle cx="${f(pts[i].x)}" cy="${f(pts[i].y)}" r="${on ? 0.95 : 0.7}" fill="${on ? '#ffffff' : th.sel}" stroke="${on ? th.sel : '#ffffff'}" stroke-width="0.18" data-pt="${i - 1}" data-rid="${esc(selRoute.id)}" style="cursor:move"/>`;
    }
  }
  return out;
}

export function svgOpenAttrs(play, size) {
  const g = geom(play);
  const dims = size ? ` width="${size.width}" height="${size.height}"` : '';
  return `xmlns="http://www.w3.org/2000/svg" viewBox="${g.vb}"${dims}`;
}

// Standalone <svg> string for export and print.
export function playToSVG(play, opts = {}) {
  const g = geom(play);
  let size = null;
  if (opts.widthPx) size = { width: opts.widthPx, height: Math.round((opts.widthPx * g.vbH) / g.vbW) };
  const label = `Play diagram: ${play.name || 'Untitled play'}`;
  return `<svg ${svgOpenAttrs(play, size)} role="img" aria-label="${esc(label)}">${svgInner(play, { ...opts, editor: false })}</svg>`;
}
