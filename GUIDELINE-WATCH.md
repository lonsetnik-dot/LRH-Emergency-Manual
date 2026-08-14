# Keeping the manual current — the guideline watch

For Lon and any future maintainer. This explains how the project notices when a
guideline the manual depends on has changed, what you personally have to do
about it, and — just as importantly — what this process **cannot** catch.

The short version: **a robot checks twenty-seven upstream bodies once a month
and opens a GitHub issue when something looks like it moved. A calendar makes
sure a human looks at each source on schedule even when the robot finds
nothing. You read the issue and decide what the medicine should say.**

---

## 1. The problem this solves

Every clinical number in this manual came from somewhere: an AHA guideline, an
ACOG practice bulletin, the NRP textbook, a DAS airway ladder. Those documents
get replaced. When one does, the manual keeps confidently displaying the old
number, in a red box, at 3 a.m., to someone who has no reason to doubt it.

Before this process existed, the citations lived only as prose inside whichever
tool used them. That made two obvious questions unanswerable:

1. **"AHA just published something. What in this manual moves?"**
2. **"When did anyone last check that NRP still says this?"**

You cannot grep prose for an answer to either. So the citations now also live in
one machine-readable file, and that file is what the watch runs on.

---

## 2. The three layers

**Layer 1 — the registry (`guidelines.js`).**
One row per upstream body. Each row records the **edition the manual is
currently written against**, the body's canonical page, how often that body
tends to republish, **which tools and cards carry numbers from it**, and the
date a human last checked it. That last field is the whole point: a row can say
*never*, and it does say never for every row today, because the registry is new.

**Layer 2 — the watcher (`check_guidelines.mjs`).**
Run monthly by GitHub. For each source it does up to two things: a **PubMed
search** for newly indexed guidelines matching that body and topic, and a
**fingerprint of the body's own guideline index page**. If either moves, that
source goes in the report — together with the list of tools and cards it
touches, so the scope of the work is stated up front rather than rediscovered.

**Layer 3 — the calendar.**
Every source carries a review interval: **180 days** for the ones driving the
most numbers (AHA, NRP, DAS, ACOG, ATLS, TQIP), **365 days** for the rest. Past
that interval, the source appears in the report **whether or not anything was
detected**. See §6 for why this layer is not optional.

---

## 3. What you actually see each month

On the 1st of the month, if anything needs a human, a GitHub issue appears —
labeled `guideline-watch`, titled *Guideline watch — <date>* — containing:

- **Changes detected upstream** — what moved, what the manual is written
  against, and which tools/cards are in scope.
- **Known-unreconciled content** — places the manual knowingly still carries an
  older edition (today: `neonatal/` versus NRP 9th edition).
- **Review due (calendar)** — sources never verified, or past their interval.
- **Probe failures** — a body's page stopped answering. This is a finding, not
  noise: a reorganized site is often a republished guideline.
- **Everything checked** — the full table, so a quiet month still shows its work.

Subsequent months **comment on the same issue** rather than opening a new one,
so the whole history of what was noticed and what was done sits in one thread. A
new issue opens only after you close the previous one.

If nothing needs a human, **no issue is opened** and nothing interrupts you. The
report is still saved to the workflow run's artifacts, so "did the check
actually run in March?" is answerable.

---

## 4. Closing an item out

For each source in the report:

1. **Open the source page** and compare the current edition against the
   `edition` field shown in the report.
2. **If nothing moved** — set that source's `lastVerified` to today's date in
   `guidelines.js`. That is the entire close-out. Ask Claude: *"nothing changed
   for DAS and ACOG, mark them verified."*
3. **If something moved** — the report's *touches* list is the scope. Open an
   issue per affected tool, change the content, then update **both** `edition`
   and `lastVerified` in the same commit as the content change. The two must
   never drift apart: `edition` is what the manual is written against, and it
   is a lie the moment it names an edition nobody has reconciled the content to.
4. **If a probe failed twice running** — the URL has probably moved. Fix the
   `url` in `guidelines.js`.

**Never set `lastVerified` to a date for a check that did not happen.** A
fabricated date is worse than a blank one: it buys 180 days of silence and it
looks like diligence on the page. `verify_guidelines.mjs` rejects a date in the
future, but it cannot detect a plausible lie.

---

## 5. Where to see the current state

`/sources/` on the live site — linked from the landing page as **Guideline
Sources**. It renders the same registry: freshness at a glance, every source
worst-first, and a **by tool** view answering "before I change a number in
`arrest/`, what does that tool answer to?" It is a read-only page; it stores
nothing.

---

## 6. What this cannot catch

Take this seriously, because the failure mode is false confidence.

- A body that **replaces a PDF at the same address** changes the guideline
  without changing its index page. Neither probe sees it.
- A body that **reorganizes its website** breaks the page probe. That surfaces
  as a probe failure — which is why failures are reported rather than skipped.
- A guideline **indexed as a review rather than a guideline** is missed by the
  PubMed probe.
- **Tertiary references** (WikEM, LITFL, EMCrit, StatPearls) are edited
  continuously with no editions and no announcements. Change detection against
  them is meaningless; only a periodic human re-read works.
- **Assay-specific and stock-specific values** — troponin cutoffs, what is
  actually in the drawer — are local truth. No upstream body will ever announce
  a change to them. They belong to the SITE CONFIG blocks and to
  `equipment-readiness/`, not here.

This is exactly why the calendar exists. **The crawler shortens the time to
notice; the calendar is what guarantees the look happens.** A quiet month means
*no change was detected* — never *nothing changed*. The report, the page and
this document all say it that way on purpose.

---

## 7. Adding a source

When a tool starts citing a body that is not in the registry yet — which is the
normal case for any new clinical content — add a row to `guidelines.js` with the
edition, the canonical URL, the publication cadence, the review interval, the
dependents, and `lastVerified: null` until somebody actually checks it. Add
watch probes if the body is findable (a PubMed term, a page URL); leave `watch`
empty if it genuinely is not, and let the calendar carry it.

`verify_guidelines.mjs` fails if a clinical tool has **no** source row and no
written exemption, so a new tool cannot quietly end up watched by nobody.

---

## 8. Running it by hand

You never need to. If you want to:

```
node check_guidelines.mjs              # full check, prints the report
node check_guidelines.mjs --offline    # calendar only, no network
node check_guidelines.mjs --source nrp # one source
```

Or from GitHub: **Actions → guideline-watch → Run workflow**.

The tests for all of this run with the rest of the suite:

```
node build.mjs && node verify_guidelines.mjs
```

---

## 9. The files

| File | What it is |
|---|---|
| `guidelines.js` | the registry — the one file you edit when a review is done |
| `check_guidelines.mjs` | the watcher that produces the monthly report |
| `.github/workflows/guideline-watch.yml` | the monthly schedule + the issue it opens |
| `sources/index.html` | the human-readable freshness page at `/sources/` |
| `verify_guidelines.mjs` | the tests that keep the registry honest |
| `GUIDELINE-WATCH.md` | this file |

The watcher's fingerprint state lives on its own `guideline-watch-state` branch,
pushed by the workflow. It is machine output — it never touches `main` and never
appears in a clinical diff.
