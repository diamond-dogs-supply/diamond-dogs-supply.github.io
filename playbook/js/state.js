// Editor state and every editing action. No DOM in here, so it can be tested
// in Node. The UI calls these methods and re-renders when `emit` fires.
//
// Two kinds of change:
//   commit(fn)   a discrete action: one undo step, full re-render
//   live(fn)     part of a drag or typing gesture: wrap with begin/endGesture
//                so the whole gesture becomes a single undo step

import {
  END_STYLES, ROUTE_COLORS, clamp, clampToField, findPlayer, findRoute, makePlayer, makeRoute,
  kindsFor, nextLabel, normField, r1, routeStart, zoneCenter,
} from './model.js';
import { ZONE_LIMITS, ZONE_MAP, buildZone, defaultsFor, generatePoints, outSign } from './routes.js';
import { COVERAGE_ZONES, formationPlayers } from './formations.js';
import { isVisible } from './render.js';

const MAX_POINTS = 12;
const MAX_UNDO = 200;

export function closestOnSegment(a, b, p) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return { x, y, t, dist: Math.hypot(p.x - x, p.y - y) };
}

export class Editor {
  constructor(play) {
    this.play = play;
    this.ui = { sel: { playerId: null, kind: 'route', point: null }, show: 'all', snap: true, draw: false };
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
    this.gesture = null;
  }

  // ---- plumbing -----------------------------------------------------------
  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(kind = 'full') {
    for (const fn of this.listeners) fn(kind);
  }

  snapshot() {
    return JSON.stringify(this.play);
  }

  pushUndo(before) {
    this.undoStack.push(before);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

  commit(fn) {
    const before = this.snapshot();
    const result = fn();
    if (before !== this.snapshot()) this.pushUndo(before);
    this.fixSelection();
    this.emit('full');
    return result;
  }

  live(fn) {
    const result = fn();
    this.emit('live');
    return result;
  }

  beginGesture() {
    if (this.gesture === null) this.gesture = this.snapshot();
  }

  endGesture() {
    if (this.gesture === null) return;
    const before = this.gesture;
    this.gesture = null;
    if (before !== this.snapshot()) this.pushUndo(before);
    this.fixSelection();
    this.emit('full');
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo) return;
    this.redoStack.push(this.snapshot());
    this.play = JSON.parse(this.undoStack.pop());
    this.gesture = null;
    this.fixSelection();
    this.emit('full');
  }

  redo() {
    if (!this.canRedo) return;
    this.undoStack.push(this.snapshot());
    this.play = JSON.parse(this.redoStack.pop());
    this.gesture = null;
    this.fixSelection();
    this.emit('full');
  }

  loadPlay(play) {
    this.play = play;
    this.undoStack = [];
    this.redoStack = [];
    this.gesture = null;
    this.ui.sel = { playerId: null, kind: 'route', point: null };
    this.ui.draw = false;
    this.emit('full');
  }

  fixSelection() {
    const s = this.ui.sel;
    if (s.playerId && !findPlayer(this.play, s.playerId)) {
      this.ui.sel = { playerId: null, kind: 'route', point: null };
      this.ui.draw = false;
      return;
    }
    const sp = s.playerId && findPlayer(this.play, s.playerId);
    if (sp && !kindsFor(sp.side).includes(s.kind)) s.kind = this.defaultKind(sp);
    const r = this.selectedRoute();
    if (!r) {
      this.ui.draw = false;
      s.point = null;
    } else if (s.point !== null && s.point >= r.points.length) {
      s.point = null;
    }
  }

  // ---- lookups ------------------------------------------------------------
  player(id) {
    return findPlayer(this.play, id);
  }

  routeById(id) {
    return this.play.routes.find((r) => r.id === id) || null;
  }

  selectedRoute() {
    const s = this.ui.sel;
    return s.playerId ? findRoute(this.play, s.playerId, s.kind) : null;
  }

  absPoints(route) {
    const s = routeStart(this.play, route);
    return [s, ...route.points.map((p) => ({ x: s.x + p.x, y: s.y + p.y }))];
  }

  sn(v) {
    return this.ui.snap ? Math.round(v * 2) / 2 : r1(v);
  }

  fieldBounds() {
    const { width, length, backfield } = this.play.field;
    return { xMin: 0, xMax: width, yMin: -backfield, yMax: length - backfield };
  }

  // ---- selection / view ---------------------------------------------------
  // Which tab a freshly selected player opens on: defenders open on their
  // zone unless they only have a path; everyone keeps motion if it was open.
  defaultKind(player, wanted) {
    const kinds = kindsFor(player.side);
    if (wanted && kinds.includes(wanted)) return wanted;
    if (player.side === 'D') {
      const hasPath = !!findRoute(this.play, player.id, 'route');
      return hasPath && !findRoute(this.play, player.id, 'zone') ? 'route' : 'zone';
    }
    return this.ui.sel.kind === 'motion' ? 'motion' : 'route';
  }

  select(playerId, kind) {
    const p = this.player(playerId);
    this.ui.sel = { playerId, kind: p ? this.defaultKind(p, kind) : kind || 'route', point: null };
    this.ui.draw = false;
    this.emit('full');
  }

  clearSelection() {
    this.ui.sel = { playerId: null, kind: this.ui.sel.kind, point: null };
    this.ui.draw = false;
    this.emit('full');
  }

  setKind(kind) {
    const p = this.player(this.ui.sel.playerId);
    if (p && !kindsFor(p.side).includes(kind)) return;
    this.ui.sel = { ...this.ui.sel, kind, point: null };
    this.ui.draw = false;
    this.emit('full');
  }

  selectPoint(idx) {
    this.ui.sel = { ...this.ui.sel, point: idx };
    this.emit('full');
  }

  setShow(mode) {
    this.ui.show = ['all', 'off', 'def'].includes(mode) ? mode : 'all';
    const p = this.player(this.ui.sel.playerId);
    if (p && !isVisible(this.ui.show, p.side)) this.ui.sel = { playerId: null, kind: this.ui.sel.kind, point: null };
    this.fixSelection();
    this.emit('full');
  }

  setSnap(on) {
    this.ui.snap = !!on;
    this.emit('full');
  }

  setDraw(on) {
    const r = this.selectedRoute();
    this.ui.draw = !!on && !!r && r.kind !== 'zone';
    this.emit('full');
  }

  // ---- players ------------------------------------------------------------
  movePlayer(id, x, y) {
    const p = this.player(id);
    if (!p) return;
    const pos = clampToField(this.play.field, this.sn(x), this.sn(y));
    p.x = r1(pos.x);
    p.y = r1(pos.y);
    this.emit('live');
  }

  nudgePlayer(id, dx, dy) {
    const p = this.player(id);
    if (!p) return;
    this.commit(() => {
      const pos = clampToField(this.play.field, p.x + dx, p.y + dy);
      p.x = r1(pos.x);
      p.y = r1(pos.y);
    });
  }

  setLabel(id, label) {
    const p = this.player(id);
    if (!p) return;
    p.label = String(label).slice(0, 4);
    this.emit('live');
  }

  freeSpot(side) {
    const cx = this.play.field.width / 2;
    const y = side === 'O' ? -3 : 7;
    for (let k = 0; k < 40; k++) {
      const x = cx + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 2.6;
      if (x < 1.2 || x > this.play.field.width - 1.2) continue;
      if (this.play.players.every((p) => Math.hypot(p.x - x, p.y - y) > 2.4)) return { x: r1(x), y };
    }
    return { x: r1(cx), y: side === 'O' ? -2 : 8 };
  }

  addPlayer(side) {
    return this.commit(() => {
      const count = this.play.players.filter((p) => p.side === side).length;
      if (count >= 15) return null;
      const spot = this.freeSpot(side);
      const p = makePlayer(side, nextLabel(side, this.play.players), spot.x, spot.y);
      this.play.players.push(p);
      this.play.players.sort((a, b) => (a.side === b.side ? 0 : a.side === 'O' ? -1 : 1));
      this.ui.sel = { playerId: p.id, kind: 'route', point: null };
      this.ui.draw = false;
      return p;
    });
  }

  removePlayer(id) {
    this.commit(() => {
      this.play.players = this.play.players.filter((p) => p.id !== id);
      this.play.routes = this.play.routes.filter((r) => r.playerId !== id);
    });
  }

  // ---- routes -------------------------------------------------------------
  ensureRoute(playerId, kind) {
    let r = findRoute(this.play, playerId, kind);
    if (!r) {
      r = makeRoute(playerId, kind);
      this.play.routes.push(r);
    }
    return r;
  }

  regen(route) {
    const player = this.player(route.playerId);
    if (!player || route.preset === 'custom') return;
    if (route.kind === 'zone') {
      this.applyZone(route, route.preset);
      return;
    }
    const out = outSign(player.x, this.play.field.width, route.flip);
    const raw = generatePoints(route.preset, route.depth, route.length, out);
    // Keep presets inside the lines, wherever the player (or motion) starts.
    const s = routeStart(this.play, route);
    const b = this.fieldBounds();
    const m = 0.8;
    route.points = raw.map((pt) => ({
      x: r1(clamp(s.x + pt.x, b.xMin + m, b.xMax - m) - s.x),
      y: r1(clamp(s.y + pt.y, b.yMin + m, b.yMax - m) - s.y),
    }));
    route.edited = false;
  }

  setPreset(playerId, kind, presetId) {
    this.commit(() => {
      const r = this.ensureRoute(playerId, kind);
      if (kind === 'zone') {
        this.applyZone(r, ZONE_MAP[presetId] ? presetId : 'custom');
        this.ui.sel = { playerId, kind, point: null };
        this.ui.draw = false;
        return;
      }
      if (presetId === 'custom') {
        r.preset = 'custom';
        r.points = [];
        r.edited = false;
        r.depth = 0;
        r.length = 0;
        r.curve = false;
        this.ui.sel = { playerId, kind, point: null };
        this.ui.draw = true;
        return;
      }
      const d = defaultsFor(presetId);
      r.preset = presetId;
      r.depth = d.depth;
      r.length = d.length;
      r.curve = d.curve;
      this.regen(r);
      if (kind === 'motion') {
        // the route that follows motion starts somewhere new: redraw it
        const after = findRoute(this.play, playerId, 'route');
        if (after && after.preset !== 'custom' && !after.edited) this.regen(after);
      }
      this.ui.sel = { playerId, kind, point: null };
      this.ui.draw = false;
    });
  }

  // Puts a zone preset on a zone route (size, centre, label). 'custom' drops a
  // hook-sized ellipse in front of the defender to be dragged where you like.
  applyZone(route, presetId, slot = null) {
    const player = this.player(route.playerId);
    if (!player) return;
    const field = this.play.field;
    const built = buildZone(ZONE_MAP[presetId] ? presetId : 'z-hook', player, field, slot);
    route.kind = 'zone';
    route.preset = ZONE_MAP[presetId] ? presetId : 'custom';
    route.points = built.points;
    route.zone = { rx: built.rx, ry: built.ry };
    route.label = route.preset === 'custom' ? 'Zone' : built.label;
    route.edited = route.preset === 'custom';
    route.end = 'none';
    route.dash = false;
  }

  cleanPatch(patch) {
    const out = {};
    if ('rx' in patch) out.rx = clamp(Number(patch.rx) || 0, ZONE_LIMITS.min, Math.min(ZONE_LIMITS.max, this.play.field.width / 2));
    if ('ry' in patch) out.ry = clamp(Number(patch.ry) || 0, ZONE_LIMITS.min, ZONE_LIMITS.max);
    if ('label' in patch) out.label = String(patch.label).slice(0, 10);
    if ('depth' in patch) out.depth = clamp(Number(patch.depth) || 0, 0, 60);
    if ('length' in patch) out.length = clamp(Number(patch.length) || 0, 0, 60);
    for (const k of ['flip', 'curve', 'dash']) if (k in patch) out[k] = !!patch[k];
    if ('end' in patch && END_STYLES.includes(patch.end)) out.end = patch.end;
    if ('color' in patch) out.color = ROUTE_COLORS.includes(patch.color) ? patch.color : null;
    if ('order' in patch) out.order = Math.round(clamp(Number(patch.order) || 0, 0, 9));
    return out;
  }

  mutateRoute(rid, patch) {
    const r = this.routeById(rid);
    if (!r) return;
    const clean = this.cleanPatch(patch);
    const { rx, ry, ...rest } = clean;
    Object.assign(r, rest);
    if (r.kind === 'zone') {
      if (r.zone && (rx !== undefined || ry !== undefined)) {
        r.zone = { rx: rx !== undefined ? r1(rx) : r.zone.rx, ry: ry !== undefined ? r1(ry) : r.zone.ry };
        r.edited = true;
      }
      return;
    }
    if (('depth' in clean || 'length' in clean || 'flip' in clean) && r.preset !== 'custom') this.regen(r);
  }

  updateRoute(rid, patch) {
    this.commit(() => this.mutateRoute(rid, patch));
  }

  updateRouteLive(rid, patch) {
    this.live(() => this.mutateRoute(rid, patch));
  }

  resetRoute(rid) {
    this.commit(() => {
      const r = this.routeById(rid);
      if (r && r.preset !== 'custom') this.regen(r);
    });
  }

  removeRoute(rid) {
    this.commit(() => {
      this.play.routes = this.play.routes.filter((r) => r.id !== rid);
    });
  }

  absClamp(ax, ay) {
    const b = this.fieldBounds();
    return { x: clamp(this.sn(ax), b.xMin, b.xMax), y: clamp(this.sn(ay), b.yMin, b.yMax) };
  }

  // Drag a point (live; wrap in begin/endGesture).
  movePoint(rid, idx, ax, ay) {
    const r = this.routeById(rid);
    if (!r || !r.points[idx]) return;
    const s = routeStart(this.play, r);
    const a = this.absClamp(ax, ay);
    if (r.kind === 'zone' && r.zone) {
      // keep the whole ellipse inside the lines
      const b = this.fieldBounds();
      a.x = clamp(a.x, Math.min(b.xMin + r.zone.rx, (b.xMin + b.xMax) / 2), Math.max(b.xMax - r.zone.rx, (b.xMin + b.xMax) / 2));
      a.y = clamp(a.y, Math.min(b.yMin + r.zone.ry, (b.yMin + b.yMax) / 2), Math.max(b.yMax - r.zone.ry, (b.yMin + b.yMax) / 2));
    }
    r.points[idx] = { x: r1(a.x - s.x), y: r1(a.y - s.y) };
    r.edited = true;
    this.emit('live');
  }

  // Drag a zone's edge handle (live; wrap in begin/endGesture). axis 'x' or 'y'.
  dragZoneEdge(rid, axis, ax, ay) {
    const r = this.routeById(rid);
    const c = r && r.kind === 'zone' && r.zone ? zoneCenter(this.play, r) : null;
    if (!c) return;
    const max = ZONE_LIMITS.max;
    const rx = axis === 'x' ? clamp(Math.abs(this.sn(ax) - c.x), ZONE_LIMITS.min, Math.min(max, this.play.field.width / 2)) : r.zone.rx;
    const ry = axis === 'y' ? clamp(Math.abs(this.sn(ay) - c.y), ZONE_LIMITS.min, max) : r.zone.ry;
    r.zone = { rx: r1(rx), ry: r1(ry) };
    r.edited = true;
    this.emit('live');
  }

  // Replace the zones of every defender with the given coverage (not committed).
  _applyCoverage(id) {
    const map = COVERAGE_ZONES[id];
    const defenders = this.play.players.filter((p) => p.side === 'D');
    const ids = new Set(defenders.map((p) => p.id));
    this.play.routes = this.play.routes.filter((r) => !(r.kind === 'zone' && ids.has(r.playerId)));
    if (!map) return 0;
    const byPreset = {};
    for (const d of defenders) if (map[d.label]) (byPreset[map[d.label]] ||= []).push(d);
    let n = 0;
    for (const [preset, list] of Object.entries(byPreset)) {
      list.sort((a, b) => a.x - b.x);
      const fits = list.length === ZONE_MAP[preset].fr.length;
      list.forEach((d, i) => {
        const r = makeRoute(d.id, 'zone');
        this.applyZone(r, preset, fits ? i : null);
        this.play.routes.push(r);
        n++;
      });
    }
    return n;
  }

  applyCoverageZones(id) {
    return this.commit(() => this._applyCoverage(id));
  }

  // Append at a clicked spot (draw mode).
  appendPoint(rid, ax, ay) {
    this.commit(() => {
      const r = this.routeById(rid);
      if (!r || r.kind === 'zone' || r.points.length >= MAX_POINTS) return;
      const s = routeStart(this.play, r);
      const a = this.absClamp(ax, ay);
      r.points.push({ x: r1(a.x - s.x), y: r1(a.y - s.y) });
      r.edited = true;
      this.ui.sel.point = r.points.length - 1;
    });
  }

  // "Add point" button: insert after the selected point (midpoint of the next
  // segment), or extend the end of the route.
  addPointAuto(rid) {
    this.commit(() => {
      const r = this.routeById(rid);
      if (!r || r.kind === 'zone' || r.points.length >= MAX_POINTS) return;
      const abs = this.absPoints(r);
      const sel = this.ui.sel.point;
      let idx;
      let np;
      if (sel !== null && sel < r.points.length - 1) {
        idx = sel + 1; // between abs[sel+1] and abs[sel+2]
        const a = abs[sel + 1];
        const b = abs[sel + 2];
        np = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      } else {
        idx = r.points.length;
        const last = abs[abs.length - 1];
        const prev = abs[abs.length - 2];
        if (prev) {
          const dx = last.x - prev.x;
          const dy = last.y - prev.y;
          const len = Math.hypot(dx, dy) || 1;
          np = { x: last.x + (dx / len) * 3, y: last.y + (dy / len) * 3 };
        } else {
          np = { x: last.x, y: last.y + 3 };
        }
      }
      const a = this.absClamp(np.x, np.y);
      const s = abs[0];
      r.points.splice(idx, 0, { x: r1(a.x - s.x), y: r1(a.y - s.y) });
      r.edited = true;
      this.ui.sel.point = idx;
    });
  }

  insertPointAt(rid, ax, ay, maxDist = 1.6) {
    let done = false;
    this.commit(() => {
      const r = this.routeById(rid);
      if (!r || r.kind === 'zone' || r.points.length >= MAX_POINTS) return;
      const abs = this.absPoints(r);
      let best = null;
      for (let i = 0; i < abs.length - 1; i++) {
        const c = closestOnSegment(abs[i], abs[i + 1], { x: ax, y: ay });
        if (!best || c.dist < best.dist) best = { ...c, i };
      }
      if (!best || best.dist > maxDist) return;
      const a = this.absClamp(best.x, best.y);
      r.points.splice(best.i, 0, { x: r1(a.x - abs[0].x), y: r1(a.y - abs[0].y) });
      r.edited = true;
      this.ui.sel.point = best.i;
      done = true;
    });
    return done;
  }

  deletePoint(rid, idx) {
    this.commit(() => {
      const r = this.routeById(rid);
      if (!r || r.kind === 'zone' || !r.points[idx]) return;
      r.points.splice(idx, 1);
      r.edited = true;
      this.ui.sel.point = null;
      if (r.points.length === 0) {
        this.play.routes = this.play.routes.filter((x) => x.id !== rid);
      }
    });
  }

  // ---- hit testing (yards) ------------------------------------------------
  hitPoint(pos, maxDist = 1.3) {
    const r = this.selectedRoute();
    if (!r) return null;
    const abs = this.absPoints(r);
    let best = null;
    for (let i = 1; i < abs.length; i++) {
      const d = Math.hypot(abs[i].x - pos.x, abs[i].y - pos.y);
      if (d <= maxDist && (!best || d < best.dist)) best = { rid: r.id, idx: i - 1, dist: d };
    }
    return best;
  }

  // Defender -> ellipse edge, in field coordinates (y up), or null if inside.
  zoneLine(r) {
    const p = this.player(r.playerId);
    const c = r.zone ? zoneCenter(this.play, r) : null;
    if (!p || !c) return null;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const k = Math.hypot(dx / r.zone.rx, dy / r.zone.ry);
    if (k <= 1.02) return null;
    return [{ x: p.x, y: p.y }, { x: c.x + dx / k, y: c.y + dy / k }];
  }

  hitRoute(pos, maxDist = 1.4) {
    let best = null;
    for (const r of this.play.routes) {
      const p = this.player(r.playerId);
      if (!p || !isVisible(this.ui.show, p.side)) continue;
      if (r.kind === 'zone') {
        const zc = r.zone ? zoneCenter(this.play, r) : null;
        if (zc) {
          const k = Math.hypot((pos.x - zc.x) / r.zone.rx, (pos.y - zc.y) / r.zone.ry);
          // inside the ellipse counts (a little worse than a line), as does its rim
          const d = k <= 1 ? 1 : Math.abs(k - 1) * Math.min(r.zone.rx, r.zone.ry);
          if (d <= maxDist && (!best || d < best.dist)) best = { rid: r.id, dist: d };
        }
        const line = this.zoneLine(r);
        if (line) {
          const c = closestOnSegment(line[0], line[1], pos);
          if (c.dist <= maxDist && (!best || c.dist < best.dist)) best = { rid: r.id, dist: c.dist };
        }
        continue;
      }
      const abs = this.absPoints(r);
      for (let i = 0; i < abs.length - 1; i++) {
        const c = closestOnSegment(abs[i], abs[i + 1], pos);
        if (c.dist <= maxDist && (!best || c.dist < best.dist)) best = { rid: r.id, dist: c.dist };
      }
    }
    return best;
  }

  // ---- whole-play actions -------------------------------------------------
  mirror() {
    this.commit(() => {
      const W = this.play.field.width;
      for (const p of this.play.players) p.x = r1(W - p.x);
      for (const r of this.play.routes) r.points = r.points.map((pt) => ({ x: r1(-pt.x), y: pt.y }));
    });
  }

  applyFormation(side, id) {
    this.commit(() => {
      const field = this.play.field;
      const offense = this.play.players.filter((p) => p.side === 'O');
      const entries = formationPlayers(side, id, field, offense);
      const existing = this.play.players.filter((p) => p.side === side);
      const used = new Set();
      const next = [];
      for (const e of entries) {
        const p = existing.find((x) => x.label === e.label && !used.has(x.id));
        if (p) {
          used.add(p.id);
          p.x = e.x;
          p.y = e.y;
          next.push(p);
        } else {
          next.push(makePlayer(side, e.label, e.x, e.y));
        }
      }
      const hadZones = side === 'D' && this.play.routes.some((r) => r.kind === 'zone' && !r.edited);
      const other = this.play.players.filter((p) => p.side !== side);
      this.play.players = side === 'O' ? [...next, ...other] : [...other, ...next];
      const alive = new Set(this.play.players.map((p) => p.id));
      this.play.routes = this.play.routes.filter((r) => alive.has(r.playerId));
      for (const r of this.play.routes) {
        const p = this.player(r.playerId);
        if (p && p.side === side && r.preset !== 'custom' && !r.edited) this.regen(r);
      }
      if (hadZones) this._applyCoverage(id); // zones follow the new look (man drops them)
    });
  }

  setField(patch) {
    this.live(() => {
      this.play.field = normField({ ...this.play.field, ...patch });
      for (const p of this.play.players) {
        const pos = clampToField(this.play.field, p.x, p.y);
        p.x = r1(pos.x);
        p.y = r1(pos.y);
      }
    });
  }

  setMeta(key, value) {
    this.live(() => {
      if (key === 'name') this.play.name = String(value).slice(0, 60);
      else if (key === 'notes') this.play.notes = String(value).slice(0, 800);
      else if (key === 'tags') {
        this.play.tags = String(value).split(',').map((t) => t.trim().slice(0, 24)).filter(Boolean).slice(0, 8);
      }
    });
  }
}
