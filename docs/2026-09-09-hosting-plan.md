# GitHub hosting migration

Goal: publish both existing game modes at a working URL and save the source privately on GitHub.

Both games run entirely in the browser. GitHub Pages receives a Vite production build of the existing shared components, with dedicated HTML entry points for `/` and `/3d/`. Absolute links and duck assets use the project URL prefix. A separate public repository contains only the seven distributable files, without source maps or server output. The private repository retains the source and history.

- [x] Check GitHub CLI access and existing repository names.
- [x] Prepare the standalone Node.js build; TypeScript, 39 existing tests, and build pass.
- [x] Add `vite.pages.config.ts`, `pages-entry.tsx`, `index.html`, `scripts/prepare-pages.mjs`, and the shared `appUrl` helper.
- [x] Build static output and verify both routes and the duck image over HTTP; both games initialize without console errors in the browser.
- [x] Create private `ArtemiyShisha/quack-prix` and public build-only `ArtemiyShisha/quack-prix-play` repositories.
- [ ] Publish the distributable files on GitHub Pages and verify a complete race at the public URL.
- [ ] Commit and push source, synchronize the original checkout, and hand off the live URL.

The prepared Node/Docker configuration remains available as an optional hosting target. Railway publication was cancelled at the user's request after Railway login proved unavailable. No Railway project or paid service was created.
