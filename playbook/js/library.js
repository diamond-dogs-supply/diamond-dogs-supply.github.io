// The play library: concepts (partial diagrams for learning), a draft
// Diamond Dawgs playbook, and defensive patterns. Entries are small specs in
// library-data.js; buildEntry() turns one into a normal play using the same
// editor code as the app, so presets, clamping and zones behave identically.
// mixInto() copies pieces of one play into another by position label.
// No DOM in here, so it is testable in Node.

import { FIELD_DEFAULT, SCHEMA, clampToField, clamp, findRoute, makePlayer, normField, r1, uid, validatePlay } from './model.js';
import { COVERAGE_ZONES, formationPlayers } from './formations.js';
import { Editor } from './state.js';
import { CATEGORIES, ENTRIES } from './library-data.js';

export { CATEGORIES, ENTRIES };

export const COLLECTIONS = [
  { id: 'playbook', name: 'Diamond Dawgs playbook' },
  { id: 'concepts', name: 'Concepts and combos' },
];

export const entryById = (id) => ENTRIES.find((e) => e.id === id) || null;

// Every coverage / route family an entry can be tagged as beating.
export const BEATS = ['Man', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4', 'Zone', 'Blitz'];

const PATCH_KEYS = ['depth', 'length', 'flip', 'curve', 'dash', 'end', 'color', 'order'];

function addRoute(ed, player, preset, o = {}) {
  const kind = o.kind || 'route';
  if (preset === 'pts') {
    ed.setPreset(player.id, kind, 'custom');
    const r = findRoute(ed.play, player.id, kind);
    r.points = o.pts.map(([x, y]) => ({ x: r1(x), y: r1(y) }));
    r.edited = true;
  } else {
    ed.setPreset(player.id, kind, preset);
  }
  const patch = {};
  for (const k of PATCH_KEYS) if (k in o) patch[k] = o[k];
  const r = findRoute(ed.play, player.id, kind);
  if (r && Object.keys(patch).length) ed.updateRoute(r.id, patch);
}

export function notesFor(e) {
  const parts = [e.short, ...(e.points || []).map((t) => `- ${t}`)];
  if (e.beats && e.beats.length) parts.push(`Works against: ${e.beats.join(', ')}.`);
  let text = parts.join('\n');
  if (text.length > 800) text = text.slice(0, 797).replace(/\s+\S*$/, '') + '...';
  return text;
}

// Builds a play object from a library entry. `flip` mirrors it left/right.
export function buildEntry(e, { flip = false } = {}) {
  const field = normField(e.field || FIELD_DEFAULT);
  const cx = field.width / 2;
  const tags = [e.kind === 'defense' ? 'defense' : e.kind === 'play' ? 'playbook' : 'concept', ...(e.beats || []).slice(0, 5).map((b) => b.toLowerCase())].slice(0, 8);
  const play = { v: SCHEMA, id: uid(), name: e.name, notes: notesFor(e), tags, field, players: [], routes: [] };

  // offense (optionally only some of the players)
  let offAll = [];
  if (e.off) {
    offAll = formationPlayers('O', e.off, field).map((p) => (e.at && e.at[p.label] ? { ...p, x: r1(cx + e.at[p.label][0]), y: e.at[p.label][1] } : p));
    const keep = e.show ? new Set(e.show) : null;
    for (const p of offAll) if (!keep || keep.has(p.label)) play.players.push(makePlayer('O', p.label, p.x, p.y));
  }
  // defense: a whole look (optionally only some defenders) and/or hand-placed defenders
  if (e.defForm) {
    const keep = e.defShow ? new Set(e.defShow) : null;
    for (const p of formationPlayers('D', e.defForm, field, offAll)) if (!keep || keep.has(p.label)) play.players.push(makePlayer('D', p.label, p.x, p.y));
  }
  for (const d of e.def || []) play.players.push(makePlayer('D', d[0], r1(cx + d[1]), d[2]));

  const ed = new Editor(play);
  const byLabel = (side, label) => ed.play.players.find((p) => p.side === side && p.label === label);

  if (e.cov && COVERAGE_ZONES[e.cov]) ed.applyCoverageZones(e.cov);
  if (e.freeSafety) {
    // the deep-middle defender in man-free: a deep zone, drawn from wherever he stands
    const fs = byLabel('D', 'F');
    if (fs) {
      ed.setPreset(fs.id, 'zone', 'z-third');
      const r = findRoute(ed.play, fs.id, 'zone');
      r.label = 'Free';
    }
  }
  for (const d of e.def || []) {
    const [label, , , zone, zlabel, o = {}] = d;
    const p = byLabel('D', label);
    if (!p || !zone) continue;
    ed.setPreset(p.id, 'zone', zone);
    const r = findRoute(ed.play, p.id, 'zone');
    if (o.c) r.points = [{ x: r1(cx + o.c[0] - p.x), y: r1(o.c[1] - p.y) }];
    if (o.rx || o.ry) r.zone = { rx: o.rx || r.zone.rx, ry: o.ry || r.zone.ry };
    if (zlabel) r.label = String(zlabel).slice(0, 10);
    if (o.c || o.rx || o.ry) r.edited = true;
  }
  for (const [label, zlabel] of Object.entries(e.zl || {})) {
    const p = byLabel('D', label);
    const r = p && findRoute(ed.play, p.id, 'zone');
    if (r) r.label = String(zlabel).slice(0, 10);
  }
  // pre-snap motion first so the routes that follow start where it ends
  const routes = [...(e.routes || [])].sort((a, b) => (b[2] && b[2].kind === 'motion' ? 1 : 0) - (a[2] && a[2].kind === 'motion' ? 1 : 0));
  for (const [label, preset, o] of routes) {
    const p = byLabel('O', label);
    if (p) addRoute(ed, p, preset, o);
  }
  for (const [label, preset, o] of e.droutes || []) {
    const p = byLabel('D', label);
    if (p) addRoute(ed, p, preset, o);
  }

  if (flip) {
    ed.mirror();
    if (e.flipLabels) {
      const swap = { X: 'Z', Z: 'X', Y: 'H', H: 'Y' };
      for (const p of ed.play.players) if (p.side === 'O' && swap[p.label]) p.label = swap[p.label];
    }
  }
  // normalise through the validator so a library play is exactly as safe as an imported one
  return validatePlay(JSON.parse(JSON.stringify(ed.play)));
}

const cache = new Map();
export function playFor(id, opts = {}) {
  const key = `${id}|${opts.flip ? 1 : 0}`;
  if (!cache.has(key)) {
    const e = entryById(id);
    if (!e) return null;
    cache.set(key, buildEntry(e, opts));
  }
  return JSON.parse(JSON.stringify(cache.get(key)));
}

// A fresh copy with new ids, ready to add to the user's plays.
export function freshCopy(id, opts = {}) {
  const p = playFor(id, opts);
  if (!p) return null;
  const ids = new Map(p.players.map((x) => [x.id, uid()]));
  p.id = uid();
  for (const x of p.players) x.id = ids.get(x.id);
  for (const r of p.routes) {
    r.id = uid();
    r.playerId = ids.get(r.playerId);
  }
  return p;
}

export function searchEntries({ collection = null, category = null, beat = null, text = '' } = {}) {
  const q = text.trim().toLowerCase();
  return ENTRIES.filter((e) => {
    if (collection === 'playbook' && e.kind === 'concept') return false;
    if (collection === 'concepts' && e.kind !== 'concept') return false;
    if (category && e.cat !== category) return false;
    if (beat && !(e.beats || []).includes(beat)) return false;
    if (q && !`${e.name} ${e.short} ${(e.points || []).join(' ')} ${(e.beats || []).join(' ')} ${e.cat}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

// ---- mixing pieces of one play into another ---------------------------------
// opts.half: 'all' | 'left' | 'right'   which side of the source to take
// opts.parts: 'all' | 'off' | 'def'     offense routes, defensive zones, or both
// opts.align: move the matching players to where the source stands
export function mixInto(ed, source, { half = 'all', parts = 'all', align = true } = {}) {
  const result = { applied: 0, missing: [] };
  ed.commit(() => {
    const W = ed.play.field.width;
    const Wc = source.field.width;
    const cxs = Wc / 2;
    for (const cp of source.players) {
      if (parts === 'off' && cp.side !== 'O') continue;
      if (parts === 'def' && cp.side !== 'D') continue;
      const mine = source.routes.filter((r) => r.playerId === cp.id);
      if (!mine.length) continue;
      const dx = cp.x - cxs;
      if (half === 'right' && dx < -1.5) continue;
      if (half === 'left' && dx > 1.5) continue;
      const t = ed.play.players.find((p) => p.side === cp.side && p.label === cp.label);
      if (!t) {
        result.missing.push(`${cp.side === 'D' ? 'defender ' : ''}${cp.label}`);
        continue;
      }
      if (align) {
        const pos = clampToField(ed.play.field, W / 2 + dx * (W / Wc), cp.y);
        t.x = r1(pos.x);
        t.y = r1(pos.y);
      }
      for (const r of mine) {
        ed.play.routes = ed.play.routes.filter((x) => !(x.playerId === t.id && x.kind === r.kind));
        const copy = JSON.parse(JSON.stringify(r));
        copy.id = uid();
        copy.playerId = t.id;
        ed.play.routes.push(copy);
        // not aligned to the source: re-draw presets from where this player really is
        if (!align && copy.preset !== 'custom' && !copy.edited) {
          const keepLabel = copy.label;
          ed.regen(copy);
          if (copy.kind === 'zone' && keepLabel) copy.label = keepLabel;
        }
        result.applied++;
      }
    }
  });
  return result;
}
