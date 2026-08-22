# Redesign starter kit

Working artifacts, proven against `sources/`. Drop these into the repo root
(except the reference page) before starting the run.

| File | Goes to | What it is |
|---|---|---|
| `design-system.css` | repo root | The base layer, v0.2.0. Tokens, two-row bar, primitives, focus, print. Replaces the three existing sheets' base half. |
| `verify_verb_grammar.mjs` | repo root | Enforces the verb lexicon, row grammar, one-control-per-row, no displayed card numbers, and speakability. Mutation-tested: 8/8 injected violations caught. |
| `verify_content_invariance.mjs` | repo root | The check that makes an unattended rewrite safe. Two modes — restyle (prose blocking) and `--distill` (prose reported to `CUTS.md`). |
| `content-exceptions.json` | repo root | Declared-exception format, with two real entries as the model. |
| `sources-index.reference.html` | keep as reference | `sources/index.html` rewritten. Worked example of every primitive. |
| `dka-index.reference.html` | keep as reference | `clinical-pathways/dka/` rewritten verb-first, cut 35%. Worked example of step rows, branch rows, and a clinical page with zero page-local CSS. |
| `row-grammar.reference.html` | keep as reference | The three row types on one card, including inline links with no card numbers. |
| `example-dka.png`, `example-row-grammar.png` | reference | What both look like rendered on a phone. |

## Using the check

```bash
# before touching anything
node verify_content_invariance.mjs snapshot . content-before.json

# ... rewrite ...

node verify_content_invariance.mjs snapshot . content-after.json
node verify_content_invariance.mjs compare content-before.json content-after.json
# and for the text-reduction pass:
node verify_content_invariance.mjs compare content-before.json content-after.json --distill
```

The cairn back mark lives inline in the reference page as an SVG `<symbol>`.
In production it is injected at a build marker, never pasted per page.


## Page kinds

Every page declares what it is:

```html
<body data-page="protocol">   <!-- read aloud, verb-first grammar enforced -->
<body data-page="reference">  <!-- provenance, indexes, explainers -->
```

Speakability, card-number and one-control-per-row rules apply to both. The
verb-first rule applies only to protocol pages — forcing a verb onto an
explanatory row produces worse writing, not better.

## Running the suites

```bash
node verify_verb_grammar.mjs .          # grammar, across every page
node verify_content_invariance.mjs snapshot . content-before.json
# ... rewrite ...
node verify_content_invariance.mjs snapshot . content-after.json
node verify_content_invariance.mjs compare content-before.json content-after.json
node verify_content_invariance.mjs compare content-before.json content-after.json --distill
```
