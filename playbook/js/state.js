// Editor state and every editing action. No DOM in here, so it can be tested
// in Node. The UI calls these methods and re-renders when `emit` fires.
//
// Two kinds of change:
//   commit(fn)   a discrete action: one undo step, full re-render
//   live(fn)     part of a drag or typing gesture: wrap with begin/endGesture
//                so the whole gesture becomes a single undo step

import {
  END_STYLES, ROUTE_COLORS, clamp, clampToField, findPlayer, findRoute, makePlayer, makeRoute,
  nextLabel, normField, r1, routeStart,
} from './model.js';
import { defaultsFor, generatePoints, outSign } from './routes.js';
import { formationPlayers } from './formations.js';
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
  select(playerId, kind) {
    this.ui.sel = { playerId, kind: kind || this.ui.sel.kind, point: null };
    this.ui.draw = false;
    this.emit('full');
  }

  clearSelection() {
    this.ui.sel = { playerId: null, kind: this.ui.sel.kind, point: null };
    this.ui.draw = false;
    this.emit('full');
  }

  setKind(kind) {
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
    this.ui.draw = !!on && !!this.selectedRoute();
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

  cleanPatch(patch) {
    const out = {};
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
    Object.assign(r, clean);
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
    r.points[idx] = { x: r1(a.x - s.x), y: r1(a.y - s.y) };
    r.edited = true;
    this.emit('live');
  }

  // Append at a clicked spot (draw mode).
  appendPoint(rid, ax, ay) {
    this.commit(() => {
      const r = this.routeById(rid);
      if (!r || r.points.length >= MAX_POINTS) return;
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
      if (!r || r.points.length >= MAX_POINTS) return;
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
      if (!r || r.points.length >= MAX_POINTS) return;
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
      if (!r || !r.points[idx]) return;
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

  hitRoute(pos, maxDist = 1.4) {
    let best = null;
    for (const r of this.play.routes) {
      const p = this.player(r.playerId);
      if (!p || !isVisible(this.ui.show, p.side)) continue;
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
      const other = this.play.players.filter((p) => p.side !== side);
      this.play.players = side === 'O' ? [...next, ...other] : [...other, ...next];
      const alive = new Set(this.play.players.map((p) => p.id));
      this.play.routes = this.play.routes.filter((r) => alive.has(r.playerId));
      for (const r of this.play.routes) {
        const p = this.player(r.playerId);
        if (p && p.side === side && r.preset !== 'custom' && !r.edited) this.regen(r);
      }
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
