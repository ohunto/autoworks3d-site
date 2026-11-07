# AutoWorks3D website

The public landing page for [autoworks3d.com](https://autoworks3d.com), with links to our Etsy and eBay shops.

## Structure

- `index.html` — page content, shop links, and search/social metadata
- `assets/styles.css` — responsive layout, lighting, and visual styles
- `assets/background.js` — animated shooting stars, drifting trails, and a faint star field
- `assets/favicon.svg` — browser icon
- `CNAME` — custom domain for GitHub Pages
- `robots.txt` and `sitemap.xml` — search-engine discovery
- `.github/workflows/pages.yml` — checked, allowlisted deployment

No framework, package installation, build system, analytics, or backend is required. Inter is loaded from Google Fonts with a system-font fallback. All artwork is procedural; no product models or private files are used.

## Local preview

From this repository, run `python3 -m http.server 8000 --bind 127.0.0.1`, then visit `http://127.0.0.1:8000`. Check the page at both desktop and mobile widths and verify both shop links before publishing. `node --check assets/background.js` checks JavaScript syntax.

Motion respects the operating system's reduced-motion preference and stops while the tab is hidden. Shop links remain usable without JavaScript. Shooting stars take a new route on each pass. A star or pointer crossing a visible trail disperses part of that trail, with a weaker response as it fades. Two stars that meet flash briefly and go out. A passing star can briefly nick the wordmark, and an occasional amber meteor lights up a corner after it leaves the screen.

## Publishing

Push to `main` to run the GitHub Pages workflow. It checks JavaScript and uploads only `index.html`, `assets/`, `CNAME`, `robots.txt`, and `sitemap.xml`. Repository documentation and configuration are not part of the deployed artifact. Actions are pinned to full commit IDs, with deployment permissions limited to the deployment job.

GitHub Pages uses the custom domain `autoworks3d.com`. DNS is managed separately at the domain registrar. Keep `CNAME` and the canonical URL consistent if the domain changes. Enable HTTPS enforcement in the repository's Pages settings.

## Public repository boundary

This repository contains public website material only. Business records, customer information, credentials, CAD models, production data, and private notes belong outside this repository. A `.gitignore` reduces accidental commits but is not a substitute for reviewing staged files. Never copy the surrounding workspace into this checkout or its deployment artifact.
