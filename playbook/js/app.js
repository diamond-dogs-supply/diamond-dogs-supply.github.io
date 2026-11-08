// UI wiring for the playbook page.

import { Editor } from './state.js';
import { FIELD_LIMITS, ROUTE_COLORS, clonePlay, newPlay, uid, validatePlay } from './model.js';
import { GROUPS, PRESETS, PRESET_MAP } from './routes.js';
import { DEFENSE_FORMATIONS, OFFENSE_FORMATIONS } from './formations.js';
import { esc, geom, playToSVG, svgInner } from './render.js';
import { loadLibrary, saveLibrary } from './storage.js';
import { codeFromHash, decodePlay, encodePlay } from './share.js';
import { downloadBlob, downloadText, slug, svgToPngBlob } from './export.js';

const $ = (id) => document.getElementById(id);
const svg = $('field');

// ---- state ------------------------------------------------------------------
let lib = loadLibrary();
if (!lib.plays.length) lib.plays.push(newPlay('Play 1'));
let readOnly = false;
const start = lib.plays.find((p) => p.id === lib.current) || lib.plays[0];
const ed = new Editor(clonePlay(start));
let drag = null;
let saveTimer = null;

// ---- small helpers ----------------------------------------------------------
function toast(msg, ms = 2600) {
	const t = $('toast');
	t.textContent = msg;
	t.hidden = false;
	clearTimeout(toast.timer);
	toast.timer = setTimeout(() => (t.hidden = true), ms);
}

function setStatus(msg) {
	$('save-status').textContent = msg;
}

function banner(html, kind = '') {
	const b = $('banner');
	b.className = 'banner' + (kind ? ' ' + kind : '');
	b.innerHTML = html;
	b.hidden = !html;
}

// Text inputs and sliders: apply live while the user types or drags, but make
// the whole interaction a single undo step.
function bindLive(el, apply) {
	let open = false;
	el.addEventListener('input', () => {
		if (readOnly) return;
		if (!open) {
			ed.beginGesture();
			open = true;
		}
		apply(el.value, el);
	});
	el.addEventListener('change', () => {
		if (open) {
			ed.endGesture();
			open = false;
		}
	});
}

// ---- persistence ------------------------------------------------------------
function persist() {
	if (readOnly) return;
	const snap = clonePlay(ed.play);
	const i = lib.plays.findIndex((p) => p.id === snap.id);
	if (i >= 0) lib.plays[i] = snap;
	else lib.plays.push(snap);
	lib.current = snap.id;
	setStatus(saveLibrary(lib) ? 'Saved on this device' : 'Not saved: browser storage unavailable');
}

function persistSoon() {
	if (readOnly) return;
	setStatus('Saving…');
	clearTimeout(saveTimer);
	saveTimer = setTimeout(persist, 350);
}

function openPlay(id) {
	persist();
	const p = lib.plays.find((x) => x.id === id);
	if (!p) return;
	ed.loadPlay(clonePlay(p));
	persist();
}

function createPlay() {
	persist();
	const p = newPlay(`Play ${lib.plays.length + 1}`);
	lib.plays.push(p);
	ed.loadPlay(clonePlay(p));
	persist();
	$('play-name').focus();
	$('play-name').select();
}

function allPlays() {
	persist();
	return lib.plays.map((p) => (p.id === ed.play.id ? clonePlay(ed.play) : p));
}

// ---- field ------------------------------------------------------------------
function renderField() {
	const g = geom(ed.play);
	svg.setAttribute('viewBox', g.vb);
	svg.innerHTML = svgInner(ed.play, { theme: 'screen', show: ed.ui.show, editor: !readOnly, sel: ed.ui.sel, draw: ed.ui.draw });
}

function toField(e) {
	const m = svg.getScreenCTM();
	if (!m) return null;
	const pt = svg.createSVGPoint();
	pt.x = e.clientX;
	pt.y = e.clientY;
	const p = pt.matrixTransform(m.inverse());
	const g = geom(ed.play);
	return { x: p.x, y: g.L - g.B - p.y };
}

// Double-click / double-tap is detected here, not with the dblclick event:
// selecting re-renders the field, and a replaced element never gets click or
// dblclick. This also works on touch screens.
let lastTap = null;

svg.addEventListener('pointerdown', (e) => {
	if (readOnly || (e.pointerType === 'mouse' && e.button !== 0)) return;
	const pos = toField(e);
	if (!pos) return;
	const t = e.target;
	const isDouble = lastTap && e.timeStamp - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 14;
	lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
	if (isDouble && !(t.closest && t.closest('[data-pid]'))) {
		const hp = ed.hitPoint(pos);
		const hr = hp ? null : ed.hitRoute(pos);
		if (hp || hr) {
			lastTap = null;
			if (hp) ed.deletePoint(hp.rid, hp.idx);
			else ed.insertPointAt(hr.rid, pos.x, pos.y);
			e.preventDefault();
			return;
		}
	}
	const pt = t.closest && t.closest('[data-pt]');
	if (pt) {
		const rid = pt.dataset.rid;
		const idx = Number(pt.dataset.pt);
		ed.selectPoint(idx);
		ed.beginGesture();
		drag = { type: 'point', rid, idx };
		svg.setPointerCapture(e.pointerId);
		e.preventDefault();
		return;
	}
	const pl = t.closest && t.closest('[data-pid]');
	if (pl) {
		const id = pl.dataset.pid;
		ed.select(id);
		const p = ed.player(id);
		ed.beginGesture();
		drag = { type: 'player', id, gx: pos.x - p.x, gy: pos.y - p.y };
		svg.setPointerCapture(e.pointerId);
		e.preventDefault();
		return;
	}
	const rt = t.closest && t.closest('[data-rid]');
	if (rt) {
		const r = ed.routeById(rt.dataset.rid);
		if (r) ed.select(r.playerId, r.kind);
		return;
	}
	const sel = ed.selectedRoute();
	if (ed.ui.draw && sel) {
		ed.appendPoint(sel.id, pos.x, pos.y);
		return;
	}
	ed.clearSelection();
});

svg.addEventListener('pointermove', (e) => {
	if (!drag) return;
	const pos = toField(e);
	if (!pos) return;
	if (drag.type === 'player') ed.movePlayer(drag.id, pos.x - drag.gx, pos.y - drag.gy);
	else ed.movePoint(drag.rid, drag.idx, pos.x, pos.y);
});

function endDrag(e) {
	if (!drag) return;
	drag = null;
	if (e && svg.hasPointerCapture && svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
	ed.endGesture();
}
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);

svg.addEventListener('contextmenu', (e) => {
	if (readOnly) return;
	const pos = toField(e);
	const hp = pos && ed.hitPoint(pos);
	if (hp) {
		e.preventDefault();
		ed.deletePoint(hp.rid, hp.idx);
	}
});

// ---- keyboard ---------------------------------------------------------------
document.addEventListener('keydown', (e) => {
	const tag = (e.target.tagName || '').toLowerCase();
	const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
	const mod = e.metaKey || e.ctrlKey;
	if (mod && !typing && e.key.toLowerCase() === 'z') {
		e.preventDefault();
		if (readOnly) return;
		if (e.shiftKey) ed.redo();
		else ed.undo();
		return;
	}
	if (mod && !typing && e.key.toLowerCase() === 'y') {
		e.preventDefault();
		if (!readOnly) ed.redo();
		return;
	}
	if (typing || readOnly || mod) return;
	if (e.key === 'Escape') {
		if (ed.ui.draw) ed.setDraw(false);
		else if (ed.ui.sel.point !== null) ed.selectPoint(null);
		else ed.clearSelection();
		return;
	}
	if (e.key === 'Delete' || e.key === 'Backspace') {
		const r = ed.selectedRoute();
		if (r && ed.ui.sel.point !== null) ed.deletePoint(r.id, ed.ui.sel.point);
		else if (ed.ui.sel.playerId) ed.removePlayer(ed.ui.sel.playerId);
		else return;
		e.preventDefault();
		return;
	}
	const step = e.shiftKey ? 2 : 0.5;
	const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
	if (arrows[e.key] && ed.ui.sel.playerId) {
		e.preventDefault();
		ed.nudgePlayer(ed.ui.sel.playerId, ...arrows[e.key]);
	}
});

// ---- inspector --------------------------------------------------------------
function presetChips(route) {
	let h = '';
	for (const g of GROUPS) {
		h += `<div class="preset-group">${esc(g.name)}</div><div class="chips">`;
		for (const p of PRESETS.filter((x) => x.group === g.id)) {
			const on = route && route.preset === p.id ? ' on' : '';
			h += `<button type="button" class="chip${on}" data-act="preset" data-id="${p.id}">${p.num ? `<b>${p.num}</b>` : ''}${esc(p.name)}</button>`;
		}
		if (g.id === 'tree') {
			const on = route && route.preset === 'custom' ? ' on' : '';
			h += `<button type="button" class="chip${on}" data-act="preset" data-id="custom">&#9998; Draw your own</button>`;
		}
		h += '</div>';
	}
	return h;
}

function slider(id, label, value, max) {
	return `<label class="slider">${label}<input type="range" id="${id}" min="0" max="${max}" step="0.5" value="${value}"><output id="${id}-out">${value} yd</output></label>`;
}

function inspectorHTML() {
	const p = ed.player(ed.ui.sel.playerId);
	if (!p) {
		return `<h2>Player &amp; route</h2><p class="muted">Click a player on the field to give them a route, a pre-snap motion, or a new label. Drag players to move them.</p>`;
	}
	const kind = ed.ui.sel.kind;
	const route = ed.selectedRoute();
	let h = `<div class="insp-head"><span class="badge ${p.side}">${p.side === 'O' ? 'Offense' : 'Defense'}</span>
		<label class="inline">Label <input id="p-label" type="text" maxlength="4" value="${esc(p.label)}" autocomplete="off"></label>
		<button type="button" class="danger" data-act="remove-player">Remove</button></div>`;
	h += `<div class="seg wide"><button type="button" data-act="kind" data-kind="route" class="${kind === 'route' ? 'on' : ''}">Route</button>
		<button type="button" data-act="kind" data-kind="motion" class="${kind === 'motion' ? 'on' : ''}">Motion (before snap)</button></div>`;
	h += presetChips(route);
	if (!route) {
		h += `<p class="muted" style="margin-top:12px">${kind === 'motion' ? 'No motion yet.' : 'No route yet.'} Pick one above, then drag its dots to reshape it.</p>`;
		return h;
	}
	const pr = PRESET_MAP[route.preset];
	h += '<div class="ctl">';
	if (pr && pr.uses.includes('depth')) h += slider('r-depth', 'Depth', route.depth, 30);
	if (pr && pr.uses.includes('length')) h += slider('r-length', 'Length', route.length, 25);
	if (pr) h += `<p class="muted">${route.edited ? `Edited from the ${esc(pr.name)} preset. Moving a slider redraws it from the preset.` : `${esc(pr.name)} preset. Drag the dots on the field to edit it.`}</p>`;
	else h += `<p class="muted">Custom route. Use Draw to add points by clicking the field, or drag the dots.</p>`;
	h += `<div class="opts">
		<label><input type="checkbox" id="r-flip" ${route.flip ? 'checked' : ''} ${pr ? '' : 'disabled'}> Flip direction</label>
		<label><input type="checkbox" id="r-curve" ${route.curve ? 'checked' : ''}> Rounded</label>
		<label><input type="checkbox" id="r-dash" ${route.dash ? 'checked' : ''}> Dashed</label>
		<label>End <select id="r-end">${['arrow', 'T', 'dot', 'none'].map((v) => `<option value="${v}" ${route.end === v ? 'selected' : ''}>${{ arrow: 'Arrow', T: 'T (block)', dot: 'Dot', none: 'None' }[v]}</option>`).join('')}</select></label>
		<label>Read <select id="r-order"><option value="0">None</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${route.order === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
	</div>`;
	h += `<div class="swatches" aria-label="Route color">${ROUTE_COLORS.map((c) => `<button type="button" class="swatch${c ? '' : ' auto'}${route.color === c ? ' on' : ''}" data-act="color" data-color="${c || ''}" title="${c || 'Automatic'}" ${c ? `style="background:${c}"` : ''}></button>`).join('')}</div>`;
	const sp = ed.ui.sel.point;
	h += `<div class="btns">
		<button type="button" data-act="add-point" ${route.points.length >= 12 ? 'disabled' : ''}>Add point</button>
		<button type="button" data-act="del-point" ${sp === null ? 'disabled' : ''}>Delete point</button>
		<button type="button" data-act="draw" class="${ed.ui.draw ? 'chip on' : ''}">${ed.ui.draw ? 'Done drawing' : 'Draw'}</button>
		<button type="button" data-act="reset" ${pr && route.edited ? '' : 'disabled'}>Reset to preset</button>
		<button type="button" data-act="remove-route" class="danger">Remove ${kind === 'motion' ? 'motion' : 'route'}</button>
	</div>`;
	return h + '</div>';
}

const inspector = $('inspector');

inspector.addEventListener('click', (e) => {
	const b = e.target.closest('[data-act]');
	if (!b || readOnly) return;
	const sel = ed.ui.sel;
	const route = ed.selectedRoute();
	switch (b.dataset.act) {
		case 'kind': ed.setKind(b.dataset.kind); break;
		case 'preset': ed.setPreset(sel.playerId, sel.kind, b.dataset.id); break;
		case 'remove-player': ed.removePlayer(sel.playerId); break;
		case 'color': if (route) ed.updateRoute(route.id, { color: b.dataset.color || null }); break;
		case 'add-point': if (route) ed.addPointAuto(route.id); break;
		case 'del-point': if (route && sel.point !== null) ed.deletePoint(route.id, sel.point); break;
		case 'draw': ed.setDraw(!ed.ui.draw); break;
		case 'reset': if (route) ed.resetRoute(route.id); break;
		case 'remove-route': if (route) ed.removeRoute(route.id); break;
		default: break;
	}
});

inspector.addEventListener('change', (e) => {
	const route = ed.selectedRoute();
	if (readOnly || !route) return;
	const id = e.target.id;
	if (id === 'r-flip') ed.updateRoute(route.id, { flip: e.target.checked });
	else if (id === 'r-curve') ed.updateRoute(route.id, { curve: e.target.checked });
	else if (id === 'r-dash') ed.updateRoute(route.id, { dash: e.target.checked });
	else if (id === 'r-end') ed.updateRoute(route.id, { end: e.target.value });
	else if (id === 'r-order') ed.updateRoute(route.id, { order: Number(e.target.value) });
});

// sliders and the label box live inside re-rendered markup, so delegate
let liveOpen = false;
inspector.addEventListener('input', (e) => {
	if (readOnly) return;
	const id = e.target.id;
	const route = ed.selectedRoute();
	if (id !== 'p-label' && id !== 'r-depth' && id !== 'r-length') return;
	if (!liveOpen) {
		ed.beginGesture();
		liveOpen = true;
	}
	if (id === 'p-label') ed.setLabel(ed.ui.sel.playerId, e.target.value);
	else if (route) {
		const key = id === 'r-depth' ? 'depth' : 'length';
		ed.updateRouteLive(route.id, { [key]: Number(e.target.value) });
		const out = $(id + '-out');
		if (out) out.textContent = `${e.target.value} yd`;
	}
});
inspector.addEventListener('change', (e) => {
	if (liveOpen && ['p-label', 'r-depth', 'r-length'].includes(e.target.id)) {
		liveOpen = false;
		ed.endGesture();
	}
});

// ---- other panels -----------------------------------------------------------
function fillSelect(sel, items) {
	sel.innerHTML = items.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
}
fillSelect($('off-formation'), OFFENSE_FORMATIONS);
fillSelect($('def-formation'), DEFENSE_FORMATIONS);
$('apply-off').addEventListener('click', () => ed.applyFormation('O', $('off-formation').value));
$('apply-def').addEventListener('click', () => ed.applyFormation('D', $('def-formation').value));
$('add-off').addEventListener('click', () => ed.addPlayer('O'));
$('add-def').addEventListener('click', () => ed.addPlayer('D'));

for (const key of ['width', 'length', 'backfield']) {
	const el = $('field-' + key);
	el.min = FIELD_LIMITS[key][0];
	el.max = FIELD_LIMITS[key][1];
	// commit on change (not per keystroke): typing "30" must not pass through "3"
	el.addEventListener('change', () => {
		if (readOnly) return;
		ed.beginGesture();
		ed.setField({ [key]: Number(el.value) });
		ed.endGesture();
		el.value = ed.play.field[key];
	});
}

bindLive($('play-name'), (v) => ed.setMeta('name', v));
bindLive($('play-notes'), (v) => ed.setMeta('notes', v));
bindLive($('play-tags'), (v) => ed.setMeta('tags', v));
$('snap').addEventListener('change', (e) => ed.setSnap(e.target.checked));
for (const b of document.querySelectorAll('[data-show]')) b.addEventListener('click', () => ed.setShow(b.dataset.show));

function renderPlays() {
	const ul = $('plays-list');
	ul.innerHTML = lib.plays
		.map((p) => {
			const cur = p.id === ed.play.id;
			const name = cur ? ed.play.name : p.name;
			return `<li class="${cur ? 'current' : ''}" data-id="${esc(p.id)}">
				<button type="button" class="open" data-act="open" title="Open">${esc(name || 'Untitled play')}</button>
				<button type="button" class="small" data-act="dup" title="Duplicate">Copy</button>
				<button type="button" class="small danger" data-act="del" title="Delete">Delete</button></li>`;
		})
		.join('');
}

$('plays-list').addEventListener('click', (e) => {
	const b = e.target.closest('[data-act]');
	const li = e.target.closest('li');
	if (!b || !li || readOnly) return;
	const id = li.dataset.id;
	if (b.dataset.act === 'open') openPlay(id);
	if (b.dataset.act === 'dup') {
		persist();
		const src = id === ed.play.id ? ed.play : lib.plays.find((p) => p.id === id);
		const copy = clonePlay(src);
		copy.id = uid();
		copy.name = `${src.name} copy`.slice(0, 60);
		lib.plays.push(copy);
		openPlay(copy.id);
	}
	if (b.dataset.act === 'del') {
		const p = lib.plays.find((x) => x.id === id);
		if (!window.confirm(`Delete "${p ? p.name : 'this play'}"? This cannot be undone.`)) return;
		lib.plays = lib.plays.filter((x) => x.id !== id);
		if (!lib.plays.length) lib.plays.push(newPlay('Play 1'));
		if (id === ed.play.id) {
			lib.current = lib.plays[0].id;
			ed.loadPlay(clonePlay(lib.plays[0]));
		}
		persist();
		renderPanels();
	}
});

function hintText() {
	if (readOnly) return 'Viewing a shared play. Choose "Edit a copy" to change it, or print, save, or export it as is.';
	if (ed.ui.draw) return 'Drawing: click the field to add points. Press Esc or Done drawing when finished.';
	if (ed.selectedRoute()) return 'Drag the dots to reshape the route. Double-click the line to add a point; double-click or right-click a dot to remove it.';
	if (ed.ui.sel.playerId) return 'Pick a route from the panel, then drag its dots to edit it.';
	return 'Click a player to give them a route. Drag players to move them. Arrow keys nudge the selected player.';
}

function renderPanels() {
	inspector.innerHTML = inspectorHTML();
	$('btn-undo').disabled = !ed.canUndo;
	$('btn-redo').disabled = !ed.canRedo;
	for (const b of document.querySelectorAll('[data-show]')) b.classList.toggle('on', b.dataset.show === ed.ui.show);
	$('snap').checked = ed.ui.snap;
	const off = ed.play.players.filter((p) => p.side === 'O').length;
	const def = ed.play.players.length - off;
	$('counts').textContent = `Offense ${off} · Defense ${def} · Field ${ed.play.field.width} × ${ed.play.field.length} yd`;
	for (const key of ['width', 'length', 'backfield']) {
		const el = $('field-' + key);
		if (document.activeElement !== el) el.value = ed.play.field[key];
	}
	const meta = [['play-name', ed.play.name], ['play-notes', ed.play.notes], ['play-tags', ed.play.tags.join(', ')]];
	for (const [id, v] of meta) if (document.activeElement !== $(id)) $(id).value = v;
	$('play-name').readOnly = readOnly;
	$('hint').textContent = hintText();
	renderPlays();
}

ed.on((kind) => {
	renderField();
	if (kind === 'full') renderPanels();
	persistSoon();
});

// ---- header actions ---------------------------------------------------------
$('btn-new').addEventListener('click', createPlay);
$('btn-new2').addEventListener('click', createPlay);
$('btn-undo').addEventListener('click', () => ed.undo());
$('btn-redo').addEventListener('click', () => ed.redo());
$('btn-mirror').addEventListener('click', () => ed.mirror());

function buildSheet(play) {
	const notes = play.notes ? `<p class="sheet-notes">${esc(play.notes)}</p>` : '';
	return `<section class="sheet"><div class="sheet-fig">${playToSVG(play, { theme: 'print', show: ed.ui.show })}</div>${notes}</section>`;
}

function printPlays(plays) {
	$('print-root').innerHTML = plays.map(buildSheet).join('');
	window.print();
}
window.addEventListener('afterprint', () => ($('print-root').innerHTML = ''));
$('btn-print').addEventListener('click', () => printPlays([ed.play]));
$('btn-print-all').addEventListener('click', () => printPlays(allPlays()));

$('btn-png').addEventListener('click', async () => {
	try {
		const g = geom(ed.play);
		const w = 1600;
		const h = Math.round((w * g.vbH) / g.vbW);
		const markup = playToSVG(ed.play, { theme: 'print', show: ed.ui.show, widthPx: w });
		downloadBlob(await svgToPngBlob(markup, w, h), `${slug(ed.play.name)}.png`);
	} catch (err) {
		toast(err.message || 'PNG export failed');
	}
});

$('btn-save').addEventListener('click', () => {
	downloadText(JSON.stringify({ format: 'ddg-play', ...ed.play }, null, 2), `${slug(ed.play.name)}.play.json`);
	toast('Saved a .play.json file. Send it to a teammate or open it later with Open file.');
});

$('btn-export-all').addEventListener('click', () => {
	const plays = allPlays();
	downloadText(JSON.stringify({ format: 'ddg-playbook', v: 1, plays }, null, 2), 'diamond-dawg.playbook.json');
	toast(`Exported ${plays.length} play${plays.length === 1 ? '' : 's'}.`);
});

$('btn-open').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', async (e) => {
	const file = e.target.files && e.target.files[0];
	e.target.value = '';
	if (!file) return;
	try {
		const data = JSON.parse(await file.text());
		const raws = Array.isArray(data.plays) ? data.plays : [data];
		const plays = raws.slice(0, 200).map((r) => {
			const p = validatePlay(r);
			p.id = uid(); // imported plays are always new copies
			return p;
		});
		if (!plays.length) throw new Error('No plays found in that file');
		persist();
		lib.plays.push(...plays);
		openPlay(plays[0].id);
		toast(plays.length === 1 ? `Opened "${plays[0].name}".` : `Imported ${plays.length} plays.`);
	} catch (err) {
		banner(`Could not open that file: ${esc(err.message || 'unrecognised format')}. <button type="button" id="banner-close">Dismiss</button>`, 'error');
		$('banner-close').addEventListener('click', () => banner(''));
	}
});

// ---- share ------------------------------------------------------------------
const dlg = $('share-dialog');
$('btn-share').addEventListener('click', async () => {
	try {
		const base = location.href.split('#')[0];
		const url = `${base}#p=${await encodePlay(ed.play)}`;
		const name = ed.play.name || 'Play';
		$('share-url').value = url;
		$('share-meta').textContent = `${url.length} characters. Works in email, text messages and chat.`;
		$('share-mail').href = `mailto:?subject=${encodeURIComponent(`Play: ${name}`)}&body=${encodeURIComponent(`Open this play: ${url}`)}`;
		$('share-native').hidden = typeof navigator.share !== 'function';
		if (typeof dlg.showModal === 'function') dlg.showModal();
		else window.prompt('Copy this link:', url);
		$('share-url').select();
	} catch (err) {
		toast(err.message || 'Could not make a link');
	}
});
$('share-copy').addEventListener('click', async () => {
	const input = $('share-url');
	try {
		await navigator.clipboard.writeText(input.value);
	} catch {
		input.select();
		document.execCommand('copy');
	}
	toast('Link copied');
});
$('share-native').addEventListener('click', () => {
	navigator.share({ title: `Play: ${ed.play.name}`, url: $('share-url').value }).catch(() => {});
});

function enterShared(play) {
	if (!readOnly) persist();
	readOnly = true;
	document.body.classList.add('readonly');
	ed.loadPlay(play);
	banner(`<span>Shared play: <strong>${esc(play.name)}</strong> (view only)</span><button type="button" id="edit-copy" class="primary">Edit a copy</button>`);
	$('edit-copy').addEventListener('click', () => {
		readOnly = false;
		document.body.classList.remove('readonly');
		history.replaceState(null, '', location.pathname + location.search);
		banner('');
		lib.plays.push(clonePlay(ed.play));
		persist();
		ed.emit('full');
		toast('You now have your own copy.');
	});
	renderField();
	renderPanels();
}

async function handleHash() {
	const code = codeFromHash(location.hash);
	if (!code) return;
	try {
		enterShared(await decodePlay(code));
	} catch (err) {
		banner(`That share link could not be opened (${esc(err.message || 'invalid')}). <button type="button" id="banner-close">Dismiss</button>`, 'error');
		$('banner-close').addEventListener('click', () => banner(''));
	}
}
window.addEventListener('hashchange', handleHash);

window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'hidden') persist();
});

// ---- go ---------------------------------------------------------------------
renderField();
renderPanels();
persist();
handleHash();

// Debug hook for automated checks: open /playbook/?debug
if (new URLSearchParams(location.search).has('debug')) {
	window.__playbook = { ed, get lib() { return lib; } };
}
