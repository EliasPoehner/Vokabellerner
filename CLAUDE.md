# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**F11 HUB** is a browser-based educational gaming portal for a computer science class (F11). It combines arcade/simulation games with school resource aggregation. The UI is in German throughout.

## Hosting

The project is hosted on **Railway** via automatic GitHub deploys.

- Every `git push` to `main` triggers a new deployment automatically.
- Railway detects `package.json`, runs `npm install`, then `npm start` (`serve . -l $PORT`).
- Health-check: Railway polls `/Hub.html` for HTTP 200.
- Config files: `railway.toml` (deploy settings), `package.json` (serve dependency).

Relevant files:
- `railway.toml` — Railway deploy config (health-check path, restart policy)
- `package.json` — only exists for the `serve` dependency; no build step
- `serve.json` — tells `serve` to route `/` → `/Hub.html` (entry point is not index.html)

## Running the Project

```bash
# Local development
npm install
npm start        # serves on http://localhost:3000

# Alternative (no Node required)
python -m http.server 8000
```

Then open `Hub.html` as the entry point. Individual game files can also be opened directly in the browser.

## Architecture

```
Hub.html                         # Main portal (Tailwind CSS + Material Design icons)
Hub/
  Style/hub-style.css            # Shared design tokens — dark/light theme variables
  Sammlung/                      # Game collection
    Dorf/                        # Most complex game (3D village sim)
      dorf.html
      dorf.css
      js/
        data.js                  # All building/resource definitions (static data)
        game.js                  # Game loop, state, resource calculations
        renderer.js              # Three.js scene, camera, UI overlay
    arcade.html / arcade-hub/    # Retro arcade hub with mini-games
    asteroid_blaster.html        # Self-contained space shooter
    solitaire.html               # Solitaire + Spider card games
    runner/runner.html           # Side-scrolling runner
    Klassiker.html               # Classic games portal
  Schule/                        # School resources
    linux.html                   # Linux teaching material
    Notenkalkulator.html         # Grade calculator
    sa3-pruefungsvorbereitung.html
Schulstoff-IntegriertinHub/      # PDFs waiting to be integrated (Linux course)
```

## Dorf Game Architecture

The Dorf game (`Hub/Sammlung/Dorf/`) is the most complex component (~1600 lines across 3 JS files):

- **data.js** — Pure data: all 20+ building types with cost, production rates, worker requirements, and unlock prerequisites. Edit this to add/modify buildings.
- **game.js** — Game loop and state machine: resource ticking, population/morale calculations, event system, prestige/reset logic, UI panel updates.
- **renderer.js** — Three.js r128 scene: isometric camera (4 cardinal rotations, 5 zoom levels), building mesh placement on a 12×12 grid, UI overlay rendering.

Resources: Holz (Wood), Stein (Stone), Nahrung (Food), Gold, Eisen (Iron), Kohle (Coal). Buildings are gated behind a research tree and prestige system.

Known bugs tracked in `Soll Integriert werden - Bugs.txt`: storage overflow at level 10, grid reset on page refresh, market debuffs not applying.

## Tech Stack

- Vanilla JS (no modules/imports — scripts are loaded via `<script>` tags)
- Three.js r128 (CDN) — only used in Dorf
- Tailwind CSS (CDN) — only Hub.html
- Google Material Symbols (CDN) — Hub.html icons
- `serve` (npm) — only used for local dev and Railway hosting; no bundler, no transpilation

## Design System

Two visual styles coexist:

1. **Hub portal** (`Hub.html`): Tailwind utility classes, Material icons, dark purple/blue palette
2. **Games**: Custom CSS per game. Shared tokens in `hub-style.css` use CSS variables for dark/light/school-dark themes. Dorf uses earthy medieval colors; Arcade uses retro neon (Orbitron font, scanlines).

When adding new UI to existing games, follow that game's existing CSS variable and color conventions rather than importing new frameworks.
