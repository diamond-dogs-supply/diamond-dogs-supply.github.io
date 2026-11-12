// Library content. Coordinates: "dx" is yards from the middle of the field
// (right is +), y is yards from the line of scrimmage (negative = backfield).
// Route tuples are [position label, preset, options]; options are depth,
// length, flip, curve, dash, end, color, order (the read number), or for
// preset 'pts' a list of [x, y] points relative to the start of the route.
// Defender tuples are [label, dx, y, zone preset, zone label, {c:[dx,y], rx, ry}].
//
// Concept diagrams are drawn to the right side. Flip them to the left in the
// library, or mix a right-side piece into one side of a play you are building.
//
// Sources for the concept list and the read orders: the 7v7 pass-concept and
// coverage-beater write-ups on Youth Football Online and the FirstDown PlayBook
// coaches community, plus the standard 1-9 route tree. Depths are tuned for a
// 40 x 35 yard field; presets rescale with the field.

export const CATEGORIES = [
  'Quick game',
  'High-low reads',
  'Crossing routes',
  'Deep shots',
  'Bunch and trips',
  'Backfield and motion',
  'Defensive pieces',
  'Offense',
  'Defense',
];

const C = 'concept';

export const ENTRIES = [
  // ======================= CONCEPTS: quick game =======================
  {
    id: 'c-smash', kind: C, cat: 'Quick game', name: 'Smash (hitch and corner)',
    short: 'A short hitch under a corner route: a high-low read on the flat defender.',
    points: [
      'Read high to low: corner first, then the hitch.',
      'If the flat defender sinks to the hitch, throw the corner. If he sits on the corner, throw the hitch.',
      'The hitch settles at 5-6 yards and turns to the QB. The corner stems 10 and breaks to the pylon.',
    ],
    beats: ['Cover 2', 'Zone'],
    off: '2x2', show: ['H', 'Z'], flipLabels: true,
    routes: [['H', 'corner', { depth: 10, length: 8, order: 1 }], ['Z', 'hitch', { depth: 6, order: 2 }]],
    def: [['G', 14, 5, 'z-flat', 'Flat'], ['B', 8, 12, 'z-half', 'Safety']],
  },
  {
    id: 'c-curl-flat', kind: C, cat: 'Quick game', name: 'Curl-Flat',
    short: 'The outside receiver curls and the slot runs to the flat: two levels on the same defender.',
    points: [
      'Read the curl-flat defender. If he stays under the curl, throw the flat. If he runs to the flat, throw the curl.',
      'Cheat the outside receiver out a yard so the curl has room to turn back inside.',
    ],
    beats: ['Cover 3', 'Zone'],
    off: '2x2', show: ['H', 'Z'], at: { Z: [15.5, 0] }, flipLabels: true,
    routes: [['Z', 'curl', { depth: 10, order: 1 }], ['H', 'flat', { depth: 1, length: 5, order: 2 }]],
    def: [['G', 14, 6, 'z-hook', 'Curl/flat', { c: [13, 7.5], rx: 5, ry: 4 }]],
  },
  {
    id: 'c-snag', kind: C, cat: 'Quick game', name: 'Snag (flat, snag, corner)',
    short: 'Three receivers at three levels on one side: a swing to the flat, a snag at 5 yards, and a corner.',
    points: [
      'Read flat, then snag, then corner.',
      'The snag receiver sits down in the gap between the flat and the deep defender, and turns to the QB.',
      'Two defenders cannot cover three receivers; the one who jumps decides who is open.',
    ],
    beats: ['Cover 3', 'Zone', 'Man'],
    off: '2x2', show: ['H', 'Z', 'F'], flipLabels: true,
    routes: [['F', 'swing', { order: 1 }], ['H', 'hitch', { depth: 5, order: 2 }], ['Z', 'corner', { depth: 8, length: 8, order: 3 }]],
    def: [['G', 14, 5, 'z-flat', 'Flat'], ['B', 8, 12, 'z-half', 'Safety']],
  },
  {
    id: 'c-stick', kind: C, cat: 'Quick game', name: 'Stick (stick, flat, nod)',
    short: 'The slot sits at 5 yards between the hook and flat defenders while the outside receiver threatens deep.',
    points: [
      'Read the defender over the slot. If he widens to the flat, throw the stick. If he stays inside, throw the flat.',
      'The outside receiver runs a go (the nod) to hold the corner deep.',
    ],
    beats: ['Cover 3', 'Zone', 'Man'],
    off: '2x2', show: ['H', 'Z', 'F'], flipLabels: true,
    routes: [['H', 'hitch', { depth: 5, order: 1 }], ['F', 'swing', { order: 2 }], ['Z', 'go', { depth: 20, order: 3 }]],
    def: [['F', 8, 5, 'z-hook', 'Hook', { c: [8, 7], rx: 4.5, ry: 3.4 }], ['G', 14, 5, 'z-flat', 'Flat']],
  },
  {
    id: 'c-slant-flat', kind: C, cat: 'Quick game', name: 'Slant-Flat',
    short: 'A quick slant with a flat underneath and a go to clear the corner. A catch-and-throw against man.',
    points: [
      'Throw the slant first. If the slot defender sits inside, the flat is the check.',
      'The outside receiver runs a go so the corner cannot help inside.',
    ],
    beats: ['Man', 'Cover 1', 'Cover 3'],
    off: '2x2', show: ['H', 'Z', 'F'], flipLabels: true,
    routes: [['H', 'slant', { depth: 2, length: 5, order: 1 }], ['F', 'flat', { depth: 1, length: 7, order: 2 }], ['Z', 'go', { depth: 20 }]],
  },

  // ======================= CONCEPTS: high-low =======================
  {
    id: 'c-out-flat', kind: C, cat: 'High-low reads', name: 'Out-Flat (high-low on the flat defender)',
    short: 'An out route over a flat route, with a go to hold the corner: a clean two-level read.',
    points: [
      'Watch the flat defender. If he drops to the out, throw the flat. If he jumps the flat, throw the out.',
      'The go route is the clear-out: it pulls the deep defender away from the out.',
    ],
    beats: ['Cover 3', 'Zone'],
    off: '2x2', show: ['H', 'Z', 'F'], flipLabels: true,
    routes: [['H', 'out', { depth: 8, length: 6, order: 1 }], ['F', 'flat', { depth: 1, length: 7, order: 2 }], ['Z', 'go', { depth: 20 }]],
    def: [['G', 14, 5, 'z-flat', 'Flat']],
  },
  {
    id: 'c-drive', kind: C, cat: 'High-low reads', name: 'Drive (dig over a shallow cross)',
    short: 'A deep dig with a shallow cross underneath: a high-low read on the hook defender.',
    points: [
      'If the hook defender sinks to the dig, throw the shallow. If he stays shallow, throw the dig.',
      'The shallow runner crosses at 2 yards and keeps his head up for the ball.',
      'Against man, the crossers are moving in front of the QB and can pick off defenders.',
    ],
    beats: ['Cover 4', 'Man', 'Zone'],
    off: '2x2', show: ['H', 'Z', 'F'], flipLabels: true,
    routes: [['Z', 'dig', { depth: 12, length: 10, order: 1 }], ['H', 'drag', { depth: 2, length: 10, order: 2 }], ['F', 'swing', { order: 3 }]],
    def: [['E', 0, 5, 'z-hook', 'Hook']],
  },

  // ======================= CONCEPTS: crossing =======================
  {
    id: 'c-mesh', kind: C, cat: 'Crossing routes', name: 'Mesh',
    short: 'Two receivers cross at different depths in the middle while the outsiders run deep and a back wheels.',
    points: [
      'Read wheel first, then the deeper cross, then the shallow cross.',
      'Cross at different depths and keep your heads up; do not run into each other or into a defender.',
      'The outside receivers must clear the corners so nobody can drop into the crossers.',
    ],
    beats: ['Man', 'Cover 2'],
    off: '2x2', show: ['X', 'Y', 'H', 'Z', 'F'],
    routes: [
      ['F', 'wheel', { order: 1 }], ['H', 'drag', { depth: 6, length: 14, order: 2 }], ['Y', 'drag', { depth: 2, length: 14, order: 3 }],
      ['X', 'go', { depth: 20 }], ['Z', 'go', { depth: 20 }],
    ],
  },

  // ======================= CONCEPTS: deep shots =======================
  {
    id: 'c-four-verts', kind: C, cat: 'Deep shots', name: 'Four Verticals',
    short: 'Everyone goes deep. The seams attack the middle of the field and the outsiders stretch the sidelines.',
    points: [
      'Read the safety. If he stays in the middle, throw outside. If he goes outside, throw the seam.',
      'Seams run straight up their lane and split the safeties. Outside receivers take the corners deep.',
      'The back is the hot outlet underneath if the rusher gets home.',
    ],
    beats: ['Cover 3', 'Cover 2', 'Man'],
    off: '2x2', show: ['X', 'Y', 'H', 'Z', 'F'],
    routes: [
      ['H', 'seam', { depth: 17, order: 1 }], ['Y', 'seam', { depth: 17, order: 2 }], ['Z', 'go', { depth: 22, order: 3 }], ['X', 'go', { depth: 22, order: 4 }],
      ['F', 'swing', { order: 5 }],
    ],
  },
  {
    id: 'c-flood', kind: C, cat: 'Deep shots', name: 'Flood (corner, out, flat)',
    short: 'Three receivers in three levels on one side overload the two defenders who must cover them.',
    points: [
      'Read high to low: corner, then out, then the flat.',
      'The deep third defender takes the corner; the flat defender takes the flat; the out is usually open between them.',
      'Cheat the splits in a yard to give the out room.',
    ],
    beats: ['Cover 3', 'Zone'],
    off: '2x2', show: ['H', 'Z', 'F'], flipLabels: true,
    routes: [['Z', 'corner', { depth: 8, length: 8, order: 1 }], ['H', 'out', { depth: 6, length: 6, order: 2 }], ['F', 'swing', { order: 3 }]],
    def: [['C', 11, 11, 'z-third', 'Deep 1/3'], ['G', 14, 5, 'z-flat', 'Flat']],
  },
  {
    id: 'c-scissors', kind: C, cat: 'Deep shots', name: 'Scissors (post-corner)',
    short: 'A post and a corner cross each other behind a single safety, with a swing to hold the flat.',
    points: [
      'Read the safety. If he sits on the post, throw the corner. If he takes the corner, throw the post.',
      'The swing holds the flat defender so he cannot carry the corner.',
      'Stagger the breaks so the post crosses in front of the corner, not into him.',
    ],
    beats: ['Cover 2', 'Zone'],
    off: '2x2', show: ['H', 'Z', 'F'], flipLabels: true,
    routes: [['H', 'corner', { depth: 8, length: 8, order: 1 }], ['Z', 'post', { depth: 12, length: 8, order: 2 }], ['F', 'swing', { order: 3 }]],
    def: [['B', 8, 12, 'z-half', 'Safety'], ['G', 14, 5, 'z-flat', 'Flat']],
  },

  // ======================= CONCEPTS: bunch and trips =======================
  {
    id: 'c-bunch-layers', kind: C, cat: 'Bunch and trips', name: 'Bunch layers (flat, out, corner)',
    short: 'Three receivers start close together and break away at three depths. Bunch alignments free them from the press.',
    points: [
      'Read deep to shallow: corner, out, flat.',
      'The back receiver releases up the lane behind the front man; nobody crosses the front man\'s path.',
      'Great against man: the defenders have to fight through the traffic.',
    ],
    beats: ['Man', 'Zone', 'Cover 3'],
    off: 'bunch-r', show: ['Y', 'H', 'Z'], flipLabels: false,
    routes: [['Z', 'corner', { depth: 11, length: 7, order: 1 }], ['Y', 'out', { depth: 6, length: 6, order: 2 }], ['H', 'flat', { depth: 1, length: 6, order: 3 }]],
    def: [['C', 11, 11, 'z-third', 'Deep 1/3'], ['G', 14, 5, 'z-flat', 'Flat']],
  },
  {
    id: 'c-post-wheel', kind: C, cat: 'Bunch and trips', name: 'Bunch post-wheel-slant',
    short: 'From a bunch, the outside man wheels, the front man runs a post and the back man runs a trail slant.',
    points: [
      'The wheel is often open if the defender turns his hips with the post. Read wheel, then post, then slant.',
      'The slant trails behind the others, underneath the zone.',
      'Run the wheel and post a few times, then call the post-slant to punish defenders who start to turn and run.',
    ],
    beats: ['Man', 'Cover 3'],
    off: 'bunch-r', show: ['Y', 'H', 'Z'],
    routes: [['H', 'wheel', { depth: 18, length: 7, order: 1 }], ['Y', 'post', { depth: 10, length: 8, order: 2 }], ['Z', 'slant', { depth: 2, length: 5, order: 3 }]],
  },
  {
    id: 'c-trips-flood', kind: C, cat: 'Bunch and trips', name: 'Trips flood with seam',
    short: 'Three receivers to one side: a seam to hold the middle, a corner and an out.',
    points: [
      'The seam keeps the safety in the middle so he cannot rotate to the corner.',
      'Read corner, then out. The out is the safe, high-percentage throw.',
    ],
    beats: ['Cover 3', 'Zone'],
    off: 'trips-r', show: ['Y', 'H', 'Z'],
    routes: [['Z', 'corner', { depth: 9, length: 8, order: 1 }], ['H', 'out', { depth: 6, length: 6, order: 2 }], ['Y', 'seam', { depth: 16 }]],
    def: [['C', 11, 11, 'z-third', 'Deep 1/3'], ['G', 14, 5, 'z-flat', 'Flat']],
  },

  // ======================= CONCEPTS: backfield and motion =======================
  {
    id: 'c-bubble', kind: C, cat: 'Backfield and motion', name: 'Bubble screen',
    short: 'The slot catches a quick pass behind the line with a deep route pulling the corner away.',
    points: [
      'A one-step throw. The slot receiver turns up the sideline right away.',
      'The outside receiver runs a go so the corner has to respect the deep ball.',
      'Check your league: some do not allow downfield screening, so the go route is the legal way to clear the corner.',
    ],
    beats: ['Cover 3', 'Zone', 'Blitz'],
    off: '2x2', show: ['H', 'Z'], flipLabels: true,
    routes: [['H', 'pts', { pts: [[2, -1.5], [6, -1]], order: 1 }], ['Z', 'go', { depth: 20, order: 2 }]],
    def: [['G', 14, 5, 'z-flat', 'Flat']],
  },
  {
    id: 'c-jet', kind: C, cat: 'Backfield and motion', name: 'Jet sweep motion',
    short: 'A receiver motions across before the snap and runs the sweep route around the edge.',
    points: [
      'The motion (dashed) is before the snap; the sweep route (solid) starts where the motion ends.',
      'Check your league rules on handoffs and laterals before you install it.',
      'Run it a few times, then throw the deep route off the same look.',
    ],
    beats: ['Zone', 'Cover 3'],
    off: '2x2', show: ['Q', 'Y'], flipLabels: false,
    routes: [
      ['Y', 'pts', { kind: 'motion', pts: [[3, -3], [7, -4], [10, -4]], end: 'arrow' }],
      ['Y', 'pts', { pts: [[3, 0], [9, 1], [13, 4]], order: 1 }],
    ],
  },

  // ======================= CONCEPTS: defensive pieces =======================
  {
    id: 'd-thirds', kind: C, cat: 'Defensive pieces', name: 'Three deep thirds',
    short: 'Three defenders split the deep field into thirds: Cover 3.',
    points: ['The two outside defenders cover the sideline thirds and the middle defender covers the middle third.', 'They keep everything in front of them and run with anything vertical.'],
    beats: ['Cover 3'],
    defForm: 'cover3', defShow: ['A', 'B', 'C'], cov: 'cover3',
  },
  {
    id: 'd-halves', kind: C, cat: 'Defensive pieces', name: 'Two deep halves',
    short: 'Two safeties split the deep field into halves: Cover 2.',
    points: ['Each safety is responsible for his half of the field from the hash to the sideline.', 'The weak spot is the deep middle between them and the corner area.'],
    beats: ['Cover 2'],
    defForm: 'cover2', defShow: ['A', 'B'], cov: 'cover2',
  },
  {
    id: 'd-quarters', kind: C, cat: 'Defensive pieces', name: 'Four deep quarters',
    short: 'Four defenders each take a quarter of the deep field: Cover 4.',
    points: ['Good against deep throws. Weak underneath, since only three defenders are left for the short zones.', 'The quarters defenders play man on a receiver who comes into their zone.'],
    beats: ['Cover 4'],
    defForm: 'cover4', defShow: ['A', 'B', 'C', 'D'], cov: 'cover4',
  },
  {
    id: 'd-under', kind: C, cat: 'Defensive pieces', name: 'Underneath zones (hooks and flats)',
    short: 'Four underneath defenders: two hooks in the middle and two flats on the sidelines.',
    points: ['The flat defenders squat on routes to the sideline. The hook defenders sink to dig and curl routes.', 'These fit under three deep defenders in Cover 3.'],
    beats: ['Cover 3'],
    defForm: 'cover3', defShow: ['D', 'E', 'F', 'G'], cov: 'cover3',
  },
  {
    id: 'd-rusher', kind: C, cat: 'Defensive pieces', name: 'Rusher and QB spy',
    short: 'One defender rushes the passer. Another drops into the middle to watch the quarterback.',
    points: ['Check the rush rules: many leagues allow one rusher from 5 to 7 yards, after a count.', 'The spy takes away the QB run and breaks on short crossing routes.'],
    beats: ['Blitz'],
    off: '2x2', show: ['Q', 'C'],
    def: [['G', 0, 7, null], ['E', 0, 4, 'z-hook', 'Spy', { c: [0, 4.5], rx: 3.5, ry: 3 }]],
    droutes: [['G', 'pts', { pts: [[0, -11.5]], end: 'arrow' }]],
  },

  // ======================= DIAMOND DAWGS PLAYBOOK: offense =======================
  {
    id: 'p-01', num: 1, kind: 'play', cat: 'Offense', name: 'Smash',
    short: 'Quick high-low on the right. Hitch and corner, with the backside clearing and a safe throw underneath.',
    points: [
      'Formation 2x2. Right side: H corner (1), Z hitch (2).',
      'Backside: Y hitch (3) is the quick throw, X goes deep to clear. F swings out of the backfield (4).',
      'Q reads the flat defender: sinks, throw the corner; squats on the corner, hit the hitch.',
    ],
    beats: ['Cover 2', 'Zone'],
    off: '2x2',
    routes: [
      ['H', 'corner', { depth: 10, length: 8, order: 1 }], ['Z', 'hitch', { depth: 6, order: 2 }], ['Y', 'hitch', { depth: 5, order: 3 }],
      ['X', 'go', { depth: 20 }], ['F', 'swing', { order: 4 }],
    ],
  },
  {
    id: 'p-02', num: 2, kind: 'play', cat: 'Offense', name: 'Four Dawgs',
    short: 'Empty formation, everyone vertical. The shot play. Five receivers stretch the field.',
    points: [
      'Formation empty. X and Z go, Y and H run the seams, F sits at 5 yards as the outlet.',
      'Read the safety: stays in the middle, throw outside; runs outside, throw the seam. Hit F if the rusher comes.',
      'Needs a QB who can throw 25 yards on time.',
    ],
    beats: ['Cover 3', 'Cover 2', 'Man'],
    off: 'empty',
    routes: [
      ['H', 'seam', { depth: 17, order: 1 }], ['Y', 'seam', { depth: 17, order: 2 }], ['Z', 'go', { depth: 22, order: 3 }], ['X', 'go', { depth: 22, order: 4 }],
      ['F', 'hitch', { depth: 5, order: 5 }],
    ],
  },
  {
    id: 'p-03', num: 3, kind: 'play', cat: 'Offense', name: 'Mesh',
    short: 'Two crossers in the middle at different depths, a wheel to the right, and both outsiders going deep.',
    points: [
      'Formation 2x2. Y drags at 2 yards, H crosses at 6. F wheels to the right.',
      'Read wheel (1), deep cross (2), shallow cross (3). The crossers keep their heads up and do not collide.',
      'X and Z must clear the corners or the cross gets jammed.',
    ],
    beats: ['Man', 'Cover 2'],
    off: '2x2',
    routes: [
      ['F', 'wheel', { order: 1 }], ['H', 'drag', { depth: 6, length: 14, order: 2 }], ['Y', 'drag', { depth: 2, length: 14, order: 3 }],
      ['X', 'go', { depth: 20 }], ['Z', 'go', { depth: 20 }],
    ],
  },
  {
    id: 'p-04', num: 4, kind: 'play', cat: 'Offense', name: 'Flood',
    short: 'Trips right. Corner, out and flat overload the right side; a seam holds the safety.',
    points: [
      'Formation trips right. Z corner (1), H out (2), Y seam. F swings left as the hot throw (4).',
      'Backside X runs a slant (3) as a man-beater.',
      'Cheat the receivers in a yard so the out has room. Read high to low.',
    ],
    beats: ['Cover 3', 'Zone'],
    off: 'trips-r',
    routes: [
      ['Z', 'corner', { depth: 9, length: 8, order: 1 }], ['H', 'out', { depth: 6, length: 6, order: 2 }], ['Y', 'seam', { depth: 16 }],
      ['X', 'slant', { depth: 2, length: 5, order: 3 }], ['F', 'swing', { order: 4 }],
    ],
  },
  {
    id: 'p-05', num: 5, kind: 'play', cat: 'Offense', name: 'Scissors',
    short: 'Post and corner cross on the right to put one safety in a bind. A cross underneath adds a hot answer.',
    points: [
      'Formation 2x2. H corner (1), Z post (2), F swing (3).',
      'Backside Y drags across at 2 yards, X goes deep to hold the corner.',
      'The safety decides: on the post, throw the corner; on the corner, throw the post.',
    ],
    beats: ['Cover 2', 'Zone'],
    off: '2x2',
    routes: [
      ['H', 'corner', { depth: 8, length: 8, order: 1 }], ['Z', 'post', { depth: 12, length: 8, order: 2 }], ['F', 'swing', { order: 3 }],
      ['Y', 'drag', { depth: 2, length: 10 }], ['X', 'go', { depth: 20 }],
    ],
  },
  {
    id: 'p-06', num: 6, kind: 'play', cat: 'Offense', name: 'Snag',
    short: 'Three levels on the right: swing, snag, corner. Backside slant as the man-beater.',
    points: [
      'Formation 2x2. Read F swing (1), H snag at 5 (2), Z corner (3).',
      'Backside Y slants (4); X goes deep.',
      'H settles in the open space and turns to the QB.',
    ],
    beats: ['Cover 3', 'Zone', 'Man'],
    off: '2x2',
    routes: [
      ['F', 'swing', { order: 1 }], ['H', 'hitch', { depth: 5, order: 2 }], ['Z', 'corner', { depth: 8, length: 8, order: 3 }],
      ['Y', 'slant', { depth: 2, length: 5, order: 4 }], ['X', 'go', { depth: 20 }],
    ],
  },
  {
    id: 'p-07', num: 7, kind: 'play', cat: 'Offense', name: 'Drive',
    short: 'A dig over a shallow cross: the high-low read on the middle defender. Great against four deep.',
    points: [
      'Formation 2x2. Z dig at 12 (1), H shallow cross at 2 (2), F swing (3).',
      'Backside X runs a post and Y a curl.',
      'If the hook defender sinks, throw the shallow; if he stays shallow, throw the dig.',
    ],
    beats: ['Cover 4', 'Man', 'Zone'],
    off: '2x2',
    routes: [
      ['Z', 'dig', { depth: 12, length: 10, order: 1 }], ['H', 'drag', { depth: 2, length: 10, order: 2 }], ['F', 'swing', { order: 3 }],
      ['X', 'post', { depth: 10, length: 8 }], ['Y', 'curl', { depth: 10, order: 4 }],
    ],
  },
  {
    id: 'p-08', num: 8, kind: 'play', cat: 'Offense', name: 'Stick',
    short: 'A quick stick at 5 yards, a swing, and a go. A fast, safe call on a long down.',
    points: [
      'Formation 2x2. H stick at 5 (1), F swing (2), Z go (3).',
      'Backside X curls (4) and Y hitches.',
      'Throw the stick if the defender widens; throw the swing if he sits inside.',
    ],
    beats: ['Cover 3', 'Zone', 'Man'],
    off: '2x2',
    routes: [
      ['H', 'hitch', { depth: 5, order: 1 }], ['F', 'swing', { order: 2 }], ['Z', 'go', { depth: 20, order: 3 }],
      ['X', 'curl', { depth: 10, order: 4 }], ['Y', 'hitch', { depth: 5 }],
    ],
  },
  {
    id: 'p-09', num: 9, kind: 'play', cat: 'Offense', name: 'Bunch layers',
    short: 'Bunch right. Three receivers peel off at three depths; a post backside and a check-down.',
    points: [
      'Formation bunch right. Z corner (1), Y out (2), H flat (3).',
      'Backside: X post (4) and F swing left (5).',
      'Great against man: the defenders fight through the traffic. The back man releases behind the front man.',
    ],
    beats: ['Man', 'Zone', 'Cover 3'],
    off: 'bunch-r',
    routes: [
      ['Z', 'corner', { depth: 11, length: 7, order: 1 }], ['Y', 'out', { depth: 6, length: 6, order: 2 }], ['H', 'flat', { depth: 1, length: 6, order: 3 }],
      ['X', 'post', { depth: 10, length: 8, order: 4 }], ['F', 'swing', { order: 5 }],
    ],
  },
  {
    id: 'p-10', num: 10, kind: 'play', cat: 'Offense', name: 'Post-wheel',
    short: 'Bunch left. The outside man wheels, the front man runs a post and the back man a trail slant.',
    points: [
      'Formation bunch left. H wheel (1), Y post (2), Z slant (3). X goes deep on the other side.',
      'F is the check-down on the swing.',
      'Run it, then show the same look and call something different.',
    ],
    beats: ['Man', 'Cover 3'],
    off: 'bunch-l',
    routes: [
      ['H', 'wheel', { depth: 18, length: 7, order: 1 }], ['Y', 'post', { depth: 10, length: 8, order: 2 }], ['Z', 'slant', { depth: 2, length: 5, order: 3 }],
      ['X', 'go', { depth: 20 }], ['F', 'swing', { order: 4 }],
    ],
  },
  {
    id: 'p-11', num: 11, kind: 'play', cat: 'Offense', name: 'Bubble',
    short: 'A quick bubble screen to the slot with a go to clear the corner and a slant backside.',
    points: [
      'Formation 2x2. H bubble (1), Z go (2), Y slant (3), X go.',
      'F stays home as the safety valve.',
      'A one-step throw. Good against a defense sitting back, and against blitzes.',
    ],
    beats: ['Cover 3', 'Zone', 'Blitz'],
    off: '2x2',
    routes: [
      ['H', 'pts', { pts: [[2, -1.5], [6, -1]], order: 1 }], ['Z', 'go', { depth: 20, order: 2 }],
      ['Y', 'slant', { depth: 2, length: 5, order: 3 }], ['X', 'go', { depth: 20 }],
    ],
  },
  {
    id: 'p-12', num: 12, kind: 'play', cat: 'Offense', name: 'Jet sweep',
    short: 'Y motions across and takes a handoff or lateral around the right edge while the others go deep. Check your league rules.',
    points: [
      'Formation 2x2 with F off to the left. Y motions (dashed) to the QB, then runs the sweep.',
      'X, H and Z all run vertical to clear space on the edge.',
      'Needs handoffs or laterals to be legal in your league. A great change-up after Smash.',
    ],
    beats: ['Zone', 'Cover 3'],
    off: '2x2', at: { F: [-9, -5] },
    routes: [
      ['Y', 'pts', { kind: 'motion', pts: [[3, -3], [7, -4], [10, -4]], end: 'arrow' }],
      ['Y', 'pts', { pts: [[3, 0], [9, 1], [13, 4]], order: 1 }],
      ['X', 'go', { depth: 20 }], ['H', 'seam', { depth: 16 }], ['Z', 'go', { depth: 20 }],
    ],
  },

  // ======================= DIAMOND DAWGS PLAYBOOK: defense =======================
  {
    id: 'p-d1', num: 1, kind: 'defense', cat: 'Defense', name: 'Cover 3',
    short: 'Three deep thirds, two hooks and two flats. Safe against the deep ball and strong on the sidelines.',
    points: [
      'A and C take the sideline thirds, B the middle third. D and G sit in the flats, E and F in the hooks.',
      'Keep the ball in front of you. Do not let anyone get behind the deep three.',
      'Weak spots: the seams between the thirds, and the corner route out of a bunch or trips.',
    ],
    beats: ['Cover 3'],
    off: '2x2', defForm: 'cover3', cov: 'cover3',
  },
  {
    id: 'p-d2', num: 2, kind: 'defense', cat: 'Defense', name: 'Cover 2',
    short: 'Two deep halves and five underneath zones. Strong against short throws and quick routes.',
    points: [
      'A and B each take a deep half. C and G sit in the flats, and D, E and F share the hooks.',
      'The flats jam any receiver headed to the sideline, then drop back under the deep half.',
      'Weak spots: the deep middle between the halves, and the corner route against one safety.',
    ],
    beats: ['Cover 2'],
    off: '2x2', defForm: 'cover2', cov: 'cover2',
  },
  {
    id: 'p-d3', num: 3, kind: 'defense', cat: 'Defense', name: 'Quarters',
    short: 'Four deep defenders each take a quarter, with three underneath. A shot-stopper for deep routes.',
    points: [
      'A, B, C and D take a quarter each. E and G cover the flats, F the middle hook.',
      'If a receiver comes into a deep defender\'s zone, he plays him man to man.',
      'Weak spots: the short middle and crossing routes (Drive, Mesh).',
    ],
    beats: ['Cover 4'],
    off: '2x2', defForm: 'cover4', cov: 'cover4',
  },
  {
    id: 'p-d4', num: 4, kind: 'defense', cat: 'Defense', name: 'Man free with a rusher',
    short: 'Five defenders play man, one plays deep middle as a free safety and one rushes the QB.',
    points: [
      'A on X, B on Y, C on F, D on H, E on Z. F is the free safety, deep middle.',
      'G rushes from 7 yards. Check the rush rules in your league first: some allow one rusher on a count.',
      'The man defenders stay on their man the whole play; if the man crosses, switch with the next defender.',
    ],
    beats: ['Man', 'Blitz'],
    off: '2x2', defForm: 'man',
    def: [],
    zl: {},
    droutes: [['G', 'pts', { pts: [[0, -11.5]], end: 'arrow' }]],
    freeSafety: true,
  },
];
