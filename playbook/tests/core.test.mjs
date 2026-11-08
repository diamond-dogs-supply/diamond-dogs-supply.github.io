// Run with: node --test playbook/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { newPlay, validatePlay, normField, routeStart, findRoute } from '../js/model.js';
import { generatePoints, PRESETS, outSign, ZONE_PRESETS, buildZone } from '../js/routes.js';
import { Editor } from '../js/state.js';
import { encodePlay, decodePlay, codeFromHash, pack } from '../js/share.js';
import { playToSVG, svgInner, viewFor } from '../js/render.js';
import { formationPlayers } from '../js/formations.js';
import { layoutSheet, normLayout, pageCount, pageStyle, sheetHTML, validateSheet, newSheet, toUnit, fromUnit } from '../js/sheet.js';

const byLabel = (play, side, label) => play.players.find((p) => p.side === side && p.label === label);

test('new play has 7v7 with letter labels, all inside the field', () => {
  const play = newPlay();
  const off = play.players.filter((p) => p.side === 'O').map((p) => p.label).sort();
  assert.deepEqual(off, ['C', 'F', 'H', 'Q', 'X', 'Y', 'Z']);
  const def = play.players.filter((p) => p.side === 'D').map((p) => p.label).sort();
  assert.deepEqual(def, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  for (const p of play.players) {
    assert.ok(p.x >= 0 && p.x <= play.field.width, `x in field for ${p.label}`);
    assert.ok(p.y >= -play.field.backfield && p.y <= play.field.length - play.field.backfield, `y in field for ${p.label}`);
  }
});

test('field size is configurable and clamped; players are pulled inside', () => {
  assert.deepEqual(normField({ width: 5, length: 500, backfield: 99 }), { width: 15, length: 80, backfield: 20 });
  assert.deepEqual(normField({ width: 30, length: 22, backfield: 20 }), { width: 30, length: 22, backfield: 12 });
  const ed = new Editor(newPlay());
  ed.setField({ width: 20, length: 30 });
  assert.equal(ed.play.field.width, 20);
  for (const p of ed.play.players) assert.ok(p.x >= 0.8 && p.x <= 19.2);
  // formations scale down for narrow fields
  const small = formationPlayers('O', '2x2', { width: 20, length: 30, backfield: 8 });
  assert.ok(Math.max(...small.map((p) => p.x)) <= 18 && Math.min(...small.map((p) => p.x)) >= 2);
});

test('route presets point the right way for each side of the field', () => {
  const W = 40;
  assert.equal(outSign(5, W), -1);
  assert.equal(outSign(35, W), 1);
  assert.equal(outSign(35, W, true), -1);
  const slantLeftPlayer = generatePoints('slant', 2, 5, outSign(5, W));
  assert.ok(slantLeftPlayer[1].x > 0, 'slant from the left side breaks right (inside)');
  const slantRightPlayer = generatePoints('slant', 2, 5, outSign(35, W));
  assert.ok(slantRightPlayer[1].x < 0, 'slant from the right side breaks left (inside)');
  const outRight = generatePoints('out', 8, 7, 1);
  assert.deepEqual(outRight, [{ x: 0, y: 8 }, { x: 7, y: 8 }]);
  const corner = generatePoints('corner', 10, 8, -1);
  assert.deepEqual(corner[1], { x: -8, y: 18 });
  assert.deepEqual(generatePoints('go', 20, 0, 1), [{ x: 0, y: 20 }]);
  // mirror symmetry for every preset, and no -0 leaking out
  for (const pr of PRESETS) {
    const a = generatePoints(pr.id, pr.depth, pr.length, 1);
    const b = generatePoints(pr.id, pr.depth, pr.length, -1);
    assert.ok(a.length >= 1, pr.id);
    a.forEach((pt, i) => {
      assert.equal(b[i].x, pt.x === 0 ? 0 : -pt.x, `${pr.id} mirrors`);
      assert.equal(b[i].y, pt.y, `${pr.id} keeps depth`);
      assert.ok(!Object.is(b[i].x, -0), `${pr.id} has no -0`);
    });
  }
  // the numbered tree is 1..9 in order
  assert.deepEqual(PRESETS.filter((p) => p.num).map((p) => p.id),
    ['flat', 'slant', 'comeback', 'curl', 'out', 'dig', 'corner', 'post', 'go']);
});

test('pick a preset for a player, then edit its points', () => {
  const ed = new Editor(newPlay());
  const x = byLabel(ed.play, 'O', 'X'); // wide left
  ed.setPreset(x.id, 'route', 'post');
  let r = findRoute(ed.play, x.id, 'route');
  assert.equal(r.preset, 'post');
  assert.equal(r.edited, false);
  assert.equal(r.points.length, 2);
  assert.ok(r.points[1].x > 0, 'post from the left breaks toward the middle');

  // dragging the player carries the route with it (relative points)
  const before = JSON.stringify(r.points);
  ed.beginGesture();
  ed.movePlayer(x.id, x.x + 3, x.y);
  ed.endGesture();
  assert.equal(JSON.stringify(findRoute(ed.play, x.id, 'route').points), before);

  // drag the break point: route becomes edited, still remembers its preset
  r = findRoute(ed.play, x.id, 'route');
  const start = routeStart(ed.play, r);
  ed.beginGesture();
  ed.movePoint(r.id, 1, start.x + 4, start.y + 14);
  ed.endGesture();
  r = findRoute(ed.play, x.id, 'route');
  assert.equal(r.edited, true);
  assert.equal(r.preset, 'post');
  assert.deepEqual(r.points[1], { x: 4, y: 14 });

  // reset puts the preset shape back
  ed.resetRoute(r.id);
  r = findRoute(ed.play, x.id, 'route');
  assert.equal(r.edited, false);
  assert.deepEqual(r.points, generatePoints('post', r.depth, r.length, outSign(x.x, 40, false)));

  // changing depth redraws from the preset
  ed.updateRoute(r.id, { depth: 14 });
  assert.equal(findRoute(ed.play, x.id, 'route').points[0].y, 14);
});

test('presets never run off the field, even after motion toward the sideline', () => {
  const ed = new Editor(newPlay());
  const h = byLabel(ed.play, 'O', 'H');
  ed.setPreset(h.id, 'motion', 'flat');
  ed.setPreset(h.id, 'route', 'corner');
  const r = findRoute(ed.play, h.id, 'route');
  for (const pt of ed.absPoints(r)) {
    assert.ok(pt.x >= 0 && pt.x <= ed.play.field.width, `x ${pt.x} inside`);
    assert.ok(pt.y <= ed.play.field.length - ed.play.field.backfield, `y ${pt.y} inside`);
  }
  // every preset, from every offensive spot, stays inside
  for (const pr of PRESETS) {
    for (const p of ed.play.players.filter((q) => q.side === 'O')) {
      ed.setPreset(p.id, 'route', pr.id);
      for (const pt of ed.absPoints(findRoute(ed.play, p.id, 'route'))) {
        assert.ok(pt.x >= 0 && pt.x <= 40 && pt.y >= -10 && pt.y <= 25, `${pr.id} from ${p.label}`);
      }
    }
  }
  // changing the motion redraws the route that follows it (clamped against
  // the sideline after "flat" motion, free after "drag" motion)
  ed.setPreset(h.id, 'motion', 'flat');
  ed.setPreset(h.id, 'route', 'corner');
  const before = JSON.stringify(findRoute(ed.play, h.id, 'route').points);
  ed.setPreset(h.id, 'motion', 'drag');
  const after = findRoute(ed.play, h.id, 'route').points;
  assert.notEqual(JSON.stringify(after), before);
  assert.deepEqual(after[1], { x: 8, y: 18 }, 'corner is no longer squeezed by the sideline');
});

test('add, insert and delete points; deleting the last point removes the route', () => {
  const ed = new Editor(newPlay());
  const z = byLabel(ed.play, 'O', 'Z');
  ed.setPreset(z.id, 'route', 'out');
  let r = findRoute(ed.play, z.id, 'route');
  const n = r.points.length;
  ed.addPointAuto(r.id);
  assert.equal(findRoute(ed.play, z.id, 'route').points.length, n + 1);
  // double-click on the line adds a point at that spot
  r = findRoute(ed.play, z.id, 'route');
  const abs = ed.absPoints(r);
  const mid = { x: (abs[0].x + abs[1].x) / 2, y: (abs[0].y + abs[1].y) / 2 };
  assert.equal(ed.insertPointAt(r.id, mid.x, mid.y), true);
  assert.equal(findRoute(ed.play, z.id, 'route').points.length, n + 2);
  // far away from the line does nothing
  assert.equal(ed.insertPointAt(r.id, mid.x + 10, mid.y), false);
  // hit testing finds points of the selected route
  ed.select(z.id, 'route');
  r = findRoute(ed.play, z.id, 'route');
  const a1 = ed.absPoints(r)[1];
  assert.equal(ed.hitPoint({ x: a1.x + 0.3, y: a1.y }).idx, 0);
  assert.equal(ed.hitPoint({ x: a1.x + 50, y: a1.y + 50 }), null);
  while (findRoute(ed.play, z.id, 'route')) ed.deletePoint(findRoute(ed.play, z.id, 'route').id, 0);
  assert.equal(findRoute(ed.play, z.id, 'route'), null);
});

test('custom drawn route: click to add points', () => {
  const ed = new Editor(newPlay());
  const y = byLabel(ed.play, 'O', 'Y');
  ed.setPreset(y.id, 'route', 'custom');
  assert.equal(ed.ui.draw, true);
  const r = findRoute(ed.play, y.id, 'route');
  ed.appendPoint(r.id, y.x, y.y + 6);
  ed.appendPoint(r.id, y.x + 5, y.y + 6);
  assert.deepEqual(findRoute(ed.play, y.id, 'route').points, [{ x: 0, y: 6 }, { x: 5, y: 6 }]);
});

test('motion moves the player first and the route starts from the end of motion', () => {
  const ed = new Editor(newPlay());
  const h = byLabel(ed.play, 'O', 'H');
  ed.setPreset(h.id, 'motion', 'drag');
  ed.setPreset(h.id, 'route', 'go');
  const motion = findRoute(ed.play, h.id, 'motion');
  const route = findRoute(ed.play, h.id, 'route');
  assert.equal(motion.dash, true);
  const s = routeStart(ed.play, route);
  const last = motion.points[motion.points.length - 1];
  assert.equal(s.x, h.x + last.x);
  assert.equal(routeStart(ed.play, motion).x, h.x);
});

test('undo/redo; a drag is one undo step', () => {
  const ed = new Editor(newPlay());
  const q = byLabel(ed.play, 'O', 'Q');
  const x0 = q.x;
  ed.beginGesture();
  for (let i = 1; i <= 10; i++) ed.movePlayer(q.id, x0 + i, q.y);
  ed.endGesture();
  assert.equal(ed.undoStack.length, 1);
  assert.equal(byLabel(ed.play, 'O', 'Q').x, x0 + 10);
  ed.undo();
  assert.equal(byLabel(ed.play, 'O', 'Q').x, x0);
  ed.redo();
  assert.equal(byLabel(ed.play, 'O', 'Q').x, x0 + 10);
  // no-op gesture adds nothing
  const depth = ed.undoStack.length;
  ed.beginGesture();
  ed.endGesture();
  assert.equal(ed.undoStack.length, depth);
});

test('add/remove players, editable labels, formations keep routes by label', () => {
  const ed = new Editor(newPlay());
  assert.equal(ed.play.players.filter((p) => p.side === 'O').length, 7);
  const added = ed.addPlayer('O');
  assert.equal(ed.play.players.filter((p) => p.side === 'O').length, 8);
  assert.ok(added.label.length > 0);
  for (const p of ed.play.players) if (p !== added) assert.ok(Math.hypot(p.x - added.x, p.y - added.y) > 2.3, 'new player does not overlap');
  ed.beginGesture();
  ed.setLabel(added.id, 'WR12345');
  ed.endGesture();
  assert.equal(ed.player(added.id).label, 'WR12');
  const x = byLabel(ed.play, 'O', 'X');
  ed.setPreset(x.id, 'route', 'go');
  ed.setPreset(added.id, 'route', 'flat');
  ed.applyFormation('O', 'trips-r');
  assert.equal(ed.play.players.filter((p) => p.side === 'O').length, 7, 'extra player dropped by the 7-player formation');
  assert.ok(findRoute(ed.play, x.id, 'route'), 'X keeps its route (same label, same id)');
  assert.equal(ed.play.routes.some((r) => r.playerId === added.id), false, 'removed player lost its route');
  ed.removePlayer(x.id);
  assert.equal(ed.play.routes.some((r) => r.playerId === x.id), false);
  // man coverage lines up on the receivers
  ed.applyFormation('D', 'man');
  assert.equal(ed.play.players.filter((p) => p.side === 'D').length, 7);
});

test('mirror flips players and routes and is its own inverse', () => {
  const ed = new Editor(newPlay());
  const x = byLabel(ed.play, 'O', 'X');
  ed.setPreset(x.id, 'route', 'corner');
  const before = JSON.stringify(ed.play);
  ed.mirror();
  const r = findRoute(ed.play, x.id, 'route');
  assert.ok(r.points[1].x > 0 ? true : r.points[1].x < 0);
  assert.notEqual(JSON.stringify(ed.play), before);
  ed.mirror();
  assert.equal(JSON.stringify(ed.play), before);
});

test('validatePlay rejects junk and sanitises hostile input', () => {
  assert.throws(() => validatePlay(null));
  assert.throws(() => validatePlay({ nope: 1 }));
  const evil = validatePlay({
    name: '<img src=x onerror=alert(1)>'.repeat(10),
    field: { width: 9999, length: -4 },
    players: [{ id: 'a', side: 'O', label: '<script>', x: 1e9, y: 'abc' }, { id: 'a', side: 'D', label: 'B', x: 5, y: 5 }],
    routes: [
      { playerId: 'a', kind: 'route', preset: 'nope', color: 'red;background:url(x)', end: 'weird', points: [{ x: 1e9, y: 'q' }] },
      { playerId: 'ghost', kind: 'route', points: [] },
    ],
  });
  assert.equal(evil.name.length, 60);
  assert.deepEqual(evil.field, { width: 60, length: 20, backfield: 10 });
  assert.equal(evil.players.length, 2);
  assert.notEqual(evil.players[0].id, evil.players[1].id);
  assert.equal(evil.players[0].label.length <= 4, true);
  assert.equal(evil.routes.length, 1);
  assert.equal(evil.routes[0].color, null);
  assert.equal(evil.routes[0].end, 'arrow');
  assert.equal(evil.routes[0].preset, 'custom');
  assert.ok(Math.abs(evil.routes[0].points[0].x) <= 120);
  const svg = playToSVG(evil, { theme: 'print' });
  assert.ok(!svg.includes('<script>'), 'labels are escaped');
  assert.ok(!svg.includes('<img'), 'title is escaped');
});

test('share link round-trips a play and stays small', async () => {
  const ed = new Editor(newPlay());
  ed.setMeta('name', 'Mesh vs "Cover 2" & <man>');
  ed.setField({ width: 30, length: 40, backfield: 8 });
  for (const [label, preset] of [['X', 'post'], ['Y', 'drag'], ['H', 'drag'], ['Z', 'corner'], ['F', 'wheel']]) {
    const p = byLabel(ed.play, 'O', label);
    ed.setPreset(p.id, 'route', preset);
  }
  const f = byLabel(ed.play, 'O', 'F');
  ed.updateRoute(findRoute(ed.play, f.id, 'route').id, { order: 2, color: '#c62828', end: 'dot' });
  ed.setPreset(byLabel(ed.play, 'O', 'H').id, 'motion', 'flat');
  const code = await encodePlay(ed.play);
  assert.match(code, /^z\.[A-Za-z0-9_-]+$/);
  const url = `https://diamonddawg.games/playbook/#p=${code}`;
  console.log(`  share link length: ${url.length} characters (raw JSON ${JSON.stringify(ed.play).length} bytes)`);
  assert.ok(url.length < 1500, 'a typical play fits comfortably in a link');
  assert.equal(codeFromHash('#p=' + code), code);
  assert.equal(codeFromHash('#other'), null);
  assert.equal(codeFromHash('#p=<script>'), null);
  const back = await decodePlay(code);
  const strip = (p) => ({ ...p, id: '_' });
  const norm = (p) => JSON.stringify(strip(validatePlay(p)), (k, v) => (k === 'id' || k === 'playerId' ? undefined : v));
  assert.equal(norm(back), norm(ed.play));
  assert.notEqual(back.id, ed.play.id, 'received plays are new copies');
  assert.deepEqual(pack(back).f, [30, 40, 8]);
  await assert.rejects(decodePlay('z.not-valid-data'));
  await assert.rejects(decodePlay('q.abc'));
});

test('render: well-formed SVG with title corner, field size, and side filter', () => {
  const play = newPlay('Smash Right');
  const ed = new Editor(play);
  ed.setPreset(byLabel(ed.play, 'O', 'Z').id, 'route', 'corner');
  const all = playToSVG(ed.play, { theme: 'print', widthPx: 800 });
  assert.ok(all.includes('Smash Right'), 'title is drawn on the sheet');
  assert.ok(all.includes('viewBox="-1.5 -1.5 43 38"'), 'viewBox follows the 40x35 field');
  const off = svgInner(ed.play, { theme: 'print', show: 'off' });
  const def = svgInner(ed.play, { theme: 'print', show: 'def' });
  assert.ok(off.includes('OFFENSE') && !off.includes('#b00020'), 'offense only hides defenders');
  assert.ok(def.includes('DEFENSE') && def.includes('#b00020') && !def.includes('stroke-linejoin="round"/><polygon'), 'defense only hides offense and its routes');
  ed.setField({ width: 25, length: 50 });
  assert.ok(playToSVG(ed.play).includes('viewBox="-1.5 -1.5 28 53"'));
  try {
    const dir = mkdtempSync(join(tmpdir(), 'pb-'));
    const file = join(dir, 'play.svg');
    writeFileSync(file, all);
    execFileSync('xmllint', ['--noout', file], { stdio: 'pipe' });
  } catch (e) {
    if (e.code !== 'ENOENT') throw e; // xmllint not installed: skip the XML check
  }
});


// ---- defensive zones -------------------------------------------------------
const zoneOf = (ed, label) => findRoute(ed.play, byLabel(ed.play, 'D', label).id, 'zone');

test('every zone preset keeps its ellipse inside the field, for several field sizes', () => {
  for (const field of [{ width: 40, length: 35, backfield: 10 }, { width: 25, length: 30, backfield: 8 }, { width: 55, length: 60, backfield: 12 }]) {
    for (const z of ZONE_PRESETS) {
      for (let slot = 0; slot < z.fr.length; slot++) {
        const b = buildZone(z.id, { x: 20, y: 5 }, field, slot);
        const cx = 20 + b.points[0].x;
        const cy = 5 + b.points[0].y;
        assert.ok(cx - b.rx >= -0.01 && cx + b.rx <= field.width + 0.01, `${z.id} x fits ${field.width}`);
        assert.ok(cy - b.ry >= -field.backfield - 0.01 && cy + b.ry <= field.length - field.backfield + 0.01, `${z.id} y fits`);
      }
    }
  }
});

test('setting a zone on a defender, editing it, and undoing', () => {
  const ed = new Editor(newPlay());
  const d = byLabel(ed.play, 'D', 'E');
  ed.select(d.id);
  assert.equal(ed.ui.sel.kind, 'zone', 'a defender opens on the zone tab');
  ed.setPreset(d.id, 'zone', 'z-hook');
  const z = zoneOf(ed, 'E');
  assert.equal(z.kind, 'zone');
  assert.equal(z.points.length, 1);
  assert.ok(z.zone.rx > 1 && z.zone.ry > 1);
  assert.equal(z.label, 'Hook');
  ed.updateRoute(z.id, { rx: 99, label: 'Curl/flat and more' });
  assert.equal(zoneOf(ed, 'E').zone.rx, 20, 'width clamps to half the field');
  assert.equal(zoneOf(ed, 'E').label.length, 10);
  const before = zoneOf(ed, 'E').points[0];
  ed.beginGesture();
  ed.movePoint(z.id, 0, 10, 12);
  ed.endGesture();
  assert.notDeepEqual(zoneOf(ed, 'E').points[0], before);
  ed.undo();
  assert.deepEqual(zoneOf(ed, 'E').points[0], before);
  ed.deletePoint(z.id, 0);
  assert.ok(zoneOf(ed, 'E'), 'the zone centre cannot be deleted');
  ed.dragZoneEdge(z.id, 'y', 20, 14);
  assert.ok(zoneOf(ed, 'E').edited);
});

test('offence cannot take zones; defenders can still have a path route', () => {
  const ed = new Editor(newPlay());
  const q = byLabel(ed.play, 'O', 'X');
  ed.select(q.id);
  assert.equal(ed.ui.sel.kind, 'route');
  ed.setKind('zone');
  assert.equal(ed.ui.sel.kind, 'route', 'zone tab is not available to offence');
  const d = byLabel(ed.play, 'D', 'D');
  ed.setPreset(d.id, 'route', 'flat');
  ed.select(d.id);
  assert.equal(ed.ui.sel.kind, 'route', 'a defender with only a path opens on it');
  ed.setPreset(d.id, 'zone', 'z-flat');
  assert.ok(findRoute(ed.play, d.id, 'route') && findRoute(ed.play, d.id, 'zone'));
});

test('coverage buttons give every defender a zone, and follow a look change', () => {
  const ed = new Editor(newPlay());
  assert.equal(ed.applyCoverageZones('cover3'), 7);
  const zones = ed.play.routes.filter((r) => r.kind === 'zone');
  assert.equal(zones.length, 7);
  const deep = zones.filter((r) => r.preset === 'z-third').map((r) => r.points[0].x + ed.player(r.playerId).x).sort((a, b) => a - b);
  assert.equal(deep.length, 3);
  assert.ok(deep[0] < deep[1] && deep[1] < deep[2], 'three different deep thirds');
  ed.applyFormation('D', 'cover2');
  assert.equal(ed.play.routes.filter((r) => r.kind === 'zone' && r.preset === 'z-half').length, 2);
  ed.applyFormation('D', 'man');
  assert.equal(ed.play.routes.filter((r) => r.kind === 'zone').length, 0, 'man drops the zones');
  assert.equal(ed.applyCoverageZones('man'), 0);
});

test('zones: hit testing, share round trip, validation and rendering', async () => {
  const ed = new Editor(newPlay());
  ed.applyCoverageZones('cover3');
  const z = ed.play.routes.find((r) => r.preset === 'z-third');
  const c = { x: ed.player(z.playerId).x + z.points[0].x, y: ed.player(z.playerId).y + z.points[0].y };
  assert.equal(ed.hitRoute(c).rid, z.id, 'inside the ellipse selects the zone');
  assert.equal(ed.hitRoute({ x: -50, y: -50 }), null);

  const back = await decodePlay(await encodePlay(ed.play));
  const zb = back.routes.filter((r) => r.kind === 'zone');
  assert.equal(zb.length, 7);
  const same = zb.find((r) => r.preset === 'z-third');
  assert.equal(same.zone.rx, z.zone.rx);
  assert.equal(same.label, 'Deep 1/3');

  const evil = validatePlay({
    players: [{ id: 'a', side: 'O', label: 'X', x: 5, y: 0 }, { id: 'd', side: 'D', label: 'A', x: 8, y: 5 }],
    routes: [
      { playerId: 'a', kind: 'zone', points: [{ x: 1, y: 1 }], zone: { rx: 5, ry: 5 } },
      { playerId: 'd', kind: 'zone', points: [], zone: { rx: 5, ry: 5 } },
      { playerId: 'd', kind: 'zone', points: [{ x: 3, y: 9 }, { x: 4, y: 4 }], zone: { rx: 1e9, ry: -4 }, label: '<script>alert(1)</script>', preset: 'nope' },
    ],
  });
  assert.equal(evil.routes.length, 1, 'offence zone and point-less zone are dropped');
  assert.equal(evil.routes[0].points.length, 1);
  assert.equal(evil.routes[0].zone.rx, 30);
  assert.equal(evil.routes[0].zone.ry, 1.5);
  assert.equal(evil.routes[0].preset, 'custom');
  assert.ok(!svgInner(evil, { theme: 'print' }).includes('<script'), 'zone labels are escaped');

  const svg = svgInner(ed.play, { theme: 'print' });
  assert.equal((svg.match(/<ellipse/g) || []).length, 7);
  assert.ok(!svgInner(ed.play, { theme: 'print', show: 'off' }).includes('<ellipse'), 'offence only hides zones');
});

test('cropped view hugs the action and respects the cell shape', () => {
  const ed = new Editor(newPlay());
  ed.setPreset(byLabel(ed.play, 'O', 'X').id, 'route', 'post');
  const full = playToSVG(ed.play);
  const crop = playToSVG(ed.play, { crop: true, aspect: 1.4 });
  const vb = (s) => s.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const [, , fw, fh] = vb(full);
  const [, , cw, ch] = vb(crop);
  assert.ok(cw * ch < fw * fh, 'crop is smaller than the whole field');
  assert.ok(Math.abs(cw / ch - 1.4) < 0.02, 'crop matches the requested aspect');
  const v = viewFor(ed.play, { show: 'off' });
  assert.ok(v.w >= 16 && v.h >= 11);
});


// ---- print sheets ------------------------------------------------------------
test('sheet grid maths: Letter, 3 x 4, margin .4, gap .12', () => {
  const g = layoutSheet({ preset: 'letter', mode: 'grid', cols: 3, rows: 4, margin: 0.4, gap: 0.12 });
  assert.equal(g.perPage, 12);
  assert.ok(Math.abs(g.cellW - (8.5 - 0.8 - 0.24) / 3) < 0.002, `cellW ${g.cellW}`);
  assert.ok(Math.abs(g.cellH - (11 - 0.8 - 0.36) / 4) < 0.002, `cellH ${g.cellH}`);
  assert.equal(pageCount(25, g.perPage), 3);
  assert.equal(pageCount(24, g.perPage), 2);
  assert.equal(pageCount(0, g.perPage), 0);
});

test('sheet fixed-size mode fits as many plays as the page allows', () => {
  const g = layoutSheet({ preset: 'letter', mode: 'fixed', cellW: 2.4, cellH: 1.7, margin: 0.5, gap: 0.1 });
  assert.equal(g.cols, 3); // 7.5in wide: 3 x 2.4 + 2 x .1 = 7.4
  assert.equal(g.rows, 5); // 10in tall: 5 x 1.7 + 4 x .1 = 8.9 (6 would need 10.7)
  assert.equal(g.perPage, 15);
  const big = layoutSheet({ preset: 'wristband', mode: 'fixed', cellW: 30, cellH: 30, margin: 0.2 });
  assert.equal(big.perPage, 1);
  assert.ok(big.cellW <= 4.6 && big.cellH <= 2.6, 'an oversized play is shrunk to the page');
});

test('sheet layout is clamped and presets set the page size', () => {
  const l = normLayout({ preset: 'wristband', pageW: 99, margin: -3, cols: 99, rows: 0, gap: 'x', show: 'evil', unit: 'furlong' });
  assert.equal(l.pageW, 5);
  assert.equal(l.pageH, 3);
  assert.equal(l.margin, 0);
  assert.equal(l.cols, 8);
  assert.equal(l.rows, 1);
  assert.equal(l.show, 'all');
  assert.equal(l.unit, 'in');
  assert.equal(normLayout({ preset: 'nope', pageW: 7, pageH: 9 }).preset, 'custom');
  assert.equal(normLayout({ preset: 'custom', pageW: 1, pageH: 500 }).pageW, 2);
  assert.equal(normLayout({}).preset, 'letter');
  assert.equal(layoutSheet({ preset: 'custom', pageW: 2, pageH: 2, margin: 0.9 }).ok, false, 'no room is reported');
});

test('sheet pages: @page size, paging, crop, titles and numbers', () => {
  assert.equal(pageStyle({ preset: 'wristband' }), '@page{size:5in 3in;margin:0}');
  assert.equal(pageStyle({ preset: 'custom', pageW: 4.25, pageH: 5.5 }), '@page{size:4.25in 5.5in;margin:0}');
  const plays = [];
  for (let i = 0; i < 5; i++) {
    const p = newPlay(`Play <${i}>`);
    plays.push(p);
  }
  const html = sheetHTML(plays, { preset: 'letter', mode: 'grid', cols: 2, rows: 1, numbers: true, title: true });
  assert.equal((html.match(/class="sheet-page"/g) || []).length, 3, '5 plays at 2 per page is 3 pages');
  assert.equal((html.match(/class="cell/g) || []).length, 5);
  assert.ok(html.includes('1. Play &lt;0&gt;') && html.includes('5. Play &lt;4&gt;'), 'numbered and escaped titles');
  assert.ok(!html.includes('<0>'), 'names are escaped');
  const bare = sheetHTML(plays.slice(0, 1), { numbers: false, title: false, border: false });
  assert.ok(!bare.includes('>Play &lt;0&gt;</text>') && !bare.includes('bordered'), 'no title text, no border');
  const nums = sheetHTML(plays.slice(0, 1), { numbers: true, title: false });
  assert.ok(nums.includes('>1</text>'), 'number-only chip');
  const vbw = (h) => Number(h.match(/viewBox="[^ ]+ [^ ]+ ([^ ]+)/)[1]);
  assert.ok(vbw(sheetHTML(plays.slice(0, 1), { crop: true })) < vbw(sheetHTML(plays.slice(0, 1), { crop: false })), 'crop zooms in');
  const defOnly = sheetHTML(plays.slice(0, 1), { show: 'def' });
  assert.ok(defOnly.includes('DEFENSE'));
});

test('saved sheets validate, and units convert both ways', () => {
  const s = validateSheet({ id: 'zz', name: 'x'.repeat(200), plays: ['a', 5, 'b', null], layout: { cols: 4 } });
  assert.equal(s.name.length, 60);
  assert.deepEqual(s.plays, ['a', 'b']);
  assert.equal(s.layout.cols, 4);
  assert.throws(() => validateSheet(null));
  assert.equal(newSheet('A', ['q']).plays[0], 'q');
  assert.equal(toUnit(2.54, 'cm'), 6.45);
  assert.ok(Math.abs(fromUnit(10, 'cm') - 3.937) < 0.001);
});
