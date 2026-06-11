import { setGameCallbacks, rebuild3D, updateMapStage, rotateCam, zoomCam, tiltCam, zoomClick, toggleRoadMode, enterMoveMode } from './renderer';
import {
  notify, toggleRoad, removeObstacle, save, upgradeCost, loadGame,
  togglePanel, togglePanelFullscreen, showTab, toggleCat, toggleDetail,
  handleEvent, buyBuilding, buyResearch, upgradeBuilding, repairMauer, prestige, resetGame,
  calcLager, renderTab, log, tick, buySkill,
} from './game';
import { S } from './state';

// Wire renderer → game callbacks (breaks the circular dependency)
setGameCallbacks({ notify, toggleRoad, removeObstacle, save, upgradeCost });

// Expose renderer controls to window (dorf.html button onclick attributes)
Object.assign(window, { rotateCam, zoomCam, tiltCam, zoomClick, toggleRoadMode, enterMoveMode });

// Expose game functions to window (dynamically generated HTML onclick strings)
Object.assign(window, {
  togglePanel, togglePanelFullscreen, showTab, toggleCat, toggleDetail,
  handleEvent, buyBuilding, buyResearch, upgradeBuilding, repairMauer, prestige, resetGame,
  buySkill,
});

// Init — async IIFE so we can await loadGame() without top-level await
(async () => {
  await loadGame();

  // New game: loadGame returned early (no save) → place rathaus and build scene
  if (!S.buildings.rathaus || S.buildings.rathaus.length === 0) {
    S.buildings.rathaus = [{ level: 1, x: 0, z: 0 }];
    (S as any).rathausAlive = true;
    rebuild3D();
    updateMapStage(0);
  }

  calcLager();
  renderTab('bauen');
  log('Chronik beginnt. Baue dein Dorf!', 'important');
  setInterval(tick, 100);
})();
