# Agent guide

This repository is for a browser-based pixel art space adventure. Read [spec.md](spec.md) before changing gameplay or architecture.

## Working on the project

- Keep the game playable on GitHub Pages. Use static files and browser-compatible code; do not require a server for the game to run.
- Build in small, playable steps. Keep the ship-building, movement, combat, crew, and event systems consistent with `spec.md`.
- Favor clear controls, readable pixel art, and useful feedback for player actions.
- Update `spec.md` when a gameplay decision becomes concrete or a planned mechanic changes. Document any build or deployment steps in `README.md`.
- Check the relevant behavior before committing. If automated tests exist, run the relevant ones; otherwise, test the affected gameplay in a browser when possible.
- Preserve unrelated work and avoid destructive Git commands or force pushes.

## GitHub workflow

For every completed task, commit the finished changes and push the commit to the appropriate branch on `origin` (the GitHub repository). Do not leave completed work only in the local checkout. If a push fails, report the reason and the exact local commit so it can be published later.
