import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTRIES, playFor, freshCopy, mixInto, searchEntries, notesFor } from '../js/library.js';
import { newPlay } from '../js/model.js';
import { Editor } from '../js/state.js';
import { encodePlay, decodePlay } from '../js/share.js';
import { playToSVG } from '../js/render.js';

test('every library entry builds, stays on the field and renders', () => {
  for (const e of ENTRIES) {
    const p = playFor(e.id);
    assert.ok(p, e.id);
    const { width, length, backfield } = p.field;
    for (const pl of p.players) {
      assert.ok(pl.x >= 0 && pl.x <= width && pl.y >= -backfield && pl.y <= length - backfield, `${e.id} ${pl.label} in field`);
    }
    assert.ok(p.routes.length > 0, `${e.id} has routes`);
    assert.ok(notesFor(e).length <= 800, `${e.id} notes`);
    assert.match(playToSVG(p, { theme: 'print', crop: true }), /^<svg/);
    assert.ok(playFor(e.id, { flip: true }), `${e.id} flips`);
  }
});

test('playbook has 12 seven-player offense plays and 4 defense patterns', () => {
  const off = searchEntries({ collection: 'playbook', category: 'Offense' });
  const def = searchEntries({ collection: 'playbook', category: 'Defense' });
  assert.equal(off.length, 12);
  assert.equal(def.length, 4);
  for (const e of off) {
    const p = playFor(e.id);
    assert.deepEqual(p.players.filter((x) => x.side === 'O').map((x) => x.label).sort(), ['C', 'F', 'H', 'Q', 'X', 'Y', 'Z']);
  }
  for (const e of def) {
    const p = playFor(e.id);
    assert.equal(p.players.filter((x) => x.side === 'D').length, 7);
  }
});

test('concepts are partial plays', () => {
  const c = searchEntries({ collection: 'concepts' });
  assert.ok(c.length >= 20);
  assert.ok(playFor('c-smash').players.filter((x) => x.side === 'O').length < 7);
});

test('freshCopy gives new ids and survives a share link round trip', async () => {
  const a = freshCopy('p-01');
  const b = freshCopy('p-01');
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.players[0].id, b.players[0].id);
  const back = await decodePlay(await encodePlay(a));
  assert.equal(back.routes.length, a.routes.length);
});

test('mixInto copies only the chosen half and parts', () => {
  const ed = new Editor(newPlay('mix'));
  const res = mixInto(ed, playFor('c-smash'), { half: 'right', parts: 'off' });
  assert.ok(res.applied >= 2);
  assert.equal(ed.play.routes.filter((r) => r.kind === 'zone').length, 0);
  ed.undo();
  assert.equal(ed.play.routes.length, 0);
});
