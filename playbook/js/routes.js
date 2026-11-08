// Route library. Every preset builds a list of points relative to the player
// (x = yards sideways, y = yards downfield). `o` is the "outside" direction
// (+1 right, -1 left) and the inside direction is -o.

const r1 = (v) => {
  const x = Math.round(v * 10) / 10;
  return x === 0 ? 0 : x;
};

function p(id, num, name, group, depth, length, uses, build, curve = false) {
  return { id, num, name, group, depth, length, uses, build, curve };
}

export const GROUPS = [
  { id: 'tree', name: 'Route tree' },
  { id: 'extras', name: 'More routes' },
  { id: 'double', name: 'Double moves' },
  { id: 'backs', name: 'Backfield' },
];

// The numbers 1-9 follow the common route-tree convention. Teams number their
// trees differently, so treat `num` as a default label only.
export const PRESETS = [
  p('flat', 1, 'Flat', 'tree', 1, 7, ['depth', 'length'], (d, l, o) => [[o * l, d]]),
  p('slant', 2, 'Slant', 'tree', 2, 5, ['depth', 'length'], (d, l, o) => [[0, d], [-o * l, d + l]]),
  p('comeback', 3, 'Comeback', 'tree', 12, 3, ['depth', 'length'], (d, l, o) => [[0, d], [o * l * 0.8, d - l]]),
  p('curl', 4, 'Curl', 'tree', 10, 2.5, ['depth', 'length'], (d, l, o) => [[0, d], [-o * 1, d - l]]),
  p('out', 5, 'Out', 'tree', 8, 7, ['depth', 'length'], (d, l, o) => [[0, d], [o * l, d]]),
  p('dig', 6, 'Dig (in)', 'tree', 10, 10, ['depth', 'length'], (d, l, o) => [[0, d], [-o * l, d]]),
  p('corner', 7, 'Corner', 'tree', 10, 8, ['depth', 'length'], (d, l, o) => [[0, d], [o * l, d + l]]),
  p('post', 8, 'Post', 'tree', 10, 8, ['depth', 'length'], (d, l, o) => [[0, d], [-o * l, d + l]]),
  p('go', 9, 'Go', 'tree', 20, 0, ['depth'], (d) => [[0, d]]),

  p('seam', null, 'Seam', 'extras', 16, 0, ['depth'], (d) => [[0, d]]),
  p('drag', null, 'Drag', 'extras', 2, 14, ['depth', 'length'], (d, l, o) => [[0, d], [-o * l, d]]),
  p('hitch', null, 'Hitch', 'extras', 6, 0, ['depth'], (d, l, o) => [[0, d], [-o * 0.4, d - 1.5]]),
  p('fade', null, 'Fade', 'extras', 18, 4, ['depth', 'length'], (d, l, o) => [[o * l, d]]),

  p('stopgo', null, 'Stop & go', 'double', 8, 12, ['depth', 'length'], (d, l, o) => [[0, d], [o * 0.8, d - 1.5], [o * 0.8, d + l]]),
  p('sluggo', null, 'Sluggo', 'double', 2, 14, ['depth', 'length'], (d, l, o) => [[0, d], [-o * 4, d + 4], [-o * 5, d + l + 4]]),
  p('outup', null, 'Out & up', 'double', 8, 12, ['depth', 'length'], (d, l, o) => [[0, d], [o * 3, d], [o * 3, d + l]]),

  p('swing', null, 'Swing', 'backs', 4, 8, ['depth', 'length'], (d, l, o) => [[o * l * 0.5, -1], [o * l, 1], [o * (l + 1), d]], true),
  p('wheel', null, 'Wheel', 'backs', 18, 7, ['depth', 'length'], (d, l, o) => [[o * l * 0.6, 1], [o * l, 4], [o * l, d]], true),
  p('angle', null, 'Angle', 'backs', 4, 5, ['depth', 'length'], (d, l, o) => [[o * 2, 1], [-o * (l - 2), d]]),
];

export const PRESET_MAP = Object.fromEntries(PRESETS.map((x) => [x.id, x]));

export function defaultsFor(id) {
  const pr = PRESET_MAP[id];
  return pr ? { depth: pr.depth, length: pr.length, curve: pr.curve } : { depth: 0, length: 0, curve: false };
}

export function generatePoints(id, depth, length, out) {
  const pr = PRESET_MAP[id];
  if (!pr) return [];
  const o = out < 0 ? -1 : 1;
  return pr.build(depth, length, o).map(([x, y]) => ({ x: r1(x), y: r1(y) }));
}

// Which way is "outside" for a player at x? Away from the center of the field.
// `flip` swaps it for routes the coach wants run the other way.
export function outSign(playerX, fieldWidth, flip = false) {
  const dx = playerX - fieldWidth / 2;
  const s = Math.abs(dx) < 0.01 ? 1 : dx < 0 ? -1 : 1;
  return flip ? -s : s;
}
