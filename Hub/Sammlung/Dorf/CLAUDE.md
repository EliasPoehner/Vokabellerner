# CLAUDE.md — Dorfchronik 3D

Dieses Dokument beschreibt die Architektur, Designentscheidungen und geplante Features für das Dorf-Spiel.

## Tech-Stack

- Vanilla JS, kein Bundler, keine Module — alles via `<script>`-Tags
- Three.js r128 (CDN) für die 3D-Szene
- Kein npm, kein TypeScript
- State wird als JSON in `localStorage` unter `dorfchronik_3d_v1` gespeichert

## Dateistruktur

```
dorf.html        — Layout, Panels, Modals, Script-Einbindung
dorf.css         — Styling (earthy medieval palette, CSS-Variablen)
js/
  data.js        — Statische Daten: Gebäude, Forschungen, Events (nur Daten, keine Logik)
  game.js        — Spielzustand (S), Game-Loop, Ressourcen-Tick, Population, Events, UI-Updates
  renderer.js    — Three.js-Szene, Grid, Kamera, Gebäude-Meshes, Interaktion
```

**Ladepflicht**: `data.js` → `game.js` → `renderer.js` (in dieser Reihenfolge)

## Spielzustand (S)

Alles was zum Speichern gehört, liegt in `S`. Wird in `localStorage` als JSON gespeichert.

```javascript
S = {
  res: { holz, stein, nahrung, gold, eisen, kohle },
  lager: { holz, stein, nahrung, gold, eisen, kohle },         // aktuelle Caps
  buildings: { [id]: [ {level, x, z}, ... ] },                 // Array pro Gebäudetyp (NEU)
  research: { [id]: true | { done, progress, startTick } },    // mit Zeit-System (NEU)
  activeResearch: null | researchId,                           // laufende Forschung (NEU)
  pop: 0, popTotal: 0, popMax: 0,
  moral: 60,
  prestige: 0,                                                  // Zähler bleibt, kein Mult mehr
  modifiers: { nahrungMult, holzMult, steinMult, goldMult, eisenMult, defense },
  day: 0, tick: 0, tier: 0,
  nextEventTick: 0,
  activeEvent: null,
  rathausAlive: true,                                          // Game-Over-Flag (NEU)
}
```

### WICHTIG: buildings-Format geändert

Alt: `S.buildings = { waldarbeiter: 3 }`
Neu: `S.buildings = { waldarbeiter: [ {level:1, x:2, z:4}, {level:2, x:0, z:3} ] }`

Grid-Positionen werden jetzt persistiert. Helper-Funktionen:
- `getBuildingCount(id)` → Anzahl Gebäude dieses Typs
- `getBuildingLevel(id, idx)` → Level eines bestimmten Exemplars

## Gebäude-System

### Mehrfach-Bau + Individuelle Upgrades

Jedes Gebäude-Exemplar hat ein eigenes `level` (1–5). Upgrade im Grid durch Klick auf das Gebäude.

**Baukosten** (exponentiell wie bisher): `baseCost × costMult^count`
**Upgrade-Kosten**: ca. 50–60% der Baukosten einer neuen Instanz, skaliert mit aktuellem Level

```javascript
// Upgrade-Kosten-Formel
upgradeCost(bld, currentLevel) = baseCost * 0.55 * (currentLevel * 0.8)
```

**Produktions-Bonus pro Level** (additiv):
- Level 1: ×1.0 (Basis)
- Level 2: ×1.3
- Level 3: ×1.7
- Level 4: ×2.2
- Level 5: ×3.0

### Wenn ein Gebäude zerstört wird (Überfälle)

1. Das Array-Element wird entfernt: `S.buildings[id].splice(idx, 1)`
2. Spezial-Multiplikatoren werden neu berechnet (Sägemühle → holzMult zurück)
3. Der `count` sinkt automatisch (da Array kürzer) → Baukosten-Exponent sinkt
4. Randgebäude werden zuerst zerstört (Distanz zum Zentrum, größte zuerst)
5. Wenn `id === 'rathaus'` → Game Over

### Rathaus

- Pflichtgebäude, steht beim ersten Start automatisch in der Mitte (6,6)
- Kann nicht manuell gebaut oder bewegt werden
- Wenn zerstört: `S.rathausAlive = false` → Game-Over-Bildschirm
- Hat kein Upgrade

## Lager-Bug-Fix

Das Problem: Lagerhaus-Upgrade-Kosten übersteigen die aktuelle Lager-Kapazität.

Lösung:
1. Baukosten-Multiplikator für Lagerhaus (`costMult`) von 2.0 auf 1.5 senken
2. Basis-Holz-Kapazität von 80 auf 150 erhöhen (pro Lagerhaus +80 statt +60)
3. Beim Anzeigen von Build-Buttons prüfen: wenn Kosten > (Lager - aktuelle Res), Button deaktivieren mit Hinweis "Lager zu klein"

## Grid-Persistence

Grid-Positionen werden jetzt in `S.buildings[id][idx].{x,z}` gespeichert.

Beim Laden (`loadState`):
- Positionen aus `S.buildings` werden direkt in `gridOccupied` übernommen
- `rebuild3D()` platziert Meshes an den gespeicherten Koordinaten
- Fallback: `findFreeCell()` nur wenn x/z fehlen (Migration alter Saves)

## Forschungs-System (NEU)

### Zeit-basiert

Forschung dauert echte Sekunden (definiert in `data.js` als `duration` in Ticks).
Nur eine Forschung gleichzeitig aktiv. Bibliothek erforderlich.

```javascript
// Im Game-Tick:
if (S.activeResearch) {
  S.research[S.activeResearch].progress += 1
  if (progress >= duration) → applyResearch(), S.activeResearch = null
}
```

Fortschrittsbalken im Forschungs-Panel.

### Neue Äste (geplant)

```
Landwirtschaft:
  stufe1: Kompostwirtschaft     → +30% Nahrung, schaltet Mühle frei
  stufe2: Fruchtfolge           → -20% Nahrung-Verbrauch
  stufe3: Gewächshaus           → Nahrungsproduktion auch bei Dürre
  stufe4: Plantagenwirtschaft   → +80% Nahrung, schaltet Plantage frei

Handel:
  stufe1: Fernhandel            → schaltet Handelsposten frei, +20% Gold
  stufe2: Münzprägung           → Gold-Cap ×2, schaltet Münze frei
  stufe3: Gildenwesen           → alle Produktionsgebäude +15%
  stufe4: Banken                → passives Goldeinkommen aus Lagerbestand

Architektur:
  stufe1: Steinmetzkunst        → Steinbruch-Upgrades Level 4+5 freigeschaltet
  stufe2: Gewölbebau            → Lagerhaus Cap ×1.5
  stufe3: Stadtplanung          → Grid-Größe +2 (14×14)
  stufe4: Kathedralen-Bau       → schaltet Kathedrale frei

Militär (vertiefen):
  stufe1: Bogenschießen         → +3 Verteidigung pro Wachturm
  stufe2: Belagerungsabwehr     → Mauern halten 2× so viele Treffer
  stufe3: Söldnerführer         → Söldner-Kosten -30%, +5 Verteidigung
  stufe4: Ritterorden           → schaltet Rittergut frei, +15 Verteidigung

Bestehende Äste bleiben, werden ggf. erweitert:
  Wirtschaft: Bewässerung, Gewürzhandel, Gilden (+ ggf. stufe4)
  Technologie: Metallurgie, Architektur-Tech (umbenennen), Ingenieure (+ stufe4)
```

Neue Gebäude-Freischaltungen werden aus `data.js` `requires` gelesen. Format:
```javascript
requires: { buildings: { waldarbeiter: 3 }, research: ['bewaesserung'] }
```

## Mauern-System

Mauern sind normale Grid-Gebäude (`mauer`-Typ), die manuell auf beliebige Zellen gesetzt werden. Kein Produktions-Wert, nur Verteidigung.

Bei Überfällen:
1. Alle Rand-Gebäude (Distanz > X zum Zentrum) ohne benachbarte Mauer: zuerst angreifbar
2. Mit Mauer daneben: Mauer nimmt zuerst Treffer (Mauer hat HP, wird nach N Treffern zerstört)
3. Nur wenn alle Mauern um ein Gebäude zerstört sind, ist das Gebäude direkt angreifbar

Visuell: Mauer-Mesh besteht aus Zinnen-Box, niedrig, passend zur Zellgröße.

## Events (angepasst an Fortschritt)

Events werden gefiltert nach `S.tier`. Belohnungen/Strafen skalieren mit Ressourcen-Level.

```javascript
// Beispiel-Skalierung
eventReward = baseReward * (1 + S.tier * 0.5) * prestigeMult
```

Neue Events für höhere Tier:
- Tier 2+: Händlerkonvoi (großes Goldangebot gegen Ressourcen)
- Tier 2+: Einwanderungswelle (+pop, braucht Platz)
- Tier 3: Belagerung (Serienereignis über mehrere Ticks, nicht nur 1 Event)

## Prestige (vereinfacht)

Prestige-Zähler bleibt, aber **kein permanenter Multiplikator**. Prestige ist jetzt ein reiner Ruf-/Geschichtswert ("Dein Dorf wurde X mal neu aufgebaut"). Der Prestige-Button bleibt mit Bestätigungsdialog, aber der Bonus entfällt.

`S.prestigeMult` wird auf konstant 1.0 gesetzt und nie geändert.

## Tier-System (unverändert)

- Tier 0 → Weiler: Start
- Tier 1 → Dorf: 5+ Gebäude, 5+ Bevölkerung
- Tier 2 → Stadt: 14+ Gebäude, 18+ Bevölkerung, 3+ Forschungen
- Tier 3 → Königreich: 22+ Gebäude, 35+ Bevölkerung, 7+ Forschungen

## Implementierungs-Reihenfolge

### Phase 1 — Kritische Fixes (erst diese, dann weiter)
1. `S.buildings` zu Array-Format migrieren (mit Rückwärtskompatibilität für alte Saves)
2. Grid-Positions-Persistence (x,z in State speichern)
3. Lager-Bug-Fix (costMult + Basis-Caps)
4. Rathaus als Pflichtgebäude in der Mitte

### Phase 2 — Kern-Features
5. Gebäude-Upgrade-System (Klick im Grid → Upgrade-Button, Level 1–5)
6. Forschung zeitbasiert (Fortschrittsbalken, activeResearch)
7. Neue Forschungs-Äste (Landwirtschaft zuerst, dann Handel, Architektur)
8. Prestige-Multiplikator entfernen

### Phase 3 — Kampf & Events
9. Mauern manuell platzierbar, Mauer-HP-System
10. Gebäude-Zerstörungs-Logik (Rand zuerst, Multiplikator-Reset)
11. Events nach Tier skalieren, neue Events

### Phase 4 — Nice-to-have
12. Straßen-System
13. Größeres Grid (14×14 oder 16×16)
14. Neue 3D-Meshes für Gebäude -> ansprechvollere Grafik für Gebäude

## Bekannte Bugs (aus Soll-Integriert-Werden.txt)

- [x] Grid-Reset bei Refresh → Phase 1
- [x] Lager-Cap-Bug ab Level 10 → Phase 1
- [ ] Markt-Debuffs greifen nicht (im Event-System prüfen)
