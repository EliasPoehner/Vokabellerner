# F11 HUB — Projektplan: Stack-Migration

Stand: 2026-06-09

## Übersicht

Migration von Vanilla-JS-CDN-Ansatz zu Vite + TypeScript + Hono-Server mit Docker-Deployment.
Spiele bleiben Canvas-basiertes Vanilla JS/TS — kein React, kein Next.js.

---

## Phase 0: Sofortmaßnahmen ✅

- [x] Projektplan erstellt (`Projektplan.md`)
- [x] CLAUDE.md aktualisiert (Migration dokumentiert)
- [x] Memory-Datei für zukünftige Konversationen erstellt

---

## Phase 1: Fundament (Build-Stack + Deployment) ✅

- [x] `package.json` neu erstellen — Abhängigkeiten: `vite`, `typescript`, `hono`, `tailwindcss`
- [x] `vite.config.ts` mit Multi-Page-Setup (Hub.html + alle Spielseiten)
- [x] `tsconfig.json` mit `allowJs: true` (inkrementelle Migration, kein Rewrite)
- [x] `tailwind.config.js` erstellen (ersetzt Inline-Konfiguration in Hub.html)
- [x] Three.js: CDN r128 → npm r176 in `dorf.html` (via `js/init-three.js` Shim)
- [x] `Dockerfile` erstellen (Multi-Stage: Build + Runtime)
- [x] Docker-Build lokal getestet (`npm run build` ✓)

---

## Phase 2: Dorf — TypeScript-Migration ✅

- [x] `types.ts` — Interfaces: GameState, BuildingDef, ResearchDef, ObstacleDef, GameCallbacks
- [x] `state.ts` — Singleton `S: GameState` als ES-Modul (shared mutable state)
- [x] `data.ts` — TIERS, BUILDINGS, RESEARCH, OBSTACLES als typed exports (EVENTS in game.ts)
- [x] `renderer.ts` — Three.js r176 via npm, `// @ts-nocheck`, window-Globals → Modul-Vars, GameCallbacks-Injection via `setGameCallbacks()`
- [x] `game.ts` — Spiellogik als ES-Modul, EVENTS inline (nach Funktionsdefs), alle exports
- [x] `main.ts` — Einstiegspunkt: callbacks wired, window-Exposes, Init, `setInterval(tick, 100)`
- [x] `dorf.html` — 4 Script-Tags → `<script type="module" src="js/main.ts">`
- [x] `vite.config.ts` — static-copy für Dorf-JS-Dateien entfernt
- [x] `data.js`, `game.js`, `renderer.js` entfernt (`git rm`)
- [x] Build-Test: `npm run build` ✓ (7.79s, Dorf-Bundle ~570 kB inkl. Three.js)
- [ ] Dorf smoke-test: Spiel lädt, Gebäude platzieren, Kamera-Rotation, Prestige-Reset

---

## Phase 3: Server-Layer (Hono API) ✅

- [x] `server/index.ts` — Hono-App, statische Dateien aus `dist/` servieren
- [x] `GET/POST /api/scores/:game` — Highscore-Tabellen
- [x] `GET/POST /api/saves/:game` — Spielstand server-seitig speichern (ersetzt localStorage-Fallback)
- [x] Persistenz: JSON-Flatfile (`data/saves/`, `data/scores/`) — reicht für Einzelplayer-Setup
- [x] Dorf-Client: Save/Load auf API umstellen

---

## Phase 4: Weitere TS-Migration (parallel zum laufenden Betrieb)

- [x] `tetris.js` → `tetris.ts`
- [x] `Hub.html` Inline-Scripts extrahieren und typisieren
- [ ] `asteroid_blaster.html`, `solitaire.html` — später, niedrige Priorität

---

## Was NIE gemacht wird

| Idee | Grund |
|---|---|
| React für Spiele | Canvas ≠ React, Overhead ohne Gewinn |
| Next.js / SSR | Browser-Games laufen im Client, kein SSR nötig |
| Babylon.js statt Three.js | Kompletter renderer.js-Rewrite (2.326 Zeilen) |
| ECS-Architektur für Dorf | 6–10 Wochen Aufwand für laufendes Spiel |
| Webpack statt Vite | Vite ist schneller, einfacher, moderner |

---

## Deployment-Ziel

Lokales Hosting via Docker:

```bash
npm run dev                                        # Vite Dev-Server mit HMR (localhost:3000)
npm run build                                      # Produktions-Build → dist/
docker build -t f11hub . && docker run -p 3000:3000 f11hub   # Docker lokal
```
