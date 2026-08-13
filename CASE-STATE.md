# CASE-STATE.md — the cross-tool storage contract

Single source of truth for every `localStorage` key any tool in this repo may read or
write. Per `CLAUDE.md`: **tools share the contract, not the code** — `codes/index.html`,
`ob-neonatal/index.html`, and `peds/index.html` each keep their own, independently-copied
implementation of the `CASESTATE` module documented below. They agree only on the key
names and value shapes on this page. No build step, no shared script file, ever.

Nothing outside this list is allowed to persist. Any new persisted key requires an entry
here in the same commit. This file was created as part of WS 0 (see `AGENTTASKS.md`).

All values are strings in `localStorage`; "shape" below describes what they parse to.
Every key here is device-local and PHI-free — see the PHI guard note under
`edm-case-log`.

## Shared keys (the actual cross-tool contract)

| Key | Shape | Written by | Read by | Notes |
|---|---|---|---|---|
| `edm-case-wtkg` | number (string) | codes, peds | codes, peds | The one patient weight used for every weight-based dose in codes and peds. **Not** `edm-ob-weight` — see Tool-local keys below, that's a different concept (neonatal equipment sizing in OB). |
| `edm-case-wtsrc` | `'measured'` \| `'estimated'` | codes, peds | codes, peds | Provenance of `edm-case-wtkg`. As of WS2.2, codes' own weight bar ports the identical `paint()`/provenance display peds' weight bar always had — both tools now write this. |
| `edm-case-wtms` | epoch ms (string) | codes, peds | codes, peds | Added by WS10.1. Written/cleared in the exact same place as `edm-case-wtkg` (each tool's own `save()`), and only when the *value* actually changes — not on every keystroke that reparses to the same number, and not on load. Powers the WS10.2 two-state weight strip (below): the strip's confidence decays with elapsed manual-wide inactivity (`edm-case-lastactive`), not with this timestamp directly, but this is the timestamp the strip's "ENTERED HH:MM · N MIN AGO" text itself displays. |
| `edm-case-ageyrs` | number (string) | codes | codes | Patient age in years, entered alongside weight in codes' weight bar. Added by the arrest-card merge (codes card 01 now covers both adult ACLS and pediatric PALS in one interface) so the pediatric-mode trigger can read age as well as weight — see `edm-case-adultoverride` below. Not yet written by peds (peds' own age-based weight *estimate* stays a one-shot calculation, not a persisted age). |
| `edm-case-adultoverride` | `'1'` \| absent | codes | codes | The "no, this is an adult" override on codes' merged arrest card (card 01). Weight/age below the pediatric trigger (`SITE.arrestTrigger` in `codes/index.html`: weight < 50 kg OR age ≤ 12 y) normally switches that card into weight-based PALS dosing; this key, when `'1'`, forces it back to adult ACLS dosing even though the trigger is met — a deliberate, reversible, always-visible override (tapping it again clears the key), because weight alone can't reliably distinguish a small child from a small/frail adult. Absent = not overridden (the default). Namespaced under `edm-case-` on purpose so RESET FOR NEXT CASE and the inactivity auto-clear both already sweep it with no extra code. |
| `edm-case-startms` | epoch ms (string) | codes | codes | First action of the case. **Gap:** only codes writes this today (it's a direct rename of codes' pre-existing `codeStartMs`). ob-neonatal and peds don't have an equally unambiguous "the case just began" hook yet — wiring them in is future work, not WS0. |
| `edm-case-clocks` | `{ name: epochMs }` | codes, ob, peds | codes, ob, peds | One shared namespace. See **Clock names** below for what's live and who uses each. |
| `edm-case-counts` | `{ name: int }` | codes, peds | codes, peds | One shared namespace. See **Count names** below. |
| `edm-case-checks` | `{ "<tool>:<data-k>": true }` | codes, ob, peds, trauma | codes, ob, peds, trauma | One map, every tool's checkboxes. The `<tool>:` prefix is applied at the storage layer only (in each tool's `CASESTATE.setChecked`/`isChecked`) — **no card's HTML `data-k` attribute was renamed**, so two tools' own numbering (codes' `"01-1"`, ob's `"02-0-0"`, peds' `"p01-1"`, trauma's `"c01-1"`) can never collide in the shared map even though they collide in principle. As of WS2.1, all four tools' checkboxes are keyed and persisted; every `input[type=checkbox]` in the repo now carries a `data-k`. Trauma's `CASESTATE` module is deliberately partial — checks only, no weight/clocks/log yet (those are WS7 scope, see the note at the end of this file). |
| `edm-case-log` | `[{ tMs, tool, card, label, k?, el? }]` | codes, ob, peds | codes, ob, peds | One flat, time-ordered array for the whole case. `tool` is `'codes'`\|`'ob'`\|`'peds'`. `k` and `el` are optional fields OB's log lane uses internally (correlating an entry back to the checkbox that logged it, and a clock-relative display string) — other tools ignore them. **PHI guard:** every tool's `CASESTATE.addLog()` is the *only* function allowed to write this key, and it refuses (drops, with a console warning) any label matching a weight-shaped number (`\d+(\.\d+)?\s*(kg\|lb)`) or a 6+ digit run (MRN/DOB/phone-shaped). As of WS2.3, each tool's "CASE TIMELINE" modal (button renamed from SUMMARY) shows *every* tool's events in one merged, time-ordered list, each row tagged with its source tool — not just its own entries. OB's copy sorts by an HH:MM "wall" string (its own events already worked this way, driven by user-entered birth time); other tools' real `tMs` entries convert to the same HH:MM shape to interleave correctly. **Known precision limit:** the sort key is minute-granularity, so two events logged in different tools within the same minute can display in insertion order rather than true sub-minute order — acceptable given OB's own events never had sub-minute precision to begin with. |
| `edm-case-lastactive` | epoch ms (string) | codes, ob, peds, trauma | codes, ob, peds, trauma | As of WS2.5, every tool touches this on load and on every click — not just peds. Drives each tool's inactivity auto-clear guard: past 60 minutes stale AND `CASESTATE.anyClockRunning()` false (checked across *all* tools' `edm-case-clocks`, not just the current one) triggers the same `edm-` prefix sweep RESET FOR NEXT CASE uses (WS2.4), with a dismissible banner instead of a silent clear. See the "Inactivity auto-clear" section below. |
| `edm-pref-mute` | `'0'` \| `'1'` | codes | codes | A **preference**, not case state — survives RESET. Only codes persists a mute setting today; ob-neonatal's mute is in-memory only (resets on reload) and peds has no mute control. Extending persistence to ob/peds is new functionality, not migration, and was left out of WS0. |

### arrest/ — the standalone VF/arrest engine

`arrest/index.html` is the redesigned cardiac-arrest cognitive aid and is the
same clinical card as Codes `#c01` (the hand-off points `#c01` at it). It
participates in the shared contract like every other tool, via its own
independently-copied bridge (the `SS` object in that file):

- **Reads** `edm-case-wtkg`, `edm-case-ageyrs`, `edm-case-adultoverride` on load,
  so a weight/age/override set anywhere in the manual carries in.
- **Writes** `edm-case-wtkg` + `edm-case-wtsrc` (`measured`|`estimated`) +
  `edm-case-wtms` when weight is entered/estimated, `edm-case-ageyrs` on age
  entry, and `edm-case-adultoverride` on the adult-override toggle.
- **Writes** `edm-case-log` for every logged event, tagged `tool:'codes',
  card:'01'` (it *is* the Codes arrest card), through the same PHI guard
  (weight-shaped / 6+-digit labels refused). Its in-tool EVENT LOG accordion is a
  separate in-memory view of the same events.
- **Touches** `edm-case-lastactive` on load and every click (WS2.5).
- **RESET** runs the shared `edm-` prefix sweep (preserving `edm-pref-`), same as
  every other tool's RESET FOR NEXT CASE (re-inits its state in memory rather
  than reloading — its single module needs no reload to re-read empty state).
- **Writes** `edm-case-clocks.rosc` (the ROSC instant) on ROSC / PULSE-PRESENT,
  and clears it on a re-arrest, so **Codes card 22's live Post-ROSC clock** counts
  up from it (card 22 reads `CASESTATE.getClock('rosc')`). This is the only shared
  clock arrest/ writes.
- **Does not yet** write the other running-code clocks (`cprCycle`/`epi`),
  `edm-case-counts` (`shocks`/`epi`/`amio`), or `edm-case-startms` — a mid-code
  reload still restarts the engine. That resilience step is deferred (arrest
  integration plan, later PR).

### Clock names currently in `edm-case-clocks`

| Name | Set by | Meaning |
|---|---|---|
| `cprCycle` | codes (c01) | Time of the last shock / last rhythm check — drives the 2-min rhythm-check cue. Formerly shared with peds' own arrest card (p01); as of the arrest-card merge, codes' card 01 is the one arrest interface for both populations (peds' p01 was retired — see `CLAUDE.md`/commit history), so only codes writes this now. |
| `epi` | codes (c01) | Time of the most recent (IV/IO) epi dose — drives the 3–5 min "epi due" cue. Same retirement note as `cprCycle` above. |
| `rosc` | arrest | The ROSC instant, written by the /arrest/ engine on ROSC / PULSE-PRESENT and cleared on re-arrest. Drives the live-counting-up "time since ROSC" clock on Codes card 22 (which reads it via `CASESTATE.getClock('rosc')`). Formerly written by codes' card-01 engine, retired in the arrest hand-off. |
| `seizure` | codes (c13), peds (p10) | Seizure/status-epilepticus clock start. Shared for the same reason as `cprCycle`/`epi`. |
| `pph` | ob (c06) | Postpartum hemorrhage clock start. |
| `rh` | ob (c10) | Maternal-arrest (resuscitative hysterotomy) clock start. |
| `rhBaby` | ob (c10) | "Baby out" mark, relative to `rh`. |
| `dystocia` | ob (c07) | Shoulder dystocia clock start. Doc's own example name for this clock (see `AGENTTASKS.md` WS0.1) — matched exactly. |
| `mtp` | codes (c12) | Time since MTP activation — elapsed-time clock, paired with the card's face-up event log (`data-loglane="12"`). |

Not migrated into this namespace (see Tool-local keys — deliberately deferred, not an
oversight): codes' `rsiinduct`/`rsiparalytic`/`c06etco2` (three independent airway
timestamps that WS5.2 plans to consolidate into one marked "airway" clock — moving them
now would be redone work), and ob's `birthms`/`clampms` (10+ scattered call sites, high
edit risk for unclear present cross-tool value) and `hrcycle` (a compound
`{n0,dur,band}` object, not a single timestamp — doesn't fit this shape).

### Count names currently in `edm-case-counts`

| Name | Set by | Meaning |
|---|---|---|
| `shocks` | codes | Defibrillation count, drives ZOLL joules-per-shock escalation. |
| `epi` | codes (c01) | Arrest **IV/IO** epi dose count. Formerly shared with peds' own arrest card (p01); as of the arrest-card merge only codes' card 01 writes this (see the `cprCycle`/`epi` clock notes above). **Not** the same thing as peds' anaphylaxis **IM** epi-pen count (`edm-peds-epidoses`, tool-local — see below); mixing those would itself be a safety bug (a clinician seeing "epi: 2" needs to know if that's 2 IM epi-pens or 2 IV pushes). |
| `amio` | codes | Amiodarone dose count, drives the 300 mg → 150 mg → max-reached sequence. |

## Tool-local keys (documented so nothing is orphaned; deliberately not in the shared contract)

These stay under each tool's own `edm-<tool>-*` prefix. Either they're genuinely
single-tool concepts, or the shape doesn't fit the shared buckets above, or the number of
call sites made moving them in this pass too risky for the value gained. Each is a
candidate to reconsider in a later workstream, not a bug.

**codes**
- `edm-codes-shockarmed` — the DEFIB button's armed/idle UI flag (flash-or-not), not a case fact.
- `edm-codes-checks-ts` — bookkeeping timestamp for codes' own 1-hour checklist auto-clear TTL (the checks themselves live in the shared `edm-case-checks`).
- `edm-codes-rsiinduct`, `edm-codes-rsiparalytic`, `edm-codes-c06etco2` — RSI/airway push timestamps (card 06). WS5.2 candidate for consolidation into a shared `airway` clock with marks.
- `edm-codes-airway` — metronome "advanced airway placed" checkbox state.
- `edm-codes-lkw`, `edm-codes-tnkms` — stroke card: last-known-well time, tPA administration time.
- `edm-codes-stmid21`, `edm-codes-sttnk21`, `edm-codes-stemi-xfer21` — STEMI card: door times, transfer-call tracking.
- `edm-codes-anaivpushes`, `edm-codes-anadoses`, `edm-codes-analastms` — codes' own anaphylaxis card epi tracking.
- `edm-codes-brdoses`, `edm-codes-brlastms` — symptomatic bradycardia card: atropine dose count and time of last dose.
- `edm-codes-txa` — TXA given flag (trauma/PPH card).
- `edm-codes-mtpprbc`, `edm-codes-mtpplasma`, `edm-codes-mtpplt`, `edm-codes-mtpcryo` — massive transfusion protocol product counts.
- `edm-codes-fonacico`, `edm-codes-fonaetco2` — FONA timer marks.

**ob-neonatal**
- `edm-ob-weight`, `edm-ob-ga` — the **neonate's** estimated weight/gestational age, used for equipment sizing (Merck/NRP tables). A different patient and a different purpose than `edm-case-wtkg` — do not conflate.
- `edm-ob-birthms`, `edm-ob-clampms` — birth time and cord-clamp time. Deferred from WS0 migration (see Clock names above).
- `edm-ob-sdround`, `edm-ob-sdroundstart` — shoulder dystocia re-run counter and its own start time. `edm-case-clocks.dystocia` covers the main clock; these are re-run-specific bookkeeping.
- `edm-ob-hrcycle` — neonatal HR-band timer state, `{n0, dur, band}` — doesn't fit the single-timestamp clock shape.
- `edm-ob-checks-ts` — same role as codes' `-checks-ts`.
- `edm-ob-apgar` — Apgar score entries.
- `edm-ob-mother` — maternal-history question-chip selections.

**peds**
- `edm-peds-epidoses` — anaphylaxis epi tracker (`{pep1: ms, pep2: ms, pep3: ms, pepbolus: ms, pepdrip: ms}`), one timestamp per dose button. A richer shape than the shared `counts`/`clocks` buckets fit; also a different clinical event (IM epi-pen) than the shared arrest `counts.epi` (IV push) — see the count-name table above.
- `edm-peds-checks-ts` — same role as codes'/ob's `-checks-ts` (WS2.1).

**trauma**
- `edm-trauma-checks-ts` — same role as the other three tools' `-checks-ts` (WS2.1). Trauma has no other persisted state yet — see the WS7 note below.

## Migration (WS 0.2)

Every tool's `CASESTATE` module runs a one-time migration on load: it reads each of that
tool's old pre-WS0 keys if present, folds the value into the shape above (merging with,
not clobbering, a value another tool may have already written), and deletes the old key.
The block is a no-op once the old keys are gone. Per `AGENTTASKS.md`: remove each tool's
migration block after two deploys, and never leave two keys meaning the same thing.

Old key → new home, for every key this migration retires (each still appears once, as a
string literal, inside its tool's migration block — that's expected, not an orphan):

| Old key | New home |
|---|---|
| `edm-codes-mute` | `edm-pref-mute` |
| `edm-codes-wtkg` | `edm-case-wtkg` |
| `edm-codes-codestart` | `edm-case-startms` |
| `edm-codes-ccstart` | `edm-case-clocks.cprCycle` |
| `edm-codes-lastepims` | `edm-case-clocks.epi` |
| `edm-codes-stopms` | `edm-case-clocks.rosc` |
| `edm-codes-seizure` | `edm-case-clocks.seizure` |
| `edm-codes-shocks` | `edm-case-counts.shocks` |
| `edm-codes-epicount` | `edm-case-counts.epi` |
| `edm-codes-amiocount` | `edm-case-counts.amio` |
| `edm-codes-checks` | `edm-case-checks` (each entry re-keyed `codes:<data-k>`) |
| `edm-codes-log` | `edm-case-log` (each entry re-tagged `tool:'codes'`) |
| `edm-ob-checks` | `edm-case-checks` (each entry re-keyed `ob:<data-k>`) |
| `edm-ob-pphclock` | `edm-case-clocks.pph` |
| `edm-ob-rhclock` | `edm-case-clocks.rh` |
| `edm-ob-rhbaby` | `edm-case-clocks.rhBaby` |
| `edm-ob-sdclock` | `edm-case-clocks.dystocia` |
| `edm-ob-log` | `edm-case-log` (each entry re-tagged `tool:'ob'`) |
| `edm-peds-wtkg` | `edm-case-wtkg` |
| `edm-peds-wtsrc` | `edm-case-wtsrc` (value `'entered'` renamed to `'measured'`) |
| `edm-peds-cprstart` | `edm-case-clocks.cprCycle` |
| `edm-peds-cprepims` | `edm-case-clocks.epi` |
| `edm-peds-cprepicount` | `edm-case-counts.epi` |
| `edm-peds-seizure` | `edm-case-clocks.seizure` |
| `edm-peds-lastactive` | `edm-case-lastactive` |
| `edm-peds-log` | `edm-case-log` (each entry re-tagged `tool:'peds'`) |

## PHI guard (WS 0.3)

`CASESTATE.addLog()` is the only function in any tool that writes `edm-case-log`, and it
refuses any label that looks like it could carry a weight (`\d+(\.\d+)?\s*(kg|lb)`, case
insensitive) or a long digit run (6+ digits — MRN/DOB/phone-shaped) rather than a fixed
clinical-event string. Verified: no call site in any of the three tools currently
interpolates the patient's actual weight into a log label (peds' anaphylaxis epi label
says `"0.01 mg/kg"` — a fixed per-kg *rate* constant, not the patient's weight — which is
fine and passes the guard).

## RESET FOR NEXT CASE — the one destructive control (WS2.4)

Every tool used to have several buttons that said RESET, CLEAR, or RESTART CYCLE — the
nav bar's case-wide control plus 6-8 per-card buttons that only ever cleared *that one
card's own clock or counter*. A clinician skimming a card mid-case had no reliable way
to tell which of those was the one that would wipe the whole case out from under them.

WS2.4 renamed every per-card control off that vocabulary — cycle/round restarts (codes'
card 01/02, peds' `pcacycle`) are now **NEW CYCLE**; every other per-card clock re-arm
(codes' LKW/RSI-induction/RSI-paralytic/TXA/seizure/FONA, peds' seizure clock, ob's
metronome/PPH/dystocia/Rh clocks) is now **UNDO**. Their underlying behavior is
unchanged — each still only touches its own one card, and each is still safe to tap
without a confirm, since it never destroys anything outside that card.

**RESET FOR NEXT CASE** is now the only control, in any tool, whose label contains
"reset" or "clear" — and it is gated behind an in-page confirm modal (`#resetmodal`,
built the same way as codes' `#audiencemodal`; the confirm button itself is literally
labeled **CLEAR CASE**, so between the two there is exactly one "reset" control and one
"clear" control system-wide, both steps of the same single destructive action). Tapping
RESET FOR NEXT CASE no longer clears anything directly — it opens the confirm. Only
confirming runs the actual clear:

1. Every `localStorage` key on the origin whose name starts with `edm-` is removed,
   **except** keys starting with `edm-pref-` (today, just `edm-pref-mute`) — the one
   documented preference namespace that is meant to survive a case. Because the four
   tools are same-origin subpaths, this reaches every tool's state — codes, ob, peds,
   and trauma — regardless of which tool's RESET was pressed, not just the pressing
   tool's own keys. This directly closes the gap this section used to describe (below).
2. The page reloads, so every module re-reads its now-empty state through its normal
   boot path — the same path a fresh page load already takes — rather than each of the
   ~8-13 per-card modules needing its own bespoke "also clear me" listener kept in sync
   by hand. Those old per-card `resetbtn`-click listeners are still in the code (removing
   them was out of scope for this pass) but are now unreachable: the confirm-gate script
   is loaded first (immediately after the nav bar, before any card markup) and calls
   `stopImmediatePropagation()` on the raw click, so none of the later listeners on the
   same button ever fire. The prefix sweep supersedes what they used to do.

This means a *new* card's localStorage key needs no RESET-specific wiring at all to be
covered — it's swept by the `edm-` prefix automatically. The only way to opt a new key
out of RESET is to put it in the `edm-pref-` namespace on purpose.

Verified with Playwright: state set in codes (weight), peds (a checkbox), and ob (the
PPH clock) is confirmed still present after CANCEL, and gone from all three — plus every
per-card clock/counter tested (codes' epi-push counter, MTP tally, ETCO2 timestamp) —
after CLEAR CASE, while `edm-pref-mute` survives.

Note: because the confirm-gated clear reloads the page, and every tool's WS2.5 guard (next
section) touches `edm-case-lastactive` again on load, that one key reappears immediately
after a CLEAR CASE — expected, not a leak. It carries no case data, only "when was this
device last used," and a freshly-cleared case is, correctly, active right now.

## Inactivity auto-clear, manual-wide (WS2.5)

`edm-case-lastactive` is now touched by every tool — on load and on every tap anywhere in
that tool (`document.addEventListener('click', ..., true)`) — not just peds. Each tool
runs the same guard before any of its own per-card modules read state: if the shared
`lastactive` is more than 60 minutes old AND `CASESTATE.anyClockRunning()` is false (no
clock running in `edm-case-clocks`, checked across every tool, not just this one), it runs
the identical `edm-` prefix sweep RESET FOR NEXT CASE uses (WS2.4, preserving `edm-pref-`)
and sets a flag that makes a dismissible amber banner appear — "Cleared — no activity
anywhere in the manual for over an hour" — instead of clearing silently. `anyClockRunning`
suppresses the clear regardless of how stale `lastactive` is, so a case actively running in
one tool is never interrupted just because a different tool sat idle.

This closes the gap this section used to describe: before WS2.5, only peds ever touched
`lastactive`, so a case whose second half ran in Codes never reset peds' own idle clock,
and Codes/OB/Trauma never went stale on their own at all. `trauma` has no clocks or log of
its own yet (checks-only, per WS7 scope) but still participates — it reads the *shared*
`edm-case-clocks` for `anyClockRunning()`, touches `lastactive`, and runs the same sweep,
since a stale trauma checklist from a prior patient is exactly the kind of state this guard
exists to prevent.

Verified with Playwright: every tool touches `lastactive` on load; backdating it 90 minutes
with a clock running clears nothing (in any tool); backdating it 90 minutes with nothing
running clears everything except `edm-pref-mute` and shows the banner; activity in one tool
(codes) keeps a different tool (peds) from treating the case as stale when opened next.

## Two-state weight strip (WS10.2)

Codes' and peds' weight bars (`#wtbar`/`#wtdisplay`) each independently gained a second,
purely informational display state. State A is exactly what shipped before WS10 — the kg
value, its colour, and its `(measured)`/`(age-estimate)` provenance text, untouched.
State B appends a second element, `#wtstale`, reading `ENTERED HH:MM · N MIN AGO` (from
`edm-case-wtms`) and adds a `.stale` class to `#wtbar` (an amber border). Nothing about the
kg value, its colour, its provenance text, or any `.wdose` span ever changes — state B adds
information, it never hides, greys out, or blocks anything.

The trigger for state B is elapsed time since `edm-case-lastactive`, past each tool's own
`SITE.staleWeightMins` (default 10 — a maintainer-tunable guess, not a clinical cutoff),
**unless** a clock *that tool itself* would show as running is active (`toolClockRunning()`
in each tool's own weight-bar module — codes checks `cprCycle`/`epi`/`rosc`/`seizure`, peds
checks `seizure`). This is deliberately **not** `CASESTATE.anyClockRunning()`, which is
cross-tool over every clock name any tool anywhere uses (OB's `pph`/`rh`/`dystocia` would
wrongly suppress a stale Codes or Peds weight). Any tap anywhere in the tool (the same
capture-phase click already touching `edm-case-lastactive`, WS2.5) returns the strip to
state A immediately — the strip's confidence decays with the tool's own idle time, not with
the weight entry's own age directly, so a checkbox tick on an unrelated card returns to
state A even though the underlying weight is unchanged (this is intentional, not a bug — see
the WS10 spec's own "let the tool's confidence decay on its own" principle). Repainted on a
30-second interval (the only new timer) and never on `visibilitychange`/focus/resume, so
backgrounding and reopening the app inside the threshold stays state A.

## "START NEW CASE" entry points (WS10.3)

A second, motivated-action entry point to the exact same single destructive control every
tool already had (WS2.4's `#resetmodal` confirm + `edm-` prefix sweep) — no second clearing
path was built. Codes, OB, Peds, and Trauma each gained a `#startnewcasebtn` button in their
own intro block, wired in the same script that already owns `openModal()`/`doClear()` for
that tool's `#resetbtn`, so it opens the identical confirm. The landing page (`index.html`)
has no `CASESTATE` of its own and can't run the sweep directly, so its own "START NEW CASE"
link instead navigates into Codes with `?startnewcase=1`, which that tool's gate script reads
on load and opens the same confirm automatically. The original nav-bar `RESET FOR NEXT CASE`
button is untouched, in wording and behavior — **whether to also rename it is an open
maintainer call, flagged rather than decided by WS10.3.**

## Adult-override clears on a changed weight/age (WS10.4)

Codes' `edm-case-adultoverride` (see above) now also clears whenever the committed weight or
age value changes — not just on RESET. "Committed" means debounced ~800ms against the last
value actually saved, so a rapid `1` → `14` → `14.2` typing sequence, or a same-window typo
correction, clears the override at most once, after the value settles — never mid-keystroke.
This is deliberately unconditional (no confirmation, no decline) since a changed weight/age
is the closest signal this system is permitted to treat as "possibly a different patient,"
and the override exists specifically to be the shortest-lived key in the system. WS10.4's
optional "offer to also clear the previous patient's checkboxes" (never automatic, always
with a visible decline) was scoped out of this pass — flagged, not built, since the spec
marks it explicitly optional and it adds a second confirm-style interstitial for a workflow
the core override-clear already makes safe.

## Known, accepted scope gaps (see the notes above for reasoning)

- `edm-case-startms` only wired into codes.
- `edm-pref-mute` only wired into codes.
