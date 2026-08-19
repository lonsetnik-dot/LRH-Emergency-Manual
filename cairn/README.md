# cairn/ — the cairnready.org outreach site

The public explainer + sign-up page for Cairn, the open-source rural-ED
readiness project this manual is the reference implementation of. It is **not
part of the manual**: `build.mjs` skips this folder, so nothing here ships to
lrhemergencymanual.net or enters the offline precache.

Fully self-contained static site — no CDN, no build step. `index.html` carries
the page; `assets/` holds React and the dc-runtime it renders with; `fonts/`
holds the Atkinson Hyperlegible + Bitter subsets.

## Deploying as cairnready.org

1. Netlify → **Add new site → Import an existing project** → this repository.
2. Set **Base directory** to `cairn` (it will pick up `cairn/netlify.toml`:
   no build command, publish in place).
3. Domain settings → add `cairnready.org` and point the domain's DNS at
   Netlify.
4. The "Join the network" form posts to **Netlify Forms** (form name `join`).
   Check Netlify → Forms after the first deploy to confirm it was detected,
   and set up an email notification for new submissions.

The page content came from the "Cairn Rural ED Readiness" design artifact
(2026-08-16). To update the page, edit `index.html` — the prose and the
interactive demo script live inline in it.
