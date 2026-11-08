// Print sheets: an ordered list of plays laid out on pages of a chosen size.
// Used for playbook pages and for small wristband cards. Everything is stored
// in inches (the dialog converts for display), so the maths stays in one unit.
// Pure functions: no DOM, so the layout can be tested in Node.

import { clamp, num, uid } from './model.js';
import { esc, playToSVG } from './render.js';

export const SHEET_SCHEMA = 1;
export const MAX_SHEET_PLAYS = 200;

export const PAGE_PRESETS = [
  { id: 'letter', name: 'Letter (8.5 × 11 in)', w: 8.5, h: 11 },
  { id: 'letter-l', name: 'Letter landscape (11 × 8.5 in)', w: 11, h: 8.5 },
  { id: 'a4', name: 'A4 (210 × 297 mm)', w: 210 / 25.4, h: 297 / 25.4 },
  { id: 'a4-l', name: 'A4 landscape (297 × 210 mm)', w: 297 / 25.4, h: 210 / 25.4 },
  { id: 'wristband', name: 'Wristband card (5 × 3 in)', w: 5, h: 3 },
  { id: 'index', name: 'Index card (6 × 4 in)', w: 6, h: 4 },
  { id: 'custom', name: 'Custom size', w: null, h: null },
];
export const PRESET_BY_ID = Object.fromEntries(PAGE_PRESETS.map((p) => [p.id, p]));

export const SHEET_DEFAULT = Object.freeze({
  unit: 'in',
  preset: 'letter',
  pageW: 8.5,
  pageH: 11,
  margin: 0.4,
  gap: 0.12,
  mode: 'grid', // 'grid' = fill the page with cols x rows, 'fixed' = every play is cellW x cellH
  cols: 3,
  rows: 4,
  cellW: 2.4,
  cellH: 1.7,
  title: true,
  numbers: true,
  border: true,
  crop: true,
  show: 'all',
});

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

export function normLayout(raw = {}) {
  const d = SHEET_DEFAULT;
  const preset = PRESET_BY_ID[raw.preset] ? raw.preset : raw.preset === undefined ? d.preset : 'custom';
  let pageW = clamp(num(raw.pageW, d.pageW), 2, 40);
  let pageH = clamp(num(raw.pageH, d.pageH), 2, 40);
  const pr = PRESET_BY_ID[preset];
  if (pr && pr.w) {
    pageW = pr.w;
    pageH = pr.h;
  }
  const margin = clamp(num(raw.margin, d.margin), 0, 3);
  const gap = clamp(num(raw.gap, d.gap), 0, 2);
  return {
    unit: raw.unit === 'cm' ? 'cm' : 'in',
    preset,
    pageW: round(pageW),
    pageH: round(pageH),
    margin: round(Math.min(margin, Math.min(pageW, pageH) / 3)),
    gap: round(gap),
    mode: raw.mode === 'fixed' ? 'fixed' : 'grid',
    cols: Math.round(clamp(num(raw.cols, d.cols), 1, 8)),
    rows: Math.round(clamp(num(raw.rows, d.rows), 1, 10)),
    cellW: round(clamp(num(raw.cellW, d.cellW), 0.8, 40)),
    cellH: round(clamp(num(raw.cellH, d.cellH), 0.6, 40)),
    title: raw.title === undefined ? d.title : !!raw.title,
    numbers: raw.numbers === undefined ? d.numbers : !!raw.numbers,
    border: raw.border === undefined ? d.border : !!raw.border,
    crop: raw.crop === undefined ? d.crop : !!raw.crop,
    show: ['all', 'off', 'def'].includes(raw.show) ? raw.show : 'all',
  };
}

// Works out the grid for a layout: how many plays per page and how big each is.
export function layoutSheet(layoutIn) {
  const L = normLayout(layoutIn);
  const usableW = L.pageW - 2 * L.margin;
  const usableH = L.pageH - 2 * L.margin;
  let cols;
  let rows;
  let cellW;
  let cellH;
  if (L.mode === 'fixed') {
    cellW = Math.min(L.cellW, usableW);
    cellH = Math.min(L.cellH, usableH);
    cols = Math.max(1, Math.floor((usableW + L.gap + 1e-6) / (cellW + L.gap)));
    rows = Math.max(1, Math.floor((usableH + L.gap + 1e-6) / (cellH + L.gap)));
  } else {
    cols = L.cols;
    rows = L.rows;
    cellW = (usableW - L.gap * (cols - 1)) / cols;
    cellH = (usableH - L.gap * (rows - 1)) / rows;
  }
  const ok = usableW > 0.5 && usableH > 0.5 && cellW >= 0.5 && cellH >= 0.4;
  return { layout: L, cols, rows, cellW: round(cellW), cellH: round(cellH), perPage: cols * rows, usableW: round(usableW), usableH: round(usableH), ok };
}

export function pageCount(nPlays, perPage) {
  return nPlays <= 0 ? 0 : Math.ceil(nPlays / Math.max(1, perPage));
}

// The @page rule that makes the browser print at exactly the sheet size.
export function pageStyle(layoutIn) {
  const L = normLayout(layoutIn);
  return `@page{size:${L.pageW}in ${L.pageH}in;margin:0}`;
}

function cellSVG(play, n, L, aspect, cellW) {
  let titleText;
  if (L.title && L.numbers) titleText = `${n}. ${play.name || 'Untitled play'}`;
  else if (L.numbers) titleText = String(n);
  return playToSVG(play, {
    theme: 'print',
    show: L.show,
    crop: L.crop,
    aspect,
    title: L.title || L.numbers,
    titleText,
    cellWIn: cellW,
  });
}

// Markup for the pages. `plays` are full play objects in print order.
export function sheetHTML(plays, layoutIn) {
  const g = layoutSheet(layoutIn);
  const L = g.layout;
  const aspect = g.cellW / g.cellH;
  const pages = [];
  for (let i = 0; i < plays.length; i += g.perPage) {
    const cells = plays
      .slice(i, i + g.perPage)
      .map((p, k) => `<div class="cell${L.border ? ' bordered' : ''}" role="group" aria-label="${esc(`Play ${i + k + 1}: ${p.name || 'Untitled'}`)}">${cellSVG(p, i + k + 1, L, aspect, g.cellW)}</div>`)
      .join('');
    // 0.02in shorter than the paper so rounding can never spill onto an extra page
    const style = `width:${L.pageW}in;height:${round(L.pageH - 0.02)}in;padding:${L.margin}in;gap:${L.gap}in;grid-template-columns:repeat(${g.cols},${g.cellW}in);grid-auto-rows:${g.cellH}in`;
    pages.push(`<section class="sheet-page" style="${style}">${cells}</section>`);
  }
  return pages.join('');
}

// ---- saved sheets ---------------------------------------------------------------
export function newSheet(name = 'Sheet 1', playIds = []) {
  return { v: SHEET_SCHEMA, id: uid(), name, plays: playIds.slice(0, MAX_SHEET_PLAYS), layout: normLayout({}) };
}

const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);

export function validateSheet(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Not a sheet');
  const ids = Array.isArray(raw.plays) ? raw.plays.filter((x) => typeof x === 'string').map((x) => x.slice(0, 24)) : [];
  return {
    v: SHEET_SCHEMA,
    id: str(raw.id, 24) || uid(),
    name: str(raw.name, 60) || 'Untitled sheet',
    plays: ids.slice(0, MAX_SHEET_PLAYS),
    layout: normLayout(raw.layout),
  };
}

// Unit helpers for the dialog (storage is always inches).
export const toUnit = (inches, unit) => round(unit === 'cm' ? inches * 2.54 : inches, 2);
export const fromUnit = (v, unit) => (unit === 'cm' ? v / 2.54 : v);
