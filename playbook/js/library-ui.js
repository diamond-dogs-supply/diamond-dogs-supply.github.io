// The Library dialog: browse concepts and the Diamond Dawgs playbook, preview
// them, open one as a new play, or mix pieces of it into the current play.

import { esc, playToSVG } from './render.js';
import { COLLECTIONS, CATEGORIES, BEATS, entryById, freshCopy, mixInto, notesFor, playFor, searchEntries } from './library.js';

const $ = (id) => document.getElementById(id);

export function initLibrary({ getEditor, addPlay, addPlays, toast }) {
  const dlg = $('lib-dialog');
  const st = { collection: 'playbook', category: '', beat: '', text: '', sel: null, flip: false };

  const thumb = (id) => playToSVG(playFor(id), { theme: 'print', crop: true, aspect: 1.25, title: false, cellWIn: 2.4 });

  function chips(host, items, cur, onPick, allLabel) {
    host.innerHTML = [['', allLabel], ...items.map((x) => [x, x])]
      .map(([v, l]) => `<button type="button" class="chip${v === cur ? ' on' : ''}" data-v="${esc(v)}">${esc(l)}</button>`)
      .join('');
    host.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.v)));
  }

  function renderList() {
    const cats = st.collection === 'concepts'
      ? CATEGORIES.filter((c) => !['Offense', 'Defense'].includes(c))
      : ['Offense', 'Defense'];
    if (st.category && !cats.includes(st.category)) st.category = '';
    chips($('lib-cats'), cats, st.category, (v) => { st.category = v; renderList(); }, 'All');
    chips($('lib-beats'), BEATS, st.beat, (v) => { st.beat = v; renderList(); }, 'Any defense');
    document.querySelectorAll('#lib-colls button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.collection));
    const rows = searchEntries({ collection: st.collection, category: st.category || null, beat: st.beat || null, text: st.text });
    $('lib-count').textContent = `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`;
    $('lib-grid').innerHTML = rows.length
      ? rows.map((e) => `<button type="button" class="lib-card${e.id === st.sel ? ' on' : ''}" data-id="${e.id}">
          <span class="lib-thumb">${thumb(e.id)}</span>
          <span class="lib-name">${e.num ? e.num + '. ' : ''}${esc(e.name)}</span>
          <span class="lib-short">${esc(e.short || '')}</span></button>`).join('')
      : '<p class="muted">Nothing matches. Try clearing a filter.</p>';
    $('lib-grid').querySelectorAll('.lib-card').forEach((b) => b.addEventListener('click', () => select(b.dataset.id)));
  }

  function select(id) {
    st.sel = id;
    const e = entryById(id);
    $('lib-grid').querySelectorAll('.lib-card').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    if (!e) { $('lib-detail').hidden = true; return; }
    $('lib-detail').hidden = false;
    $('lib-d-title').textContent = (e.num ? e.num + '. ' : '') + e.name;
    $('lib-d-svg').innerHTML = playToSVG(playFor(id, { flip: st.flip }), { theme: 'print', crop: true, aspect: 1.1, title: false, widthPx: 360 });
    $('lib-d-notes').innerHTML = `<p>${esc(e.short || '')}</p>` +
      (e.points && e.points.length ? `<ul>${e.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '') +
      (e.beats && e.beats.length ? `<p class="muted">Works against: ${esc(e.beats.join(', '))}</p>` : '');
    $('lib-flip').checked = st.flip;
  }

  const opts = () => ({ flip: st.flip });

  $('lib-colls').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    st.collection = b.dataset.v; st.category = ''; renderList();
  }));
  $('lib-search').addEventListener('input', (ev) => { st.text = ev.target.value; renderList(); });
  $('lib-flip').addEventListener('change', (ev) => { st.flip = ev.target.checked; if (st.sel) select(st.sel); });
  $('lib-close').addEventListener('click', () => dlg.close());

  $('lib-open').addEventListener('click', () => {
    if (!st.sel) return;
    const p = freshCopy(st.sel, opts());
    addPlay(p);
    dlg.close();
    toast(`Added "${p.name}" to My plays.`);
  });

  $('lib-mix').addEventListener('click', () => {
    if (!st.sel) return;
    const ed = getEditor();
    const src = playFor(st.sel, opts());
    const res = mixInto(ed, src, { half: $('lib-half').value, parts: $('lib-parts').value, align: $('lib-align').checked });
    const miss = [...new Set(res.missing)];
    toast(res.applied
      ? `Added ${res.applied} route${res.applied === 1 ? '' : 's'} to this play.` + (miss.length ? ` No player for ${miss.join(', ')}.` : '')
      : 'Nothing to add: this play has no players with those labels.');
    if (res.applied) dlg.close();
  });

  $('lib-all').addEventListener('click', () => {
    const rows = searchEntries({ collection: 'playbook' });
    addPlays(rows.map((e) => freshCopy(e.id)));
    dlg.close();
    toast(`Added the ${rows.length} playbook plays to My plays.`);
  });

  return {
    open() {
      renderList();
      if (st.sel) select(st.sel); else $('lib-detail').hidden = true;
      dlg.showModal();
    },
  };
}
