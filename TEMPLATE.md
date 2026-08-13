# This branch is a template, not a manual

Everything here works. None of it is about your hospital yet, and — this is the
point — none of it is about anyone else's either.

`main` is Littleton Regional Hospital's live manual. This branch is the same
source tree with every site-specific value pulled out into one answer sheet,
`site.config.json`, which currently answers **nothing**. Open any page and it
says so, in a red bar, on every screen.

```
node build.mjs          # → dist/, plus a localization report
bash run-tests.sh       # the full suite, green against a blank answer sheet
```

---

## Why a blank template is safer than a pre-filled one

The obvious way to make a forkable manual is to ship a working one and tell the
next hospital to change what does not apply. That fails in a specific way, and
it fails quietly.

A resuscitation card does not look uncertain. It has a header, a checklist, a
citation and a version stamp, and it reads with exactly the same authority
whether the number in it came from your lab or from a lab six hundred miles
away. So the sentences that carry the most risk are not the ones a fork
notices and edits — they are the ones nobody thinks to question:

> LRH has no on-site cath lab.
> LRH is a Level III trauma center without in-house neurosurgery.
> The Minnesota tube is not stocked at LRH.
> Platelets are often unavailable at LRH.

Rename LRH to your abbreviation and every one of those becomes a **false
statement about your department, in your own name**, sitting inside a checklist
somebody is following at three in the morning. That is worse than an obviously
blank field, because a blank field sends someone to find the answer.

So this branch does not rename them. It removes them, and replaces each with the
question it was an answer to.

---

## How it works

Four files, and one rule.

| File | What it is |
|---|---|
| `localization.manifest.mjs` | The **questions**. Every site-specific value, with what it drives, who at your hospital knows the answer, and whether it blocks go-live. |
| `site.config.json` | The **answers**. Generated from the manifest; `null` everywhere on this branch. |
| `site.config.lrh.json` | A **worked example** — LRH's real answers, so you can see the shape of a complete sheet. Never copy it. |
| `build.mjs` | Substitutes `{{tokens}}` at build, and reports how localized the result is. |

**The rule: an unanswered value has no default.** It renders a loud placeholder
(`«LIKE THIS»`), it is counted in the build output, and where a screen would
have to *calculate* with it, the screen refuses instead:

- `/clinical-pathways/heart/` will not classify a troponin. It names the missing
  keys and points at the onboarding section.
- `/arrest/` prints no joule value on the shock control.
- `/trauma/`'s tap-to-call transfer link is inert and says `NO TRANSFER CENTER SET`.
- `/tca/` does not pick a team model — sequential and simultaneous are different
  algorithms, and defaulting to one is guessing how many people arrive at 3am.
- `/codes/` card 21 asks whether it applies at all, because its whole structure
  is the pathway for a department without on-site PCI.

A fully answered site sees none of this. The red bar is gone, the placeholders
are values, and the screens compute. Prove it in one command:

```
SITE_CONFIG=site.config.lrh.json node build.mjs && SITE_CONFIG=site.config.lrh.json bash run-tests.sh
```

That build reports **68/69 answered** and the suite is green — the same suite
that is also green against a blank sheet. Two different correct states, one
source tree.

---

## What the tests prove

`verify_localization.mjs` builds the site three times in one run and asserts
each result:

1. **Blank** — every required answer reported missing, the bar present, the
   chest-pain pathway refusing to classify, the transfer link dialing nothing.
2. **No leakage** — eleven screens scanned for the source hospital's name,
   abbreviation, domain, transfer center, transfer number, and its two
   capability claims. All must be absent.
3. **A different hospital** — a fabricated fork with a different assay
   (rule-in at 52, not 50), a different defibrillator (150/200/200), a cath
   lab, a full trauma team. Every screen must follow *its* answers, while the
   clinical invariants hold: energies still escalate and then plateau.
4. **Mutation** — an answer is deleted, and separately the pathway's `>=` is
   flipped to `>`. Both must change what the screen does. Three green runs are
   not evidence unless a broken one goes red.

The other suites were converted at the same time: where one used to re-type an
LRH string, it now reads `verify_site_config.mjs` and asserts against whatever
this deployment's answer sheet says. A fork that localizes correctly stays
green — which matters, because a suite that turns red for doing the right thing
teaches its champion that red runs are normal, at the moment the harness is the
only thing protecting them.

---

## What was deliberately left in, and why

Not everything with a number in it is localization.

**Universal clinical values stayed.** Adult epinephrine 1 mg every 3–5 minutes,
compressions at 100–120, the 2-minute cycle, the DAS 2025 attempt ceilings, the
HEART score's own 1×/3× multiplier, NRP's 3:1. These come from published
guidelines, not from this building. Blanking them would not make a fork safer;
it would make the manual useless while teaching its champion that empty fields
are normal.

**Clinical structure stayed and is enforced.** Energies escalate then plateau.
A per-kg pediatric dose is capped at the adult ceiling. Adult TXA is fixed while
pediatric TXA is per-kg. The airway ladder runs A → B → C → D. DAS publishes no
SpO₂ cut-off. The PHI guards. A fork can localize its numbers; it cannot
localize these away, and the suites say so.

**The `lrh-` storage namespace became `edm-`.** Invisible to a user, but it was
still another hospital's name on your device state. `CASE-STATE.md` and the
security workflow's namespace gate moved with it.

---

## Known gaps, stated plainly

- **`inventory.js` locations are structural, not verified.** Room names are now
  tokens, but the drawer-by-drawer layout is still shaped by one department's
  carts. `INVENTORY-DESIGN.md`'s own rule applies: an item with no entry has
  *not been looked at*, which is not the same as missing. Treat the whole
  `INV_LOCATIONS` block as unreviewed until a champion walks the carts.
- **mBIG routing in `/trauma/` is unset, not defaulted.** Which tier you admit
  and which you transfer is a bilateral agreement with your receiving center.
  The card now says so instead of describing somebody else's agreement.
- **Poster and label QR codes** encode `{{site.domain}}`. Do not print anything
  until that is answered — a laminated wrong link outlives the mistake by years.
- **Version numbers are upstream's; review dates are yours.** The stamp reads
  `NOT LOCALLY REVIEWED` until `review.reviewer` and `review.date` are set.

---

## Regenerating this branch

`main` keeps moving. When it does:

```
git checkout -B template origin/main
node strip_localization.mjs        # rules + an audit of what they missed
node gen_site_config.mjs
node build.mjs && bash run-tests.sh
```

`strip_localization.mjs` holds every rule as an explicit pair, and ends with two
reports: which rules matched nothing (the source moved), and which lines still
name this site (a value nobody has classified yet). Both should be empty. A
hand-made strip decays the moment someone adds a card that says "we have no
cath lab"; this one fails loudly instead.

---

## Next

This branch is the empty form. The branch that teaches you how to fill it in —
question by question, with simulations that surface what the questions miss — is
`claude/localization-onboarding-afuhas`, and its entry point is `ONBOARDING.md`.
