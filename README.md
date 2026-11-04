# AutoWorks3D website

The public landing page for [autoworks3d.com](https://autoworks3d.com), with links to our Etsy and eBay shops.

## Structure

- `index.html` — page content, shop links, and search/social metadata
- `assets/styles.css` — responsive layout, lighting, and visual styles
- `assets/background.js` — background video playback and motion preferences
- `assets/media/` — optimized silent factory loop and still-image fallback
- `assets/favicon.svg` — browser icon
- `assets/fonts/` — locally hosted Manrope font and its open-font license
- `CNAME` — custom domain for GitHub Pages
- `robots.txt` and `sitemap.xml` — search-engine discovery
- `.github/workflows/pages.yml` — checked, allowlisted deployment

No framework, package installation, build system, analytics, or backend is required. Manrope is hosted locally with a system-font fallback. The background uses licensed stock footage; no private files or product models are used.

## Local preview

From this repository, run `python3 -m http.server 8000 --bind 127.0.0.1`, then visit `http://127.0.0.1:8000`. Check the page at both desktop and mobile widths and verify both shop links before publishing. `node --check assets/background.js` checks JavaScript syntax.

Motion respects the operating system's reduced-motion preference and browser data-saving setting, can be paused with the footer control, and stops while the tab is hidden. Visitors with reduced motion or data saving enabled see the poster without downloading the video unless they choose Play motion. The poster and both shop links remain usable without JavaScript. Autoplay rejection leaves a manual play control; video errors fall back to the poster. The locally served H.264 loop is silent, 1280 × 720 at 24 fps, slowed with a blended loop transition.

## Media credits

The decorative factory background is adapted from [Automated Car Factory by Engin Altundağ](https://www.pexels.com/video/automated-car-factory-6450803/), used under the [Pexels License](https://www.pexels.com/license/) (reviewed November 4, 2026). The footage is cropped responsively, softened, desaturated, slowed, and looped for this page. It is stock imagery, not a representation of an AutoWorks3D facility. The source download is kept outside this repository; only the website-ready loop and poster belong here.

Manrope is distributed under the SIL Open Font License; its license is included in `assets/fonts/`.

## Publishing

Push to `main` to run the GitHub Pages workflow. It checks JavaScript and uploads only `index.html`, `assets/`, `CNAME`, `robots.txt`, and `sitemap.xml`. Repository documentation and configuration are not part of the deployed artifact. Actions are pinned to full commit IDs, with deployment permissions limited to the deployment job.

GitHub Pages uses the custom domain `autoworks3d.com`. DNS is managed separately at the domain registrar. Keep `CNAME` and the canonical URL consistent if the domain changes. Enable HTTPS enforcement in the repository's Pages settings.

## Public repository boundary

This repository contains public website material only. Business records, customer information, credentials, CAD models, production data, and private notes belong outside this repository. A `.gitignore` reduces accidental commits but is not a substitute for reviewing staged files. Never copy the surrounding workspace into this checkout or its deployment artifact.
