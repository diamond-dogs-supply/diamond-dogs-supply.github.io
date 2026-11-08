// Play data model, defaults and validation.
//
// Coordinates are yards. x runs from the left sideline (0) to the right
// sideline (field.width). y is measured from the line of scrimmage: 0 is the
// LOS, positive is downfield, negative is the backfield. Route points are
// stored relative to their player so routes travel with the player.

import { PRESET_MAP, ZONE_MAP, ZONE_LIMITS } from './routes.js';
import { OFFENSE_LABELS, DEFENSE_LABELS, formationPlayers } from './formations.js';

export { OFFENSE_LABELS, DEFENSE_LABELS };

export const SCHEMA = 1;
export const FIELD_DEFAULT = Object.freeze({ width: 40, length: 35, backfield: 10 });
export const FIELD_LIMITS = Object.freeze({ width: [15, 60], length: [20, 80], backfield: [4, 20] });
export const END_STYLES = ['arrow', 'T', 'dot', 'none'];
export const ROUTE_KINDS = ['route', 'motion', 'zone'];
export const kindsFor = (side) => (side === 'D' ? ['zone', 'route'] : ['route', 'motion']);
export const ROUTE_COLORS = [null, '#111111', '#1565c0', '#c62828', '#2e7d32', '#ef6c00', '#6a1b9a', '#00838f'];

const MAX_PLAYERS_PER_SIDE = 15;
const MAX_POINTS = 12;

export const uid = () => Math.random().toString(36).slice(2, 9);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const r1 = (v) => {
  const x = Math.round(v * 10) / 10;
  return x === 0 ? 0 : x;
};

export function num(v, fallback = 0) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v)) return +v;
  return fallback;
}

export function normField(f = {}) {
  const width = Math.round(clamp(num(f.width, FIELD_DEFAULT.width), ...FIELD_LIMITS.width));
  const length = Math.round(clamp(num(f.length, FIELD_DEFAULT.length), ...FIELD_LIMITS.length));
  let backfield = Math.round(clamp(num(f.backfield, FIELD_DEFAULT.backfield), ...FIELD_LIMITS.backfield));
  backfield = Math.min(backfield, length - 10); // always show at least 10 yards downfield
  return { width, length, backfield };
}

// Where a player may stand (keeps a margin so circles stay inside the lines).
export function clampToField(field, x, y, margin = 0.8) {
  return {
    x: clamp(x, margin, field.width - margin),
    y: clamp(y, -field.backfield + margin, field.length - field.backfield - margin),
  };
}

export function makePlayer(side, label, x, y) {
  return { id: uid(), side, label, x, y };
}

export function makeRoute(playerId, kind) {
  return {
    id: uid(),
    playerId,
    kind,
    preset: 'custom',
    edited: false,
    depth: 0,
    length: 0,
    flip: false,
    curve: false,
    dash: kind === 'motion',
    end: kind === 'zone' ? 'none' : 'arrow',
    color: null,
    order: 0,
    points: [],
    zone: null, // {rx, ry} half-axes in yards, only for kind 'zone'
    label: '',
  };
}

export function nextLabel(side, players) {
  const used = new Set(players.filter((p) => p.side === side).map((p) => p.label));
  const defaults = side === 'O' ? OFFENSE_LABELS : DEFENSE_LABELS;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (const l of [...defaults, ...alphabet]) if (!used.has(l)) return l;
  return String(used.size + 1);
}

export function newPlay(name = 'New play') {
  const field = normField(FIELD_DEFAULT);
  const play = { v: SCHEMA, id: uid(), name, notes: '', tags: [], field, players: [], routes: [] };
  for (const e of formationPlayers('O', '2x2', field)) play.players.push(makePlayer('O', e.label, e.x, e.y));
  const offense = play.players.filter((p) => p.side === 'O');
  for (const e of formationPlayers('D', 'cover3', field, offense)) play.players.push(makePlayer('D', e.label, e.x, e.y));
  return play;
}

export function findPlayer(play, id) {
  return play.players.find((p) => p.id === id) || null;
}

export function findRoute(play, playerId, kind) {
  return play.routes.find((r) => r.playerId === playerId && r.kind === kind) || null;
}

// Absolute centre of a zone route, or null.
export function zoneCenter(play, route) {
  const player = findPlayer(play, route.playerId);
  if (!player || route.kind !== 'zone' || !route.points.length) return null;
  return { x: player.x + route.points[0].x, y: player.y + route.points[0].y };
}

// Where a route begins. A route that follows pre-snap motion starts where the
// motion ends.
export function routeStart(play, route) {
  const player = findPlayer(play, route.playerId);
  if (!player) return { x: 0, y: 0 };
  const start = { x: player.x, y: player.y };
  if (route.kind === 'route') {
    const motion = findRoute(play, route.playerId, 'motion');
    if (motion && motion.points.length) {
      const last = motion.points[motion.points.length - 1];
      start.x += last.x;
      start.y += last.y;
    }
  }
  return start;
}

const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);
const isColor = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

// Turns anything (a file, a share link, localStorage) into a safe play.
// Throws if it is not recognisable as a play at all.
export function validatePlay(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.players)) throw new Error('Not a play file');
  const field = normField(raw.field);
  const play = {
    v: SCHEMA,
    id: str(raw.id, 24) || uid(),
    name: str(raw.name, 60) || 'Untitled play',
    notes: str(raw.notes, 800),
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 8).map((t) => str(t, 24)).filter(Boolean) : [],
    field,
    players: [],
    routes: [],
  };

  const ids = new Set();
  const counts = { O: 0, D: 0 };
  for (const rp of raw.players) {
    if (!rp || typeof rp !== 'object') continue;
    const side = rp.side === 'D' ? 'D' : 'O';
    if (counts[side] >= MAX_PLAYERS_PER_SIDE) continue;
    let id = str(rp.id, 24) || uid();
    if (ids.has(id)) id = uid();
    ids.add(id);
    counts[side]++;
    const pos = clampToField(field, r1(num(rp.x, field.width / 2)), r1(num(rp.y, 0)));
    play.players.push({ id, side, label: str(rp.label, 4), x: r1(pos.x), y: r1(pos.y) });
  }

  const seen = new Set();
  for (const rr of Array.isArray(raw.routes) ? raw.routes : []) {
    if (!rr || typeof rr !== 'object' || !ids.has(rr.playerId)) continue;
    const kind = ROUTE_KINDS.includes(rr.kind) ? rr.kind : 'route';
    const key = rr.playerId + '|' + kind;
    if (seen.has(key)) continue;
    const owner = play.players.find((pl) => pl.id === rr.playerId);
    if (kind === 'zone' && owner.side !== 'D') continue; // zones are a defensive tool
    const route = makeRoute(rr.playerId, kind);
    route.id = str(rr.id, 24) || route.id;
    route.preset = (kind === 'zone' ? ZONE_MAP : PRESET_MAP)[rr.preset] ? rr.preset : 'custom';
    route.edited = !!rr.edited;
    route.depth = clamp(num(rr.depth, 0), 0, 60);
    route.length = clamp(num(rr.length, 0), 0, 60);
    route.flip = !!rr.flip;
    route.curve = !!rr.curve;
    route.dash = rr.dash === undefined ? kind === 'motion' : !!rr.dash;
    route.end = END_STYLES.includes(rr.end) ? rr.end : route.end;
    route.color = isColor(rr.color) ? rr.color : null;
    route.order = Math.round(clamp(num(rr.order, 0), 0, 9));
    route.points = (Array.isArray(rr.points) ? rr.points : [])
      .slice(0, MAX_POINTS)
      .map((pt) => ({ x: r1(clamp(num(pt && pt.x, 0), -120, 120)), y: r1(clamp(num(pt && pt.y, 0), -120, 120)) }));
    if (kind === 'zone') {
      if (!route.points.length) continue; // a zone needs its centre
      route.points = route.points.slice(0, 1);
      const zr = rr.zone && typeof rr.zone === 'object' ? rr.zone : {};
      route.zone = {
        rx: r1(clamp(num(zr.rx, 5), ZONE_LIMITS.min, ZONE_LIMITS.max)),
        ry: r1(clamp(num(zr.ry, 4), ZONE_LIMITS.min, ZONE_LIMITS.max)),
      };
      route.label = str(rr.label, 10);
    }
    seen.add(key);
    play.routes.push(route);
  }
  return play;
}

export function clonePlay(play) {
  return JSON.parse(JSON.stringify(play));
}
