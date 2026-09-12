# Wesche Lab

Static GitHub Pages landing page, research directory and artifact archive.

## Update selected work

1. Edit `tools/experiments.json` for gallery entries, model labels, public paths and disclosures.
2. Edit `tools/curated-recipes.json` for the homepage research list.
3. Edit `tools/index.template` for homepage copy and layout; shared styles/interactions live in `lab.css` and `lab.js`.
4. Run from the repository root:

   ```sh
   python3 lab/tools/build.py
   ```

The builder generates `index.html`, `catalog.json` and `archive/index.html`. It discovers HTML under `/lab/` and `/dgx/`, excluding the generated indexes and build templates. The independent `/lab/research/` directory uses its own public repository catalog; keep its static HTML synchronized when adding a repository.

## Evidence and media

- `experiments/*/evidence.json` binds each new recording to its source video hash, spatial crop, output hash and saved per-arm metadata.
- Original and repaired HTML are distinct files. Do not silently repair either or replace one with the other.
- New comparison recordings remove historical stat boards through a documented crop. They retain the source timeline/cadence; video frame rate is not a model or browser-performance claim.
- Homepage video is user-initiated (`preload="none"`), not an autoplaying background. Thumbnails are real artifact captures, not synthetic artwork.
- The archive indexes publication, not a guarantee that every historical artifact works.
- Root benchmark status notes can become stale. A new leaderboard claim requires the exact run's verifier, not a name match or an old summary.

## Before publishing

Test desktop, tablet, 390px and 320px layouts; filters and search; empty/reset states; keyboard focus; reduced motion; no-JS content; image loading; video playback; same-origin paths and external links. Check one H1, unique IDs, canonical/OG tags and sitemap entries. Keep existing artifact URLs unchanged. Verify the deployed page and media after push, not just the Git result.
