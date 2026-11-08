// The "Print sheets" dialog: build a list of plays, pick a page or card size,
// preview it, print it. State lives in localStorage next to the plays.

import { esc } from './render.js';
import { loadSheets, saveSheets } from './storage.js';
import {
  MAX_SHEET_PLAYS, PAGE_PRESETS, PRESET_BY_ID, fromUnit, layoutSheet, newSheet, normLayout, pageCount, pageStyle,
  sheetHTML, toUnit, validateSheet,
} from './sheet.js';
import { uid } from './model.js';

const $ = (id) => document.getElementById(id);

export function initSheets({ getPlays, toast, printRoot }) {
  const dlg = $('sheet-dialog');
  const store = loadSheets();
  let previewTimer = null;

  const cur = () => store.sheets.find((s) => s.id === store.current) || null;
  const persist = () => saveSheets(store);

  function library() {
    return getPlays();
  }

  function ensureSheet() {
    if (!store.sheets.length) {
      const s = newSheet('Sheet 1', library().map((p) => p.id));
      store.sheets.push(s);
      store.current = s.id;
      persist();
    }
    if (!cur()) store.current = store.sheets[0].id;
  }

  function resolve(sheet) {
    const byId = new Map(library().map((p) => [p.id, p]));
    return sheet.plays.map((id) => byId.get(id)).filter(Boolean);
  }

  // ---- layout controls ------------------------------------------------------
  const num = (id) => $(id);
  const fields = { w: 'pageW', h: 'pageH', margin: 'margin', gap: 'gap', cw: 'cellW', ch: 'cellH' };

  function fillControls(L) {
    const u = L.unit;
    $('sh-unit').value = u;
    $('sh-preset').value = L.preset;
    const set = (id, v, step) => {
      const el = num('sh-' + id);
      if (document.activeElement !== el) el.value = v;
      el.step = step;
    };
    const st = u === 'cm' ? 0.1 : 0.05;
    set('w', toUnit(L.pageW, u), u === 'cm' ? 0.1 : 0.1);
    set('h', toUnit(L.pageH, u), 0.1);
    set('margin', toUnit(L.margin, u), st);
    set('gap', toUnit(L.gap, u), st);
    set('cw', toUnit(L.cellW, u), 0.1);
    set('ch', toUnit(L.cellH, u), 0.1);
    set('cols', L.cols, 1);
    set('rows', L.rows, 1);
    for (const k of ['title', 'numbers', 'border', 'crop']) $('sh-' + k).checked = L[k];
    $('sh-show').value = L.show;
    for (const b of dlg.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === L.mode);
    $('sh-grid-row').hidden = L.mode !== 'grid';
    $('sh-fixed-row').hidden = L.mode !== 'fixed';
    const custom = L.preset === 'custom';
    $('sh-w').disabled = !custom;
    $('sh-h').disabled = !custom;
  }

  function patchLayout(patch) {
    const s = cur();
    if (!s) return;
    s.layout = normLayout({ ...s.layout, ...patch });
    persist();
    render();
  }

  // ---- lists ----------------------------------------------------------------
  function renderLists(sheet) {
    const plays = resolve(sheet);
    // forget plays that were deleted from the library
    sheet.plays = plays.map((p) => p.id);
    $('sh-count').textContent = `(${plays.length})`;
    $('sh-list').innerHTML = plays.length
      ? plays
          .map((p, i) => `<li data-id="${esc(p.id)}"><span class="n">${i + 1}</span><span class="nm" title="${esc(p.name)}">${esc(p.name || 'Untitled play')}</span>
            <button type="button" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">&uarr;</button>
            <button type="button" data-act="down" ${i === plays.length - 1 ? 'disabled' : ''} aria-label="Move down">&darr;</button>
            <button type="button" data-act="remove" class="danger" aria-label="Remove">&times;</button></li>`)
          .join('')
      : '<li class="muted">No plays yet. Add some below.</li>';
    const onSheet = new Set(sheet.plays);
    const rest = library().filter((p) => !onSheet.has(p.id));
    $('sh-lib').innerHTML = rest.length
      ? rest
          .map((p) => `<li data-id="${esc(p.id)}"><span class="nm" title="${esc(p.name)}">${esc(p.name || 'Untitled play')}</span><button type="button" data-act="add">Add</button></li>`)
          .join('')
      : '<li class="muted">Every play is already on this sheet.</li>';
  }

  function renderSummary(sheet, plays) {
    const g = layoutSheet(sheet.layout);
    const u = g.layout.unit;
    const unitName = u === 'cm' ? 'cm' : 'in';
    const fmt = (v) => toUnit(v, u);
    const pages = pageCount(plays.length, g.perPage);
    let t = `${g.cols} × ${g.rows} = ${g.perPage} per page. Each play is ${fmt(g.cellW)} × ${fmt(g.cellH)} ${unitName}.`;
    t += plays.length ? ` ${plays.length} play${plays.length === 1 ? '' : 's'} makes ${pages} page${pages === 1 ? '' : 's'}.` : '';
    if (!g.ok) t = 'These sizes leave too little room for a play. Make the page bigger or the margins and gaps smaller.';
    $('sh-summary').textContent = t;
    $('sh-print').disabled = !g.ok || !plays.length;
  }

  function renderPreview(sheet, plays) {
    const box = $('sh-preview');
    const g = layoutSheet(sheet.layout);
    if (!plays.length) {
      box.innerHTML = '<p class="empty">Add plays to see the pages here.</p>';
      return;
    }
    if (!g.ok) {
      box.innerHTML = '<p class="empty">These sizes leave too little room for a play.</p>';
      return;
    }
    const L = g.layout;
    const avail = Math.max(200, box.clientWidth - 28);
    const k = Math.min(1, avail / (L.pageW * 96));
    box.innerHTML = `<div style="zoom:${k.toFixed(4)}">${sheetHTML(plays, L)}</div>`;
  }

  function render() {
    ensureSheet();
    const s = cur();
    $('sh-select').innerHTML = store.sheets.map((x) => `<option value="${esc(x.id)}" ${x.id === s.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    if (document.activeElement !== $('sh-name')) $('sh-name').value = s.name;
    $('sh-delete').disabled = store.sheets.length < 2;
    fillControls(s.layout);
    renderLists(s);
    const plays = resolve(s);
    renderSummary(s, plays);
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => dlg.open && renderPreview(s, plays), 60);
  }

  // ---- events ---------------------------------------------------------------
  $('sh-preset').innerHTML = PAGE_PRESETS.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');

  $('sh-select').addEventListener('change', (e) => {
    store.current = e.target.value;
    persist();
    render();
  });
  $('sh-name').addEventListener('input', (e) => {
    const s = cur();
    if (!s) return;
    s.name = e.target.value.slice(0, 60) || 'Untitled sheet';
    persist();
    const opt = $('sh-select').selectedOptions[0];
    if (opt) opt.textContent = s.name;
  });
  $('sh-new').addEventListener('click', () => {
    const base = cur();
    const s = newSheet(`Sheet ${store.sheets.length + 1}`, library().map((p) => p.id));
    if (base) s.layout = normLayout(base.layout); // start from the current page setup
    store.sheets.push(s);
    store.current = s.id;
    persist();
    render();
    $('sh-name').focus();
    $('sh-name').select();
  });
  $('sh-delete').addEventListener('click', () => {
    const s = cur();
    if (!s || store.sheets.length < 2) return;
    if (!window.confirm(`Delete the sheet "${s.name}"? Your plays are not affected.`)) return;
    store.sheets = store.sheets.filter((x) => x.id !== s.id);
    store.current = store.sheets[0].id;
    persist();
    render();
  });

  $('sh-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    const li = e.target.closest('li[data-id]');
    const s = cur();
    if (!b || !li || !s) return;
    const i = s.plays.indexOf(li.dataset.id);
    if (i < 0) return;
    if (b.dataset.act === 'remove') s.plays.splice(i, 1);
    else if (b.dataset.act === 'up' && i > 0) [s.plays[i - 1], s.plays[i]] = [s.plays[i], s.plays[i - 1]];
    else if (b.dataset.act === 'down' && i < s.plays.length - 1) [s.plays[i + 1], s.plays[i]] = [s.plays[i], s.plays[i + 1]];
    persist();
    render();
  });
  $('sh-lib').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="add"]');
    const li = e.target.closest('li[data-id]');
    const s = cur();
    if (!b || !li || !s) return;
    if (s.plays.length >= MAX_SHEET_PLAYS) {
      toast(`A sheet can hold ${MAX_SHEET_PLAYS} plays.`);
      return;
    }
    s.plays.push(li.dataset.id);
    persist();
    render();
  });
  $('sh-add-all').addEventListener('click', () => {
    const s = cur();
    if (!s) return;
    const have = new Set(s.plays);
    for (const p of library()) if (!have.has(p.id) && s.plays.length < MAX_SHEET_PLAYS) s.plays.push(p.id);
    persist();
    render();
  });
  $('sh-clear').addEventListener('click', () => {
    const s = cur();
    if (!s) return;
    s.plays = [];
    persist();
    render();
  });

  $('sh-preset').addEventListener('change', (e) => {
    const pr = PRESET_BY_ID[e.target.value];
    const patch = { preset: e.target.value };
    // a landscape/portrait preset keeps a sensible grid for its shape
    if (pr && pr.w && pr.w < 6.5 && cur().layout.mode === 'grid') Object.assign(patch, { cols: 2, rows: 1 });
    patchLayout(patch);
  });
  $('sh-unit').addEventListener('change', (e) => patchLayout({ unit: e.target.value }));
  for (const [id, key] of Object.entries(fields)) {
    $('sh-' + id).addEventListener('change', (e) => {
      const unit = cur().layout.unit;
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return render();
      const patch = { [key]: fromUnit(v, unit) };
      if (key === 'pageW' || key === 'pageH') patch.preset = 'custom';
      patchLayout(patch);
    });
  }
  for (const [id, key] of [['cols', 'cols'], ['rows', 'rows']]) {
    $('sh-' + id).addEventListener('change', (e) => patchLayout({ [key]: Number(e.target.value) }));
  }
  for (const b of dlg.querySelectorAll('[data-mode]')) b.addEventListener('click', () => patchLayout({ mode: b.dataset.mode }));
  for (const k of ['title', 'numbers', 'border', 'crop']) $('sh-' + k).addEventListener('change', (e) => patchLayout({ [k]: e.target.checked }));
  $('sh-show').addEventListener('change', (e) => patchLayout({ show: e.target.value }));

  $('sh-print').addEventListener('click', () => {
    const s = cur();
    const plays = s ? resolve(s) : [];
    const g = s && layoutSheet(s.layout);
    if (!s || !plays.length) return toast('Add some plays first.');
    if (!g.ok) return toast('Those sizes leave no room for a play.');
    printRoot.innerHTML = sheetHTML(plays, s.layout);
    let st = $('page-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'page-style';
      document.head.appendChild(st);
    }
    st.textContent = pageStyle(s.layout);
    window.print();
  });

  $('sh-close').addEventListener('click', () => dlg.close());
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!dlg.open) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });

  return {
    open() {
      ensureSheet();
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
      render();
    },
    // for files: sheets travel with a playbook, play ids are remapped on import
    exportSheets: () => store.sheets.map((s) => ({ ...s })),
    importSheets(list, idMap) {
      let n = 0;
      for (const raw of Array.isArray(list) ? list.slice(0, 50) : []) {
        try {
          const s = validateSheet(raw);
          s.id = uid();
          s.plays = s.plays.map((id) => idMap.get(id)).filter(Boolean);
          store.sheets.push(s);
          n++;
        } catch {
          /* skip anything that is not a sheet */
        }
      }
      if (n) persist();
      return n;
    },
    get store() {
      return store;
    },
  };
}
