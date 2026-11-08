// Share links: a play is packed into a compact array form, deflated, and
// base64url-encoded into the URL hash (#p=...). No server involved, so the
// link is the play. Falls back to uncompressed data where the browser has no
// CompressionStream.

import { validatePlay } from './model.js';

const KIND = { route: 0, motion: 1 };
const KIND_BACK = ['route', 'motion'];

export function pack(play) {
  const index = new Map(play.players.map((p, i) => [p.id, i]));
  return {
    v: 1,
    n: play.name,
    o: play.notes || undefined,
    t: play.tags && play.tags.length ? play.tags : undefined,
    f: [play.field.width, play.field.length, play.field.backfield],
    p: play.players.map((p) => [p.side === 'D' ? 1 : 0, p.label, p.x, p.y]),
    r: play.routes
      .filter((r) => index.has(r.playerId))
      .map((r) => [
        index.get(r.playerId),
        KIND[r.kind] || 0,
        r.preset,
        r.edited ? 1 : 0,
        r.depth,
        r.length,
        (r.flip ? 1 : 0) | (r.curve ? 2 : 0) | (r.dash ? 4 : 0),
        r.end,
        r.color || '',
        r.order,
        r.points.flatMap((pt) => [pt.x, pt.y]),
      ]),
  };
}

export function unpack(d) {
  if (!d || typeof d !== 'object' || d.v !== 1 || !Array.isArray(d.p)) throw new Error('Unrecognised share link');
  const ids = d.p.map((_, i) => 'p' + i);
  const raw = {
    name: d.n,
    notes: d.o,
    tags: d.t,
    field: { width: d.f && d.f[0], length: d.f && d.f[1], backfield: d.f && d.f[2] },
    players: d.p.map((p, i) => ({ id: ids[i], side: p[0] === 1 ? 'D' : 'O', label: p[1], x: p[2], y: p[3] })),
    routes: (Array.isArray(d.r) ? d.r : []).map((r, i) => {
      const pts = Array.isArray(r[10]) ? r[10] : [];
      const points = [];
      for (let k = 0; k + 1 < pts.length; k += 2) points.push({ x: pts[k], y: pts[k + 1] });
      const flags = r[6] | 0;
      return {
        id: 'r' + i,
        playerId: ids[r[0]],
        kind: KIND_BACK[r[1]] || 'route',
        preset: r[2],
        edited: r[3] === 1,
        depth: r[4],
        length: r[5],
        flip: !!(flags & 1),
        curve: !!(flags & 2),
        dash: !!(flags & 4),
        end: r[7],
        color: r[8] || null,
        order: r[9],
        points,
      };
    }),
  };
  const play = validatePlay(raw);
  play.id = Math.random().toString(36).slice(2, 9); // a received play is always a new copy
  return play;
}

function toB64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodePlay(play) {
  const bytes = new TextEncoder().encode(JSON.stringify(pack(play)));
  if (typeof CompressionStream === 'function') {
    return 'z.' + toB64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
  }
  return 'u.' + toB64Url(bytes);
}

export async function decodePlay(code) {
  const dot = code.indexOf('.');
  const kind = dot > 0 ? code.slice(0, dot) : '';
  const body = code.slice(dot + 1);
  let bytes;
  if (kind === 'z') {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open compressed share links');
    bytes = await pipe(fromB64Url(body), new DecompressionStream('deflate-raw'));
  } else if (kind === 'u') {
    bytes = fromB64Url(body);
  } else {
    throw new Error('Unrecognised share link');
  }
  return unpack(JSON.parse(new TextDecoder().decode(bytes)));
}

export async function shareUrl(play, base) {
  return `${base}#p=${await encodePlay(play)}`;
}

// Returns the code part of "#p=..." or null.
export function codeFromHash(hash) {
  const m = /^#p=([A-Za-z0-9_.-]+)$/.exec(hash || '');
  return m ? m[1] : null;
}
