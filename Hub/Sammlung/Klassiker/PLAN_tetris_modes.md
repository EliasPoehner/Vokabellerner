# Plan: Tetris Spielmodi + Perks + Events

## Context

Das Tetris-Spiel in `Klassiker.html` hat eine solide Basis (SRS-Kicks, 7-Bag, DAS, Ghost-Piece), aber nur einen einzigen Spielmodus ohne Konfigurationsmöglichkeiten. Ziel ist ein vollständiges Modus/Perk/Event-System. Das gesamte Tetris-JavaScript wird dabei in eine eigene Datei `tetris.js` ausgelagert, damit `Klassiker.html` übersichtlich bleibt.

---

## Dateien

| Datei | Änderung |
|---|---|
| `Klassiker.html` | HTML-Struktur anpassen, `<script src="tetris.js">` einfügen, Tetris-JS entfernen |
| `Klassiker.css` | Neue Styles anhängen |
| `tetris.js` | **NEU** — gesamtes Tetris-JS (ausgelagert aus HTML) |

---

## Schritt 0: JS-Auslagerung (Voraussetzung für alles andere)

Alle Tetris-Variablen und -Funktionen aus `Klassiker.html` (ca. Zeile 436–677 im `<script>`-Block) werden in `tetris.js` verschoben. In `Klassiker.html` bleibt nur:

```html
<script src="tetris.js"></script>
```

Die anderen Spiele (Minesweeper, Snake, 2048, Pong, Tron) bleiben im bestehenden `<script>`-Block von `Klassiker.html`. Tetris-spezifische Konstanten (`TW`, `TH`, `BS`, `PIECES`, `KICKS_NORM`, `KICKS_I`, `PTS`, `DAS_DELAY`, `DAS_REPEAT`) kommen ebenfalls in `tetris.js`.

---

## Neue Features im Überblick

### 5 Spielmodi
| Modus | Beschreibung |
|---|---|
| **Klassisch** | Standard Tetris (wie bisher) |
| **Blitz** | 2 Minuten Countdown, Level bleibt bei 1, max. Punkte |
| **Sprint** | 40 Linien so schnell wie möglich, Stoppuhr läuft mit |
| **Überleben** | Board startet mit 4 Garbage-Reihen von unten |
| **Unsichtbar** | Gelegte Steine werden unsichtbar (nur Umriss) |

### 4 Perks (vor Spielstart ein-/ausschaltbar)
- **Geist** — Ghost-Piece (aktuell immer an, jetzt optional)
- **Halten** — Hold-Piece (Taste C/Shift), eigenes Canvas links
- **Vorschau 3** — Zeigt die nächsten 3 Steine statt 1
- **Sanfter Lock** — Lock-Delay 1000ms statt 500ms

### 6 Events (zufällig alle 15–30 Sek., einzeln ein-/ausschaltbar)
- **Erdbeben** — Canvas wackelt 2 Sek. (CSS-Animation)
- **Zeitlupe** — Fallgeschwindigkeit halbiert für 5 Sek. + Blau-Tint
- **Farbchaos** — Aktuelle und folgende Steine bekommen Zufallsfarbe für 10 Sek.
- **Müllregen** — Sofort 1 Garbage-Reihe von unten (mit Lücke)
- **Dunkelheit** — Gelegte Steine werden auf 15% Opacity gedimmt für 3 Sek.
- **Formwechsel** — Aktueller Stein bekommt zufällig eine andere Form

---

## Implementierungsschritte

### 1. Neue State-Variablen (in `tetris.js`, nach bestehenden Variablen)

```javascript
let tMode = 'klassisch'; // 'klassisch'|'blitz'|'sprint'|'ueberleben'|'unsichtbar'
let tPerkGhost = true, tPerkHold = false, tPerkPreview3 = false, tPerkSoftLock = false;
let tEventsEnabled = false;
let tEventPool = ['erdbeben','zeitlupe','farbchaos','muellregen','dunkelheit','formwechsel'];
let tHold = null, tHoldUsed = false, tHoldCtx = null;
let tPreviewCtxs = [], tBagQueue = [];
let tBlitzTimeLeft = 120000, tSprintStart = 0, tSprintTime = 0;
let tEventShakeEnd=0, tEventZeitlupeEnd=0, tEventFarbchaosEnd=0, tEventDunkelheitEnd=0;
let tEventColors = null, tCanvasWrap = null;
let tNextEventIn = Infinity;
const EVENT_MIN = 15000, EVENT_MAX = 30000;
```

### 2. HTML: `#screen-tetris` ersetzen

Neue Struktur:
- **Setup-Overlay** `#tetris-setup-overlay` (Pre-Game, anfangs sichtbar): Modus-Karten, Perk-Toggles, Event-Toggles, SPIELEN-Button
- **Timer-Bar** `#tetris-timer-bar` (nur Blitz/Sprint): Label + Zeitanzeige + Fortschrittsbalken
- **Event-Badge** `#tetris-event-badge`: absolut positioniert, zeigt aktives Event an
- **Hold-Panel** `#tetris-hold-panel` (links vom Board, nur wenn Perk aktiv): Label + 84×84 Canvas
- **Canvas-Wrapper** `#tetris-canvas-wrap`: umschließt nur `tetris-canvas` → CSS `transform` für Erdbeben
- **Erweiterte Seite**: `next-canvas-2` + `next-canvas-3` für Vorschau-3-Perk (standardmäßig `display:none`)
- **Linien-Anzeige** `id="tetris-lines"` in der Seitenleiste
- **Game-Over-Overlay**: ergänzt um `tetris-over-time` für Sprint-Endzeit

Setup-Overlay zeigt:
- 5 Modus-Karten (klickbar, active-Klasse beim gewählten)
- 4 Perk-Toggles (CSS-Pill-Switch)
- Master-Toggle für Events + aufklappbares Grid mit 6 Event-Checkboxen
- `SPIELEN ▶` Button → `tetrisStartFromSetup()`

"Reset"-Button wird zu "↺ Modus" → öffnet Setup-Overlay statt Sofort-Reset.

### 3. CSS-Ergänzungen in `Klassiker.css`

- `#tetris-setup-panel`: Panel-Box mit `var(--cyan)`-Border + Glow
- `.setup-section-label`: 7px Press-Start-2P, uppercase, dimmed
- `#mode-cards` + `.mode-card`: Flex-Grid, `.active` mit Cyan-Border + Glow
- `.toggle-row` + `.tog-wrap` + `.tog-slider`: CSS-only Pill-Toggle (kein Framework)
- `.event-pool-grid`: 3-Spalten-Grid für Event-Checkboxen
- `#tetris-hold-panel` + `#hold-canvas`: linkes Panel, grauer Hintergrund
- `#tetris-timer-bar` + `#tetris-timer-fill`: Fortschrittsbalken; `.danger`-Klasse bei <20s (pink, pulsierend)
- `#tetris-event-badge`: absolut rechts, `@keyframes badgePop` für Entrance
- `#tetris-canvas-wrap.shaking`: `@keyframes tetrisShake` (loopend, 150ms)
- `#tetris-canvas-wrap.zeitlupe::after`: blaues Overlay via `::after` Pseudo-Element
- `@media(max-width:600px)`: Hold-Panel verstecken, kleinere Modus-Karten

### 4. JS-Funktionen in `tetris.js` (neu + modifiziert)

#### Neue Hilfsfunktionen
- `tEnsureQueue()` — hält `tBagQueue` auf min. 4 Einträge aufgefüllt
- `nextFromBag()` — shifted aus `tBagQueue` statt direkt aus `tBag`
- `_drawPieceOnCanvas(ctx, w, h, piece)` — extrahierte Render-Logik für alle 4 Canvasse
- `tSelectMode(mode, el)` — setzt `tMode`, wechselt `.active`-Klasse
- `tetrisShowSetup()` — pausiert Spiel, zeigt Setup-Overlay
- `tetrisStartFromSetup()` — liest Checkboxen → `initTetris()` → `tetrisToggle()`
- `tUpdateHoldVisibility()` / `tUpdatePreviewVisibility()` — zeigt/versteckt Panels
- `tDoHold()` — Hold-Logik: erstes Halten stasht + spawnt, danach Swap; ein Hold pro Piece
- `drawHoldPiece()` — zeichnet Hold-Canvas, verdunkelt wenn `tHoldUsed`
- `tAddGarbageRows(n)` — fügt n Garbage-Reihen unten ein (mit zufälliger Lücke, Farbe `#4a4a6a`)
- `tickEvents(dt, now)` — zählt `tNextEventIn` runter, feuert Event, räumt abgelaufene auf
- `triggerEvent(name, now)` — führt Effekt aus, setzt End-Timer, zeigt Badge
- `tHideBadge()` — versteckt Badge nur wenn kein Event mehr aktiv
- `tUpdateBlitzHUD()` / `tUpdateSprintHUD()` — aktualisiert Timer-Bar
- `tShowGameOver(sprintWin)` — einheitliche Game-Over-Logik inkl. Sprint-Sonderfall

#### Modifizierte Funktionen
- `initTetris()`: Initialisiert `tHoldCtx`, `tCanvasWrap`, `tPreviewCtxs`; Mode-spezifisches Init; Event-State reset
- `tSpawn()`: setzt `tHoldUsed = false`
- `tLock()`: Blitz ohne Level-Scaling; Sprint-Win-Check bei 40 Linien; Farbchaos-Farbe in `tBoard`
- `tetrisLoop(now)`: Blitz-Countdown; Sprint-Stoppuhr; `tickEvents`; `speedMod` für Zeitlupe; `lockLimit` für Sanfter-Lock
- `drawTetris()`: Unsichtbar (nur Umriss); Dunkelheit (`globalAlpha=0.15`); Ghost-Perk-Flag; Farbchaos-Farbe
- `drawNextPiece()`: ruft `_drawPieceOnCanvas` auf; Vorschau-3 zeigt `tBagQueue[0..1]`
- Keydown-Handler: C/Shift → `tDoHold()`

### 5. Reihenfolge der Implementierung

1. **Tetris-JS in `tetris.js` auslagern** — HTML-Script-Block bereinigen, `<script src="tetris.js">` einfügen, Browser-Test
2. State-Variablen in `tetris.js` hinzufügen
3. HTML-Struktur von `#screen-tetris` ersetzen
4. CSS-Ergänzungen in `Klassiker.css` anhängen
5. `tEnsureQueue()` + `nextFromBag()` refactorn
6. Setup-Overlay-Funktionen implementieren
7. `initTetris()` erweitern
8. `tSpawn()`, `tLock()`, `tetrisLoop()` anpassen
9. `drawTetris()` + `drawNextPiece()` + `_drawPieceOnCanvas()` anpassen
10. Hold-System implementieren (`tDoHold`, `drawHoldPiece`)
11. Event-System implementieren (`tickEvents`, `triggerEvent`, `tHideBadge`)
12. HUD-Updater + `tShowGameOver()` hinzufügen
13. Keydown-Handler um Hold-Taste erweitern

---

## Besondere Hinweise

- **Unsichtbar + Ghost**: In `initTetris()` wird `tPerkGhost = false` erzwungen wenn `tMode === 'unsichtbar'`
- **Hold Shape**: Beim Stashen immer aus `PIECES`-Tabelle die ungedrehte Originalform nehmen
- **Müllregen**: Nach Einfügen prüfen ob `tPiece` kollidiert → `tPiece.y--` als Korrektur
- **Farbchaos**: Farbe wird in `tBoard` eingeschrieben — Stein bleibt nach Event-Ende in der Chaos-Farbe
- **Blitz-Level**: Bleibt konstant 1, Speed erhöht sich nie
- **Erdbeben**: Nur CSS-Klasse auf `#tetris-canvas-wrap`, kein JS-`setInterval` auf `transform`
- **Keine anderen Spiele berühren**: Minesweeper, Snake, 2048, Pong, Tron bleiben unverändert

---

## Verifikation

1. Alle 5 Modi starten und durchspielen
2. Jeden Perk einzeln ein-/ausschalten und Effekt prüfen
3. Events-Master einschalten, warten bis Event feuert (~15–30 Sek.), Badge erscheint, Effekt aktiv, endet nach Ablauf
4. Modus-Button öffnet Setup-Overlay; Einstellungen bleiben beim Neustart erhalten
5. Keine Regression bei anderen Spielen
