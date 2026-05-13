# Technische Spezifikation: Map-Erweiterung & Interaktive Objekte

Diese Spezifikation dient als Grundlage für die Integration der visuellen Konzepte (Umgebung, Baugrad-Evolution, Hindernisse) in den bestehenden Three.js-Renderer und die Spiellogik.

## 1. Map-Umgebung (World Borders)
Die Umgebung wird als statische Geometrie außerhalb des 14x14 Grids implementiert.

### Datenstruktur (renderer.js)
```javascript
const ENVIRONMENT_CONFIG = {
  forest: {
    sides: ['N', 'E'],
    density: 0.6,
    models: ['pine_large', 'pine_medium'],
    colors: [0x2a4a10, 0x1a3005]
  },
  mountains: {
    sides: ['W'],
    height: 4.5,
    models: ['cliff_rock', 'peak'],
    colors: [0x708090, 0x4a5a6a]
  }
};
```

### Visualisierung
- **Wald:** InstancedMesh für Low-Poly Tannen.
- **Berge:** Grobe, graue Geometrie mit sanftem Color-Gradient nach oben.
- **Nebel:** `scene.fog` (FogExp2) wird beibehalten, um den Übergang zum schwarzen Hintergrund zu kaschieren.

---

## 2. Baugrad-Evolution (Dorfzugang)
Der untere Bereich (Z-Achse positiv) ändert sich basierend auf `S.tier`.

### Logik (game.js / renderer.js)
```javascript
function updateMapStage(tier) {
  // Entferne altes Stage-Modell
  if (window._currentStageGroup) scene.remove(_currentStageGroup);
  
  const stageGroup = new THREE.Group();
  switch(tier) {
    case 0: // Weiler
      addMudPath(stageGroup);
      addSignpost(stageGroup);
      break;
    case 1: // Dorf
      addCobbleRoad(stageGroup);
      addMarketStalls(stageGroup);
      break;
    case 2: // Stadt
    case 3: // Königreich
      addStoneGate(stageGroup);
      addLanterns(stageGroup);
      addGuards(stageGroup);
      break;
  }
  window._currentStageGroup = stageGroup;
  scene.add(stageGroup);
}
```

---

## 3. Interaktive Hindernisse (Grid Objects)
Hindernisse belegen Tiles und sind entfernbar.

### Objekt-Definition (data.js)
```javascript
const OBSTACLES = [
  { 
    id: 'tree_pine', 
    name: 'Tanne', 
    type: 'tree',
    cost: { gold: 0 }, 
    yield: { holz: 15 },
    hp: 1,
    shape: 'pine',
    color: 0x3a5220
  },
  { 
    id: 'boulder_mossy', 
    name: 'Moosiger Fels', 
    type: 'stone',
    cost: { gold: 5 }, 
    yield: { stein: 10 },
    hp: 2,
    shape: 'rock',
    color: 0x708090
  }
];
```

### Animationen (renderer.js)
1. **Highlight (Hover):** `emissiveIntensity` des Objekts wird per Raycaster auf 0.6 gesetzt. Ein goldener `TorusGeometry` Ring erscheint am Boden (wie bei Gebäuden).
2. **Entfernung:**
   - **Baum:** Rotation um X-Achse (90 Grad), dann `scale` auf 0, gefolgt von einer Rauch-Partikel-Emission.
   - **Stein:** Mehrere kleine `BoxGeometry` Fragmente explodieren kurzzeitig nach außen, bevor sie verschwinden.

---

## 4. Integration in den State (game.js)
```javascript
const S = {
  // ... vorhandener State
  obstacles: [
    { id: 'tree_pine', x: -3, z: 2 },
    { id: 'boulder_mossy', x: 4, z: -5 }
  ]
};

function removeObstacle(idx) {
  const obs = S.obstacles[idx];
  // Ressourcen-Logik
  Object.entries(OBSTACLES.find(o => o.id === obs.id).yield).forEach(([res, val]) => {
    S.res[res] = Math.min(S.res[res] + val, S.lager[res]);
  });
  // Animation triggern & State updaten
  triggerRemovalAnim(obs.x, obs.z);
  S.obstacles.splice(idx, 1);
  save();
}
```
