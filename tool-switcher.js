/* ===========================================================================
   tool-switcher.js — the ONE list of tools the case-shell bar switches between.

   Injected at build wherever a page's <script> carries the marker
     (slash-star) @tool-switcher (star-slash)
   exactly like inventory.js, equipment-icons.js and case-shell.js. Consumers:
   every page that wears the SHELL.md app bar.

   WHY THIS FILE EXISTS. The switcher was hand-written into each page, and
   seven copies of a list is seven chances to disagree. They already did:

     · tca/ — a live engine — had NO switcher at all, so from the traumatic
       arrest engine the other five were unreachable.
     · peds/ hoisted itself to the top of its own list; the six engines kept
       the fixed order. A menu that reorders itself per page is the second
       interface model SHELL.md exists to remove.
     · peds/ appended ?from=peds to every link so BACK returned where you came
       from; the engines omitted it, so landing from an engine lost the trail.
     · Neonatal and Dystocia both drew var(--blue). SHELL.md says each row is
       "a 9px color square in that tool's accent" — two tools with the same
       square is the same defect as two procedures with the same silhouette
       (design/ICONOGRAPHY.md). Dystocia now takes var(--teal); nothing else
       moved.

   ADDING A TOOL IS ONE ROW HERE. Not eight files. A card tool joins the same
   list as an engine — SHELL.md, decided during the peds port: "The tool
   switcher lists card tools too. It listed only the six engines, so a
   shell-wearing card tool was reachable from nowhere."

   ORDER IS FIXED AND IDENTICAL ON EVERY PAGE. The current tool is marked in
   place, never moved to the top: muscle memory for "third row down" is the
   whole value of a switcher during a code.
   =========================================================================== */

/* id       — the folder, and what ?from= carries.
   name     — the row label.
   tag      — the right-hand tag; the tool's clock tag where it has one
              (SHELL.md's per-tool mapping table), its short name otherwise.
   color    — the 9px square. Distinct from every other row's, by eye. */
var TOOL_SWITCHER_TOOLS = [
  { id: 'arrest',   name: 'Arrest',    tag: 'CODE',  color: 'var(--red)' },
  { id: 'tca',      name: 'TCA',       tag: 'TCA',   color: '#E08A3C' },
  { id: 'airway',   name: 'Airway',    tag: 'RSI',   color: '#2FA372' },
  { id: 'neonatal', name: 'Neonatal',  tag: 'NRP',   color: 'var(--blue)' },
  { id: 'pph',      name: 'PPH',       tag: 'PPH',   color: '#E75480' },
  { id: 'dystocia', name: 'Dystocia',  tag: 'OB',    color: 'var(--teal)' },
  { id: 'peds',     name: 'Peds',      tag: 'PEDS',  color: 'var(--purple)' },
  { id: 'codes',    name: 'Codes',     tag: 'CODES', color: 'var(--amber)' }
];

/* Renders the rows for the page it is on. `currentId` is that page's own id —
   it gets class "on" and a link to itself, so the row still says where you are
   without being a dead element.

   Every link carries ?from=<currentId>, which is what the shell's back-link
   rewrite reads to send BACK where the clinician actually came from. Switching
   mid-case is safe by design: weight, clock and log are cross-tool state that
   survives navigation (CASE-STATE.md). */
function renderToolSwitcher(currentId) {
  var esc = function (t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var rows = TOOL_SWITCHER_TOOLS.map(function (t) {
    return '<a class="shellmenurow' + (t.id === currentId ? ' on' : '') + '"' +
           ' href="../' + t.id + '/?from=' + encodeURIComponent(currentId) + '">' +
           '<span class="shellsq" style="background:' + t.color + '"></span>' +
           '<span style="flex:1">' + esc(t.name) + '</span>' +
           '<span class="shellmenusub">' + esc(t.tag) + '</span></a>';
  }).join('');
  return rows +
    '<div class="shellmenudiv"></div>' +
    '<a class="shellmenurow" href="../?from=tool">' +
    '<span class="shellsq" style="background:var(--gray)"></span>' +
    '<span style="flex:1">Manual home</span></a>';
}

/* Fills #toolmenu on the page that calls it. A page with no #toolmenu gets
   nothing and no error, the same contract as case-shell.js's data-opcard. */
function mountToolSwitcher(currentId) {
  var el = document.getElementById('toolmenu');
  if (!el) return;
  el.innerHTML = renderToolSwitcher(currentId);
}
