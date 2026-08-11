# How this project runs — a plain-English guide

For Lon and any future non-developer maintainer. This explains how a change gets
from *an idea in your head* to *live on the website*, what the technical words
mean, and — most importantly — **how little of it you actually have to touch.**

The short version: **you decide *what* changes; Claude does the GitHub, Netlify,
and terminal work.** You should almost never need a terminal, and you never need
to copy-paste code between windows.

---

## 1. The two machines behind the site

There are only two systems to hold in your head.

- **GitHub** — the master copy of the project and its full history. Every version
  of every file, every change ever made, with the ability to undo any of it.
  Think of it as the filing cabinet + the time machine. The project lives at
  `github.com/lonsetnik-dot/LRH-Emergency-Manual`.
- **Netlify** — the publisher. It watches GitHub, and whenever the master copy
  changes, it automatically rebuilds and publishes the live website at
  **lrhemergencymanual.net**. You don't "upload" anything to Netlify; it just
  watches GitHub and follows along.

You (the clinician/designer) + Claude (the builder) sit in front of these two.

---

## 2. The words, each in one sentence

You'll see these in Claude's messages and on GitHub. You don't have to *use*
them — just recognize them.

- **Repository ("repo")** — the whole project folder, stored on GitHub.
- **`main`** — the official, live version. What's on `main` is what publishes to
  lrhemergencymanual.net.
- **Branch** — a private scratch copy where a change is built and tested *without
  touching the live site*. Named things like `ci-and-docs-2026-08-10`.
- **Commit** — one saved step of work, with a description. The history is a
  stack of commits.
- **Pull request ("PR")** — a proposal that says "take the work on this branch
  and add it to `main`." It's the review-and-approve gate. Has a number (#52).
- **Merge** — accepting a pull request, so its work becomes part of `main` — and
  therefore goes live.
- **Deploy** — Netlify building and publishing a version. `main` deploys to the
  real site; a branch gets its own private **branch deploy / deploy preview** so
  you can look before it's live.

---

## 3. The path every change travels

Here's the whole lifecycle, and who does each step:

```
  You:     "Make the epi dose show mL as well as mg."
   │
   ▼
  Claude:  creates a branch, makes the edit, runs the tests
   │
   ▼
  GitHub:  the automated safety-net (CI) runs the whole verify suite
           → a green ✓ (all tests pass) or a red ✗ (something broke)
   │
   ▼
  Netlify: builds a private preview of the branch so it can be looked at
   │
   ▼
  You:     glance at the green ✓, and (if it's a visual change) the preview
   │
   ▼
  Claude:  merges the pull request once you're happy
   │
   ▼
  Netlify: publishes main → lrhemergencymanual.net updates. Done.
```

**What you personally look at is only the last-mile stuff:** the green check
(did the automated tests pass?) and, for anything visual, the preview link. Not
the code, not the terminal.

---

## 4. The new automated safety-net (as of PR #52)

Every pull request now **automatically runs the project's full test suite** in
the cloud before anything can be merged. These tests already existed
(`verify_*.mjs`) but used to be run by hand; now GitHub runs them for you on
every change.

They catch things like: a calculator that returns the wrong number, a poster
that quietly spills onto a second page, a cart label that drifts out of sync
with the app, or a QR code that scans to nothing. If any of that happens, the
pull request shows a **red ✗** and Claude fixes it before it ever reaches you.

You'll see the result as a check on the PR:
- **verify — ✓ green** → the automated tests passed.
- **verify — ✗ red** → something broke; Claude investigates the log and fixes it.

You do not need to run anything. (If you ever *want* to, the whole suite runs
locally with one command: `bash run-tests.sh`.)

---

## 5. Looking at a change before it's live

When a change is visual, Claude will give you a **deploy-preview link** (looks
like `deploy-preview-52--loquacious-dolphin-833eb2.netlify.app`). That's the
branch, built and live, completely separate from the real site.

> **Note:** these preview links are currently **password-protected** by Netlify
> (they ask you to log in, and even Claude can't open them from here). If you'd
> like Claude to be able to check previews for you, you can turn off password
> protection for deploy previews in Netlify's settings — say the word and Claude
> will walk you through that one-time toggle.

For each visual change Claude will also hand you a **specific checklist** — not
"please test it," but "open card 12, tap each checkbox once, confirm the mL line
now appears under the mg line" — so your review is fast and targeted.

---

## 6. Undoing things

Nothing here is one-way. Because GitHub keeps the full history:

- **"Undo that change"** → Claude reverts the pull request; the site returns to
  how it was, and the revert is itself recorded.
- **"What changed last week?"** → Claude can show you exactly.
- A bad change on a branch never touched the live site in the first place.

You never have to be afraid of breaking the live site by trying something.

---

## 7. Your job vs Claude's job

**Only you can:**
- Decide what the tools should say and do (the clinical and process truth).
- Give the final clinical sign-off on any medical content.
- Choose to click **Merge** yourself — or tell Claude "you merge it" for a given
  change.

**Claude does everything else:**
- Branching, editing, committing, pushing, opening pull requests, merging.
- Running and fixing the tests.
- Managing issues, labels, and the backlog on GitHub.
- Writing and updating documentation like this file.

The whole point: **your time goes into the medicine and the design, not the
plumbing.**

---

## 8. Where things live (quick map)

| File / folder | What it is |
|---|---|
| `index.html` | the landing page + the site's search index |
| `codes/`, `trauma/`, `peds/`, `ob-neonatal/`, `procedures/`, `airway/`, `arrest/` | the bedside tools, one folder each |
| `clinical-pathways/` | diagnostic pathways (e.g. HEART) |
| `posters/`, `labels/` | printable wall posters and cart/kit labels |
| `debrief/`, `system/` | post-event debrief tool, and the cart/room system map |
| `verify_*.mjs`, `run-tests.sh` | the automated tests and the one-command runner |
| `.github/workflows/verify.yml` | the CI safety-net that runs those tests on every PR |
| `PROJECT.md` | the "why" — the project charter |
| `CLAUDE.md` | the rules Claude follows when editing |
| `DESIGN-SYSTEM.md`, `LAYOUT.md`, `TERMINOLOGY.md` | design, layout, and wording standards |
| `WORKFLOW.md` | this file |
| `LOCALIZING.md` | how another hospital adapts the project for itself |
