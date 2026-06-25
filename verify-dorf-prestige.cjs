const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  await page.goto('http://localhost:3000/Hub/Sammlung/Dorf/dorf.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000); // let loadGame()/rebuild3D() settle

  // Auto-accept the confirm() dialog used by prestige()
  await page.evaluate(() => { window.confirm = () => true; });

  // Hook the WebGL context to count outstanding (created - deleted) textures,
  // which exposes leaked CanvasTexture allocations from updateGroundTexture().
  const before = await page.evaluate(() => {
    const canvas = document.getElementById('threeCanvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    let created = 0, deleted = 0;
    const origCreate = gl.createTexture.bind(gl);
    gl.createTexture = function () { created++; return origCreate(); };
    const origDelete = gl.deleteTexture.bind(gl);
    gl.deleteTexture = function (t) { deleted++; return origDelete(t); };
    window.__texCounts = () => ({ created, deleted });
    return window.__texCounts();
  });
  console.log('before:', before);

  // Fire prestige() repeatedly — each call rebuilds the scene + ground texture.
  const N = 8;
  for (let i = 0; i < N; i++) {
    await page.evaluate(() => window.prestige());
    await page.waitForTimeout(150);
  }

  const after = await page.evaluate(() => window.__texCounts());
  console.log('after:', after, 'over', N, 'prestige() calls');
  console.log('net outstanding textures created by prestige():', after.created - after.deleted - (before.created - before.deleted));
  console.log('consoleErrors:', consoleErrors);

  await browser.close();
})();
