# Playbook

A static web app for drawing 7v7 flag football plays. It lives at `/playbook/`
and needs no build step or server: plain JavaScript modules and an SVG field.

## Using it

- Click a player, pick a preset route (the 1-9 route tree plus extras), then drag the dots to edit it.
- Double-click a route line to add a point, double-click a dot (or right-click it) to remove it.
- **Draw your own** lets you click out a custom route. **Motion** adds a dashed pre-snap move; the route then starts where the motion ends.
- Offense / Defense / Both limits what is shown, printed and exported.
- Field width, length and backfield depth are configurable. Position labels are editable (defaults are letters).
- Plays autosave in the browser. **Save file** writes a `.play.json`, **Export playbook** writes a `.playbook.json`, **Share link** puts the play in the URL, **Print** gives one play per page with the title in the corner.

## Layout

| File | Role |
| --- | --- |
| `js/model.js` | play data model, defaults, validation of anything imported |
| `js/routes.js` | route presets (points relative to the player) |
| `js/formations.js` | 7v7 offense formations and defensive looks |
| `js/state.js` | editor actions, undo/redo, hit testing (no DOM) |
| `js/render.js` | SVG output for the editor, export and print |
| `js/share.js` | compact share-link encoding |
| `js/storage.js`, `js/export.js` | local library, downloads, PNG |
| `js/app.js` | page wiring |

Coordinates are yards: `x` from the left sideline, `y` from the line of
scrimmage (negative is the backfield). Route points are stored relative to
their player.

## Running locally and testing

```
python3 -m http.server 8000      # then open http://localhost:8000/playbook/
node --test playbook/tests/core.test.mjs
```

Opening `/playbook/?debug` exposes `window.__playbook` for automated browser checks.
