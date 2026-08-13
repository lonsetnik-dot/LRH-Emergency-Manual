# ED Clinical Support Tools — template

Static site hosting personal, unofficial clinical decision-support tools.
**Not part of any hospital IT system / EHR.** Nothing here replaces clinical judgment.

## Structure

```
index.html                          landing page       ->  /
clinical-pathways/heart/index.html  HEART pathway      ->  /clinical-pathways/heart/
ob-neonatal/index.html              OB & neonatal      ->  /ob-neonatal/
code-cart/                          (planned tool)     ->  /code-cart/
netlify.toml                        Netlify config (publishes the repo root)
```

The landing page is the only top-level `index.html`. Every other tool lives in
its own folder and keeps the name `index.html` inside that folder, which is what
gives each tool its own clean URL. Tools may be grouped into category folders
(e.g. `clinical-pathways/`). Use lowercase, hyphenated folder names — no spaces,
since folder names become the public URL.

Old URLs `/heart/` and `/ob/` are preserved via redirects in `netlify.toml`, so
existing bookmarks keep working after the move to category folders.

## Add a new tool

1. Create the tool's folder — either under a category (`clinical-pathways/sepsis/`)
   or at the top level (`sepsis/`) — and put the tool's file inside it as `index.html`.
2. In `index.html`, copy one of the `<a class="tool">` cards and set its `href` to that folder.
3. Commit. Netlify redeploys automatically.

## Update a tool

Edit the file (e.g. `clinical-pathways/heart/index.html`), commit the change.
Netlify redeploys just that change — no need to re-upload the whole site.

## Deploy

Connected to Netlify via continuous deployment: every push to the default
branch publishes automatically.
