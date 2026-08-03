# /ob — LRH OB Emergencies (beta)

Live at <https://lrhemergencymanual.net/ob/>

Static, self-contained. Serve this folder at `/ob` and link to it from the root index:

    <a href="/ob/">OB &amp; neonatal emergencies</a>

## Files

- `index.html` — the whole app. No external assets, no build step.
- `manifest.webmanifest`, `icon.svg` — Add to Home Screen as a standalone app.
- `sw.js` — offline cache. All paths are relative, so the folder works at any base path.

## Deploying an update

1. Replace `index.html`.
2. Bump `CACHE` in `sw.js` (e.g. the date), or phones keep serving the old copy.
3. Commit and push. GitHub Pages, Netlify and Cloudflare Pages all serve this as-is.

Offline install needs HTTPS; the service worker is skipped on `file://` and plain HTTP.

## Netlify

`netlify.toml` at the repo root publishes the repo as-is and sets `no-cache` on
`index.html`, `sw.js` and the manifest, so a push reaches phones on the next open
instead of being pinned by the CDN. Deploy settings: no build command, publish
directory `.`. Both `/ob` and `/ob/` serve the app.

