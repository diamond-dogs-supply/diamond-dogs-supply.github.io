# Playbook

A static web app for drawing 7v7 flag football plays. It lives at `/playbook/`
and needs no build step or server: plain JavaScript modules and an SVG field.

## Using it

- Click a player, pick a preset route (the 1-9 route tree plus extras), then drag the dots to edit it.
- Double-click a route line to add a point, double-click a dot (or right-click it) to remove it.
- **Draw your own** lets you click out a custom route. **Motion** adds a dashed pre-snap move; the route then starts where the motion ends.
- **Defensive zones:** select a defender, stay on the **Zone** tab and pick Flat, Hook / curl, Deep third, half or quarter (or a custom zone). A line runs from the defender to the ellipse. Drag the ellipse to move it, the square handles (or the sliders) to resize it, and type a label. **Draw zones for this look** under Formations & players gives every defender a zone for Cover 2, 3 or 4 in one click, and the zones follow if you change the look. The **Path** tab is still there for man or blitz paths.
- **Print sheets** (the Sheets button): build an ordered list of plays and print them on pages of any size. Choose Letter, A4, a 5 x 3 in wristband card, an index card, or type any width and height in inches or cm. Either fill the page with a columns x rows grid, or set the size of each play and let it fit as many as it can. Margin and gap are adjustable; plays can be numbered, titled and bordered, and **Zoom to the action** crops each diagram to the players and routes so they print larger. Letters and lines are enlarged automatically on small cards. Save as PDF from the print window to keep a file. Sheets are saved in the browser and travel inside **Export playbook**.
- Offense / Defense / Both limits what is shown, printed and exported.
- Field width, length and backfield depth are configurable. Position labels are editable (defaults are letters).
- Plays autosave in the browser. **Save file** writes a `.play.json`, **Export playbook** writes a `.playbook.json`, **Share link** puts the play in the URL, **Print** gives one play per page with the title in the corner.

## Layout

| File | Role |
| --- | --- |
| `js/model.js` | play data model, defaults, validation of anything imported |
| `js/routes.js` | route presets and zone presets (points relative to the player) |
| `js/formations.js` | 7v7 offense formations and defensive looks |
| `js/state.js` | editor actions, undo/redo, hit testing (no DOM) |
| `js/sheet.js` | print sheet layout maths, page presets, sheet markup (no DOM) |
| `js/sheets-ui.js` | the Print sheets dialog |
| `js/render.js` | SVG output for the editor, export and print |
| `js/share.js` | compact share-link encoding |
| `js/storage.js`, `js/export.js` | local library, downloads, PNG |
| `js/app.js` | page wiring |

A zone is a route of kind `zone` on a defender: one point (the ellipse centre,
relative to the defender), `zone: {rx, ry}` half-axes in yards, and a `label`.

Coordinates are yards: `x` from the left sideline, `y` from the line of
scrimmage (negative is the backfield). Route points are stored relative to
their player.

## Running locally and testing

```
python3 -m http.server 8000      # then open http://localhost:8000/playbook/
node --test playbook/tests/core.test.mjs
```

Opening `/playbook/?debug` exposes `window.__playbook` for automated browser checks.
