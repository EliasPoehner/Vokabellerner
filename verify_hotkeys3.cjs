const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('[pageerror]', err.message));

  await page.goto('http://localhost:3000/Hub/Sammlung/CandyBox/candybox.html');
  await page.evaluate(() => {
    localStorage.setItem('candybox_save_v1', JSON.stringify({
      candies: 9999, gold: 9999,
      inventory: ['sword','hat','shield','potion','heal_herbs','strength_potion','iron_potion','battle_drum'],
      unlocked: ['throw','lollipopField','sell','shop','upgrades','quests'],
      hp: 20, maxHp: 50, defense: 0,
      activeQuest: null, activeEvent: null, eventCooldown: 0, completedQuests: [],
      autoHeal: false, fightSpeed: 1, lastSaved: Date.now(),
      stats: { candiesEaten:0, candiesThrown:0, questsWon:0, lollipopsSold:0, totalCandiesProduced:0, goldEarned:0 },
      lollipops: 0, lollipopQueue: 0, lollipopCooldown: 0, candyPerSec: 1, upgrades: [],
    }));
  });
  await page.reload();
  await page.waitForTimeout(400);
  await page.evaluate(() => window.cbQuest('forest'));
  await page.waitForTimeout(200);

  const hpBefore = await page.evaluate(() => document.getElementById('player-hp-label-2').textContent);
  await page.keyboard.press('e');
  await page.waitForTimeout(150);
  const hpAfter = await page.evaluate(() => document.getElementById('player-hp-label-2').textContent);
  console.log('HP before E:', hpBefore, '-> after E:', hpAfter);

  // F speed toggle (battle_drum present)
  const speedBefore = await page.evaluate(() => document.getElementById('btn-fight-speed').textContent.trim());
  await page.keyboard.press('f');
  await page.waitForTimeout(100);
  const speedAfter = await page.evaluate(() => document.getElementById('btn-fight-speed').textContent.trim());
  console.log('Speed before F:', speedBefore, '-> after F:', speedAfter);

  // Now force a loss/win quickly via direct state manipulation to test Enter on close button
  await page.evaluate(() => {
    // Simulate victory by importing game module is hard; just set state directly is risky since modules hold closures.
  });

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
