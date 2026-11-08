// Formation presets for 7v7 flag. Offsets are yards from the center of the
// field (x) and from the line of scrimmage (y; negative = backfield).
// Everything is scaled down automatically when the field is narrow.

export const OFFENSE_LABELS = ['Q', 'C', 'X', 'Y', 'Z', 'H', 'F'];
export const DEFENSE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const r1 = (v) => {
  const x = Math.round(v * 10) / 10;
  return x === 0 ? 0 : x;
};

// [label, dx, y]
const OFFENSE = {
  '2x2': {
    name: '2x2 (two receivers each side)',
    p: [['Q', 0, -5], ['C', 0, 0], ['X', -14, 0], ['Y', -7, -1], ['H', 7, -1], ['Z', 14, 0], ['F', 3, -5]],
  },
  'trips-r': {
    name: 'Trips right (3x1)',
    p: [['Q', 0, -5], ['C', 0, 0], ['X', -14, 0], ['Y', 5, -1], ['H', 9.5, -1], ['Z', 14, 0], ['F', -3, -5]],
  },
  'bunch-r': {
    name: 'Bunch right',
    p: [['Q', 0, -5], ['C', 0, 0], ['X', -14, 0], ['Y', 10, 0], ['H', 12.2, -1.2], ['Z', 10, -2.4], ['F', -3, -5]],
  },
  empty: {
    name: 'Empty (3x2, no back)',
    p: [['Q', 0, -5], ['C', 0, 0], ['X', -14, 0], ['Y', -7, -1], ['H', 5.5, -1], ['F', 9.5, -1], ['Z', 14, 0]],
  },
};

const DEFENSE = {
  cover3: {
    name: 'Cover 3 look (3 deep, 4 under)',
    p: [['A', -11, 11], ['B', 0, 13], ['C', 11, 11], ['D', -12.5, 5], ['E', -4.5, 5], ['F', 4.5, 5], ['G', 12.5, 5]],
  },
  cover2: {
    name: 'Cover 2 look (2 deep, 5 under)',
    p: [['A', -8, 12], ['B', 8, 12], ['C', -14, 5], ['D', -7, 5], ['E', 0, 5], ['F', 7, 5], ['G', 14, 5]],
  },
  cover4: {
    name: 'Cover 4 look (4 deep, 3 under)',
    p: [['A', -13, 11], ['B', -4.5, 12], ['C', 4.5, 12], ['D', 13, 11], ['E', -8, 5], ['F', 0, 5], ['G', 8, 5]],
  },
  man: { name: 'Man (follows the receivers)', p: null },
};

export const OFFENSE_FORMATIONS = [
  { id: '2x2', name: OFFENSE['2x2'].name },
  { id: 'trips-r', name: OFFENSE['trips-r'].name },
  { id: 'trips-l', name: 'Trips left (3x1)' },
  { id: 'bunch-r', name: OFFENSE['bunch-r'].name },
  { id: 'bunch-l', name: 'Bunch left' },
  { id: 'empty', name: OFFENSE.empty.name },
];

export const DEFENSE_FORMATIONS = Object.entries(DEFENSE).map(([id, d]) => ({ id, name: d.name }));

function place(list, field, mirror) {
  const cx = field.width / 2;
  const maxDx = Math.max(1, ...list.map(([, dx]) => Math.abs(dx)));
  const k = Math.min(1, (field.width / 2 - 2) / maxDx);
  const yMax = field.length - field.backfield - 1;
  const yMin = -(field.backfield - 1.5);
  return list.map(([label, dx, y]) => ({
    label,
    x: r1(cx + (mirror ? -dx : dx) * k),
    y: r1(Math.max(yMin, Math.min(yMax, y))),
  }));
}

function manDefense(field, offense) {
  const cx = field.width / 2;
  const recv = offense
    .filter((p) => !(Math.abs(p.x - cx) < 1.5 && p.y > -6.5)) // skip center and QB
    .sort((a, b) => a.x - b.x)
    .slice(0, DEFENSE_LABELS.length);
  const out = recv.map((p, i) => ({
    label: DEFENSE_LABELS[i],
    x: r1(p.x),
    y: p.y < -2 ? 4 : 1.5,
  }));
  const extras = [[0, 13], [0, 7], [-6, 9], [6, 9], [-10, 12], [10, 12]];
  for (let i = out.length, j = 0; i < DEFENSE_LABELS.length; i++, j++) {
    const [dx, y] = extras[j % extras.length];
    out.push({ label: DEFENSE_LABELS[i], x: r1(cx + dx), y });
  }
  const yMax = field.length - field.backfield - 1;
  return out.map((p) => ({ ...p, y: Math.min(p.y, yMax) }));
}

// Returns [{label, x, y}] for one side. `offense` (existing offense players)
// is only needed for the man-coverage preset.
export function formationPlayers(side, id, field, offense = []) {
  if (side === 'O') {
    let def = OFFENSE[id];
    let mirror = false;
    if (!def && id.endsWith('-l') && OFFENSE[id.slice(0, -2) + '-r']) {
      def = OFFENSE[id.slice(0, -2) + '-r'];
      mirror = true;
    }
    if (!def) def = OFFENSE['2x2'];
    return place(def.p, field, mirror);
  }
  if (id === 'man') return manDefense(field, offense);
  const def = DEFENSE[id] && DEFENSE[id].p ? DEFENSE[id] : DEFENSE.cover3;
  return place(def.p, field, false);
}
